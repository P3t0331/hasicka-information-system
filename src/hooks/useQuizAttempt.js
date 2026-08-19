import {
  useState, useEffect, useMemo, useCallback, useRef,
} from 'react';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, query, where, setDoc, updateDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

/**
 * Zahájení a vyplňování jednoho pokusu na konkrétní kvíz (`/skoleni/kviz/:quizId`).
 *
 * Úloha 11 implementuje čtení kvízu a pokusu a `startAttempt()`. Úloha 12
 * doplňuje vyplňování otázek (`setAnswer`) s průběžným ukládáním. Odevzdání
 * (`submitAttempt`) doplní úloha 13 — záměrně tu není ani jako prázdný stub,
 * aby nevznikl dojem hotové funkce.
 */

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOrder(quiz) {
  const ids = quiz.questions.map(q => q.id);
  const questionIds = quiz.shuffleQuestions ? shuffled(ids) : ids;
  const optionOrder = {};
  for (const question of quiz.questions) {
    const optionIds = (question.options || []).map(o => o.id);
    optionOrder[question.id] = quiz.shuffleOptions ? shuffled(optionIds) : optionIds;
  }
  return { questionIds, optionOrder };
}

// `userName` se ukládá do dokumentu pokusu a odtud i do oficiálního protokolu,
// který jednotka ukazuje při kontrole — neúplný profil proto nesmí vyprodukovat
// doslovné "undefined undefined", ale rozumný náhradní text.
function formatUserName(userData) {
  const first = (userData?.firstName || '').trim();
  const last = (userData?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ');
  return full || 'Neznámý člen';
}

export default function useQuizAttempt(quizId) {
  const { currentUser, userData } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [quizLoaded, setQuizLoaded] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!quizId) return undefined;
    const unsubscribe = onSnapshot(doc(db, 'quizzes', quizId), (snap) => {
      setQuiz(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setQuizLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

  useEffect(() => {
    // Stránka je za PrivateRoute, takže currentUser bude v praxi vždy k dispozici;
    // guard je jen obranný, ať where() nikdy nedostane undefined.
    if (!quizId || !currentUser?.uid) return undefined;
    const attemptsQuery = query(
      collection(db, 'quizAttempts'),
      where('quizId', '==', quizId),
      where('uid', '==', currentUser.uid),
    );
    const unsubscribe = onSnapshot(attemptsQuery, (snapshot) => {
      setAttempts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setAttemptsLoaded(true);
    });
    return unsubscribe;
  }, [quizId, currentUser?.uid]);

  // Nejvýš jeden rozpracovaný pokus může v danou chvíli existovat — nový nejde
  // založit, dokud se předchozí neodevzdá (submitAttempt, úloha 13).
  const liveAttempt = useMemo(
    () => attempts.find(a => a.status === 'in_progress') || null,
    [attempts],
  );

  // Lokální pracovní kopie rozpracovaného pokusu. Založí se, jakmile je
  // `liveAttempt` poprvé k dispozici (nový pokus i pokus obnovený po
  // znovunačtení stránky) — a od té chvíle se pole `answers`/`lastSavedAt`
  // z živého onSnapshot už NEpřebírají zpět. `setAnswer` níže tato pole mění
  // v lokálním stavu okamžitě při každém úderu klávesy; kdyby se sem navíc
  // promítal i ozvěnový onSnapshot vlastního zápisu, mohl by dorazit s
  // odpověďmi o kolo starými než to, co člen právě dopisuje do textového
  // pole, a přepsat mu rozepsaný text. Ostatní pole (status, order, …) se u
  // rozpracovaného pokusu nemění jinak než přes odeslání (submitAttempt,
  // úloha 13), takže není co dosynchronizovávat — stejný vzor jako
  // `workingQuiz` v AdminQuizEditorPage.
  const [attempt, setAttempt] = useState(null);
  const attemptIdRef = useRef(null);
  const saveTimer = useRef(null);
  const pendingAnswers = useRef(null);
  // `dirtyRef`: `pendingAnswers` holds a change not yet confirmed written to
  // Firestore. `writeInFlightRef`: an `updateDoc` for this attempt is
  // currently outstanding. Together they serialise writes (see `flush`
  // below) instead of letting the debounce start a second `updateDoc` while
  // an earlier one is still in flight against the same document.
  const dirtyRef = useRef(false);
  const writeInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'

  useEffect(() => {
    if (!liveAttempt) {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      attemptIdRef.current = null;
      pendingAnswers.current = null;
      dirtyRef.current = false;
      writeInFlightRef.current = false;
      setAttempt(null);
      return;
    }
    if (attemptIdRef.current !== liveAttempt.id) {
      // Nový pokus (čerstvě založený, nebo první načtení po otevření
      // stránky) — převezme se celý, včetně případných dřív uložených
      // odpovědí, a lokální ukládací stav se resetuje. `writeInFlightRef` se
      // resetuje také: kdyby zápis pro starý pokus ještě doběhl, cílí na
      // jeho vlastní (jiné) id dokumentu zachycené v okamžiku odeslání, takže
      // nová sada odpovědí na něm nijak nezávisí.
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      pendingAnswers.current = null;
      dirtyRef.current = false;
      writeInFlightRef.current = false;
      setSaveState('idle');
      attemptIdRef.current = liveAttempt.id;
      setAttempt(liveAttempt);
    }
  }, [liveAttempt]);

  // Odešle do Firestore aktuální kompletní sadu odpovědí (`pendingAnswers`),
  // ale nikdy víc než jeden zápis najednou pro tentýž pokus:
  //  - Pokud už jeden `updateDoc` běží (`writeInFlightRef.current`), další
  //    volání `flush()` jen ponechá `dirtyRef` nastavený a nic dalšího
  //    neodešle — dva souběžné zápisy do téhož dokumentu by teoreticky mohly
  //    být Firestore zpracovány v jiném pořadí, než byly odeslány, a novější
  //    odpověď by tak mohl přepsat starší (menší) payload zpět.
  //  - Po doběhnutí zápisu (ať úspěchem, nebo chybou) se `flush()` zavolá
  //    znovu, pokud mezitím přibyla další nepotvrzená úprava — tím se zápisy
  //    zřetězí, místo aby čekaly na další 1s debounce.
  //  - `saveState` se na 'saved'/'error' nastaví jen tehdy, když po
  //    doběhnutí zápisu už nic nového nečeká — jinak by mohl krátce ukázat
  //    „Uloženo“ pro data, která mezitím přestala být aktuální.
  const flush = useCallback(() => {
    if (writeInFlightRef.current) return;
    if (!dirtyRef.current) return;
    const attemptId = attemptIdRef.current;
    if (!attemptId) return;

    writeInFlightRef.current = true;
    dirtyRef.current = false;
    const payload = pendingAnswers.current;

    updateDoc(doc(db, 'quizAttempts', attemptId), {
      answers: payload,
      lastSavedAt: new Date().toISOString(),
    }).then(() => {
      writeInFlightRef.current = false;
      if (dirtyRef.current) { flush(); return; }
      if (mountedRef.current) setSaveState('saved');
    }).catch((err) => {
      writeInFlightRef.current = false;
      console.error('Chyba při ukládání odpovědi:', err);
      if (dirtyRef.current) { flush(); return; }
      if (mountedRef.current) setSaveState('error');
    });
  }, []);

  // Vynutí okamžité odeslání rozpracované úpravy (bez čekání na zbytek 1s
  // debounce) ve chvíli, kdy člen odchází ze stránky — zavření karty,
  // přepnutí mobilní aplikace na pozadí, i běžná navigace pryč.
  // `visibilitychange` (ne `beforeunload`) je zvolené záměrně: na mobilních
  // prohlížečích, které jsou tu hlavním případem použití, se `beforeunload`
  // často vůbec nespustí. Volá stejný `flush()` jako debounce, takže i tady
  // posílá vždy kompletní aktuální sadu odpovědí a respektuje sériové
  // zpracování zápisů.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
        flush();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [flush]);

  // Úklid při odpojení komponenty: zruší čekající debounce časovač a rovnou
  // vypálí poslední rozpracovanou úpravu, i kdyby existovala kratší dobu než
  // je 1s debounce — jinak by o ni člen, který zavře kartu do sekundy od
  // poslední odpovědi, přišel, aniž by to ukazatel stavu ukládání vůbec
  // stihl naznačit. Zápis je "fire-and-forget" (v cleanup funkci nejde na
  // Promise čekat). `mountedRef` pak brání pozdějšímu `setSaveState`
  // volanému z dokončení tohoto (nebo navazujícího zřetězeného) zápisu —
  // komponenta už v tu chvíli není připojená.
  useEffect(() => () => {
    mountedRef.current = false;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    flush();
  }, [flush]);

  // Okamžitě aktualizuje lokální stav a s prodlevou 1 s zapíše do Firestore
  // přes `flush()`. Zápis smí měnit jen `answers` a `lastSavedAt` — pravidla
  // update pro člena na vlastním rozpracovaném pokusu nic jiného nedovolí
  // (viz `firestore.rules`), takže se sem záměrně nepřidává `status`, `uid`,
  // `startedAt` ani `attemptNumber`.
  //
  // `pendingAnswers` vždy drží kompletní, aktuální sadu odpovědí (aktualizuje
  // se synchronně uvnitř funkčního updateru `setAttempt`, ne z uzavřené
  // proměnné `attempt.answers`), takže i když člen mezi zahájením a
  // vypálením časovače stihne odpovědět na jinou otázku, `flush()` o 1 s
  // později odešle obě odpovědi najednou — ne jen tu poslední přepsanou přes
  // předchozí.
  const setAnswer = useCallback((questionId, value) => {
    if (!attempt) return;

    setAttempt(prev => {
      if (!prev) return prev;
      const next = { ...prev, answers: { ...prev.answers, [questionId]: value } };
      pendingAnswers.current = next.answers;
      return next;
    });

    dirtyRef.current = true;
    setSaveState('saving');

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flush();
    }, 1000);
  }, [attempt, flush]);

  const startAttempt = useCallback(async () => {
    if (!quiz || !currentUser?.uid || !userData || starting || attempt) return;
    setStarting(true);
    setError(null);
    try {
      // attemptNumber vychází z pokusů, které tento hook právě vidí (vlastní
      // onSnapshot nad quizAttempts filtrovaný na quizId+uid). Pokud je tento
      // pohled zastaralý — např. jiná záložka mezitím pokus se stejným číslem
      // už založila nebo odevzdala — dokument se stejným deterministickým id
      // buď už existuje s jiným stavem než 'in_progress' (update pravidlo
      // vyžaduje resource.data.status == 'in_progress', takže zápis spadne
      // jako update na hotový pokus), nebo existuje jako rozpracovaný a tento
      // zápis by měnil pole mimo ['answers', 'lastSavedAt'] (nové 'order',
      // 'startedAt' apod.), což update pravidlo také odmítne. V obou
      // případech Firestore zápis zamítne permission-denied a žádný pokus
      // se tiše nepřepíše ani nezdvojí.
      const attemptNumber = attempts.length + 1;
      const attemptId = `${quizId}_${currentUser.uid}_${attemptNumber}`;
      const now = new Date().toISOString();
      await setDoc(doc(db, 'quizAttempts', attemptId), {
        quizId,
        uid: currentUser.uid,
        userName: formatUserName(userData),
        attemptNumber,
        status: 'in_progress',
        order: buildOrder(quiz),
        answers: {},
        startedAt: now,
        lastSavedAt: now,
        submittedAt: null,
        isLate: false,
        questionCount: quiz.questions.length,
        autoCorrectCount: 0,
        manualGrades: {},
        scorePercent: null,
        passed: null,
        gradedBy: null,
        gradedAt: null,
      });
    } catch (err) {
      console.error('Error starting quiz attempt:', err);
      setError('Kvíz se nepodařilo zahájit. Zkuste to prosím znovu.');
    } finally {
      setStarting(false);
    }
  }, [quiz, quizId, currentUser?.uid, userData, attempts, attempt, starting]);

  return {
    quiz,
    attempt,
    loading: !(quizLoaded && attemptsLoaded),
    error,
    starting,
    startAttempt,
    setAnswer,
    saveState,
  };
}
