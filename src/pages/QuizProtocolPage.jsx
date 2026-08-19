import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import useQuizResults from '../hooks/useQuizResults';
import { MEMBER_STATUS } from '../../shared/quizStatus.js';
import { getEffectiveRoles } from '../utils/roles';

// Stejný okruh rolí jako `MANAGE_ROLES` v useQuizzes.js — kdo smí spravovat
// kvízy, smí i vidět a tisknout jejich protokol. Firestore pravidla čtení
// `quizAttempts` cizích členů stejně povolují jen těmto rolím
// (`isElevated()`), takže bez této kontroly by stránka u ostatních jen
// nekonečně načítala (dotaz na pokusy by Firestore zamítl).
const MANAGE_ROLES = ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'];

// Padne jen tehdy, když `settings/unit` ještě nikdy nikdo nevyplnil — nesmí
// se vypsat prázdný řádek ani "undefined", ale zároveň nejde předstírat
// konkrétní jméno jednotky, které nikdo nezadal.
const FALLBACK_UNIT_NAME = 'Jednotka dobrovolných hasičů';

const STATUS_LABELS = {
  [MEMBER_STATUS.PASSED]: 'Splnil',
  [MEMBER_STATUS.FAILED]: 'Nesplnil',
  [MEMBER_STATUS.PENDING_REVIEW]: 'Čeká na vyhodnocení',
  [MEMBER_STATUS.IN_PROGRESS]: 'Rozpracováno',
  [MEMBER_STATUS.NOT_STARTED]: 'Nevyplnil',
};

// Příjmení pro řazení — tabulka na protokolu se (na rozdíl od interaktivní
// admin tabulky, která dává nesplněné navrch) řadí čistě abecedně podle
// příjmení, jak vyžaduje úloha 17. `row.name` je "Jméno Příjmení" (viz
// formatUserName v useQuizAttempt.js), poslední slovo je nejlepší dostupný
// odhad příjmení i pro řádky bez dokumentu v `users` (smazaný účet).
function surnameOf(name) {
  const parts = (name || '').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : '';
}

// `iso` ve tvaru "YYYY-MM-DD" (termín kvízu, datum školení) — parsuje se
// ručně, ne přes `new Date()`, aby posun časového pásma neposunul den (stejný
// důvod jako `formatDate` v QuizzesTab.jsx).
function formatDateOnly(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

// Plné ISO datum s časem (odevzdání pokusu) — tady je lokální časové pásmo
// žádoucí, tiskne se jen datum, ne čas.
function formatDateTimeAsDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatScoreCell(row) {
  if (row.status === MEMBER_STATUS.PASSED || row.status === MEMBER_STATUS.FAILED) {
    return typeof row.scorePercent === 'number' ? `${Math.round(row.scorePercent)} %` : '—';
  }
  // pending_review/in_progress/not_started nemají číselné skóre — tiskne se
  // slovní stav, nikdy ne "—" ani vymyšlené číslo.
  return STATUS_LABELS[row.status] || '—';
}

const styles = `
  .protocol-page {
    background: #eef0f2;
    min-height: 100vh;
    padding: 2rem 1rem 4rem;
  }
  .protocol-toolbar {
    max-width: 800px;
    margin: 0 auto 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .protocol {
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    padding: 3rem;
    box-shadow: 0 2px 16px rgba(0,0,0,0.12);
    color: #111;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  }
  .protocol__header {
    text-align: center;
    border-bottom: 2px solid #222;
    padding-bottom: 1.25rem;
    margin-bottom: 1.5rem;
  }
  .protocol__unit {
    margin: 0 0 0.35rem;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .protocol__title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
  }
  .protocol__info {
    display: grid;
    grid-template-columns: max-content 1fr;
    row-gap: 0.4rem;
    column-gap: 1rem;
    margin-bottom: 1.75rem;
    font-size: 0.92rem;
  }
  .protocol__info dt {
    color: #444;
    font-weight: 600;
  }
  .protocol__info dd {
    margin: 0;
  }
  .protocol table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.25rem;
  }
  .protocol th, .protocol td {
    border: 1px solid #333;
    padding: 0.45rem 0.6rem;
    font-size: 0.85rem;
    text-align: left;
  }
  .protocol thead th {
    background: #e8e8e8;
    font-weight: 700;
  }
  .protocol td.num, .protocol th.num {
    text-align: center;
    width: 2.5rem;
  }
  .protocol td.verdict {
    font-weight: 700;
  }
  .protocol__summary {
    font-size: 0.92rem;
    font-weight: 600;
    margin-bottom: 3.5rem;
  }
  .protocol__signatures {
    display: flex;
    justify-content: space-between;
    gap: 4rem;
  }
  .protocol__signature {
    flex: 1;
    text-align: center;
  }
  .protocol__signature-line {
    border-top: 1px solid #333;
    margin-top: 3.5rem;
    padding-top: 0.4rem;
    font-size: 0.82rem;
    color: #333;
  }

  @media print {
    .no-print { display: none !important; }
    body { background: white; }
    .protocol-page { background: white; padding: 0; }
    .protocol { padding: 0; box-shadow: none; max-width: none; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }

    /* Na obrazovce se protokol nestránkuje, takže velkorysé mezery nevadí.
       Na papíře ale odsunou podpisový blok na druhou stranu i tam, kde by
       se ještě pohodlně vešel — v tisku je proto stahujeme. */
    .protocol__summary { margin-bottom: 1.5rem; }
    .protocol__signature-line { margin-top: 2rem; }
    .protocol__signatures { page-break-inside: avoid; }
  }
  @page { size: A4; margin: 15mm; }
`;

export default function QuizProtocolPage() {
  const { quizId } = useParams();
  const { userData } = useAuth();
  const { quiz, rows, summary, loading } = useQuizResults(quizId);

  const [unitName, setUnitName] = useState('');
  const [unitLoaded, setUnitLoaded] = useState(false);

  const userRoles = getEffectiveRoles(userData ? (userData.roles || [userData.role || 'Hasič']) : []);
  const canView = userRoles.some(r => MANAGE_ROLES.includes(r));

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'unit'), (snap) => {
      setUnitName(snap.exists() ? (snap.data().name || '') : '');
      setUnitLoaded(true);
    });
    return unsub;
  }, []);

  // Jediné cílené načtení školení podle ID (ne celá kolekce) — `useQuizResults`
  // sice `trainings` interně natahuje kvůli `isAssignedTo`, ale nevrací je
  // (viz kontrakt úlohy 14), takže pro název navázaného školení na protokolu
  // je potřeba jeden konkrétní dokument dotáhnout zvlášť.
  //
  // `trainingId` řídí, PRO KTERÉ ID aktuální `trainingState` platí — když se
  // `trainingId` změní (jiný kvíz vybrán), `trainingState.key` z předchozího
  // kvízu už s ním nesouhlasí, takže `training`/`trainingLoaded` níže se
  // odvodí jako "ještě nenačteno" okamžitě, bez nutnosti cokoli resetovat
  // synchronně v těle efektu (to by narazilo na `react-hooks/set-state-in-
  // effect`, stejně jako reset u `dataQuizId` v useQuizResults.js muselo jít
  // mimo efekt).
  const trainingId = quiz?.assignment?.mode === 'training' ? (quiz?.trainingId || null) : null;
  const [trainingState, setTrainingState] = useState({ key: undefined, training: null });

  useEffect(() => {
    if (!trainingId) return undefined;
    let cancelled = false;
    getDoc(doc(db, 'trainings', trainingId)).then((snap) => {
      if (cancelled) return;
      setTrainingState({ key: trainingId, training: snap.exists() ? { id: snap.id, ...snap.data() } : null });
    }).catch(() => {
      if (!cancelled) setTrainingState({ key: trainingId, training: null });
    });
    return () => { cancelled = true; };
  }, [trainingId]);

  const trainingLoaded = trainingId === null || trainingState.key === trainingId;
  const training = trainingState.key === trainingId ? trainingState.training : null;

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => surnameOf(a.name).localeCompare(surnameOf(b.name), 'cs')),
    [rows],
  );

  const pageLoading = loading || !unitLoaded || !trainingLoaded;

  if (!canView) {
    return (
      <div className="protocol-page">
        <div className="protocol" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#d32f2f' }}>Přístup zamítnut</h2>
          <p className="text-secondary">Protokol o absolvování školení smí zobrazit jen velitel jednotky a administrátoři.</p>
          <Link to="/" className="btn btn-secondary">Zpět</Link>
        </div>
      </div>
    );
  }

  if (pageLoading) {
    return (
      <div className="protocol-page">
        <div className="protocol" style={{ textAlign: 'center', color: '#888' }}>Načítání protokolu…</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="protocol-page">
        <div className="protocol" style={{ textAlign: 'center' }}>
          <h2>Kvíz nenalezen</h2>
          <p className="text-secondary">Tento kvíz neexistuje nebo byl smazán.</p>
          <Link to="/admin" className="btn btn-secondary">Zpět do administrace</Link>
        </div>
      </div>
    );
  }

  const unitLabel = unitName.trim() || FALLBACK_UNIT_NAME;
  const deadlineLabel = formatDateOnly(quiz.deadline) || 'Bez termínu';
  const trainingLabel = quiz.assignment?.mode === 'training'
    ? (training ? `${training.title}${formatDateOnly(training.date) ? ` (${formatDateOnly(training.date)})` : ''}` : '(smazané školení)')
    : '—';
  const createdByLabel = quiz.createdBy?.name || '—';
  const generatedLabel = new Date().toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="protocol-page">
      <style>{styles}</style>

      <div className="protocol-toolbar no-print">
        <Link to="/admin" className="btn btn-secondary">← Zpět do administrace</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>
          Vytisknout / Uložit jako PDF
        </button>
      </div>

      <div className="protocol">
        <div className="protocol__header">
          <p className="protocol__unit">{unitLabel}</p>
          <h1 className="protocol__title">Protokol o absolvování školení</h1>
        </div>

        <dl className="protocol__info">
          <dt>Název kvízu</dt>
          <dd>{quiz.title || '(Bez názvu)'}</dd>

          <dt>Navázané školení</dt>
          <dd>{trainingLabel}</dd>

          <dt>Termín odevzdání</dt>
          <dd>{deadlineLabel}</dd>

          <dt>Hranice úspěšnosti</dt>
          <dd>{quiz.passThreshold ?? 0} %</dd>

          <dt>Kvíz zadal</dt>
          <dd>{createdByLabel}</dd>

          <dt>Datum vygenerování</dt>
          <dd>{generatedLabel}</dd>
        </dl>

        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Jméno</th>
              <th>Datum splnění</th>
              <th>Skóre</th>
              <th>Výsledek</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => (
              <tr key={row.uid}>
                <td className="num">{index + 1}</td>
                <td>{row.name}</td>
                <td>{formatDateTimeAsDate(row.submittedAt) || '—'}</td>
                <td>{formatScoreCell(row)}</td>
                <td className="verdict">{STATUS_LABELS[row.status] || '—'}</td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>Žádní přiřazení členové.</td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="protocol__summary">
          Přiřazeno: {summary.assigned} · Splnilo: {summary.passed} · Nesplnilo: {summary.failed} · Nevyplnilo: {summary.notStarted}
          {summary.pending > 0 && ` · Čeká na vyhodnocení: ${summary.pending}`}
        </p>

        <div className="protocol__signatures">
          <div className="protocol__signature">
            <div className="protocol__signature-line">Datum</div>
          </div>
          <div className="protocol__signature">
            <div className="protocol__signature-line">Podpis velitele jednotky a razítko</div>
          </div>
        </div>
      </div>
    </div>
  );
}
