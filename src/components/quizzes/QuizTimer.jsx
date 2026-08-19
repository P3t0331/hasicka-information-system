import React, { useEffect, useRef, useState } from 'react';
import { remainingSeconds } from '../../../shared/quizStatus.js';

function formatClock(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Odpočet zbývajícího času pokusu. Nevykresluje se vůbec, když kvíz nemá
 * časový limit (`timeLimitMinutes` je 0/null) — `remainingSeconds` by v tom
 * případě vždy vracelo 0, takže bez tohoto guardu by komponenta okamžitě
 * (a chybně) zavolala `onExpire` na kvízu bez limitu.
 *
 * Poslední minuta (< 60 s) se zvýrazní červeně. Při dosažení nuly zavolá
 * `onExpire()` — přesně jednou, hlídáno `firedRef`: `setInterval` dál tiká i
 * po vypršení limitu (dokud rodič nepřestane komponentu vykreslovat), takže
 * bez tohoto příznaku by `onExpire` volal opakovaně, jednou za sekundu.
 * `onExpire` samo o sobě musí být bezpečné zavolat víckrát (viz
 * `submitAttempt` v `useQuizAttempt`, které se chrání přes `submittingRef`),
 * ale tady se tomu předchází přímo u zdroje.
 */
export default function QuizTimer({ startedAt, timeLimitMinutes, onExpire }) {
  // `startedAt`/`timeLimitMinutes` mění hodnotu jedině tehdy, když jde o
  // jiný pokus (v praxi se komponenta v tu chvíli navíc přemountuje, protože
  // `QuizTakePage` ji vykresluje jen uvnitř větve s rozpracovaným pokusem —
  // ale kdyby admin změnil časový limit kvízu v půlce pokusu, `timeLimitMinutes`
  // by se změnilo bez remountu). `inputKey` tuhle změnu odhalí a dopočítá
  // zbývající čas ihned v těle komponenty — doporučený React vzor na
  // "přenastavení stavu při změně vstupu", ne v efektu (volání setState
  // synchronně v těle efektu React nedoporučuje).
  const inputKey = `${startedAt || ''}|${timeLimitMinutes || ''}`;
  const [seenKey, setSeenKey] = useState(inputKey);
  const [seconds, setSeconds] = useState(() => (
    remainingSeconds(startedAt, timeLimitMinutes, new Date().toISOString())
  ));
  if (inputKey !== seenKey) {
    setSeenKey(inputKey);
    setSeconds(remainingSeconds(startedAt, timeLimitMinutes, new Date().toISOString()));
  }

  const firedRef = useRef(false);
  // Ref na `onExpire` místo přímé závislosti efektu — kdyby rodič posílal
  // novou instanci funkce při každém renderu (běžné u inline handlerů),
  // nesmí to restartovat interval (a tím i `firedRef`) uprostřed odpočtu.
  // Aktualizuje se ve vlastním efektu (bez pole závislostí, běží po každém
  // renderu) — zápis do refu přímo v těle komponenty při renderu není
  // dovolený.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!timeLimitMinutes || !startedAt) return undefined;

    firedRef.current = false;

    const interval = setInterval(() => {
      const left = remainingSeconds(startedAt, timeLimitMinutes, new Date().toISOString());
      setSeconds(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes]);

  if (!timeLimitMinutes || !startedAt) return null;

  const isLastMinute = seconds < 60;

  return (
    <div
      aria-live="polite"
      style={{
        fontWeight: 700,
        fontSize: '0.95rem',
        color: isLastMinute ? '#C62828' : 'var(--text-primary)',
      }}
    >
      Zbývající čas: {formatClock(seconds)}
    </div>
  );
}
