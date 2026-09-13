import React from 'react';
import { DAY_START, DAY_END, MAX_SLOTS } from '../../../../shared/availability.js';

export default function AvailabilityHelp({ onClose }) {
  return (
    <div
      id="availability-help"
      style={{
        padding: '0.75rem 0.9rem', borderRadius: '8px', background: 'var(--indigo-bg)',
        border: '1px solid var(--indigo)', color: 'var(--text-primary)', fontSize: '0.85rem',
        lineHeight: 1.45, marginBottom: '0.75rem',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>K čemu to je?</div>
      <p style={{ margin: '0 0 0.5rem' }}>
        Přehled ukazuje, ve které dny máme dost lidí na výjezd (2× Hasič, 1× Strojník, 1× Velitel)
        a koho shánět, když někdo chybí. Čím víc lidí se zapíše, tím je přehled přesnější.
      </p>
      <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }}>
        <li>Klepni na den a dej <strong>Jsem k dispozici</strong> — označíš se na {DAY_START}–{DAY_END}. Přes <strong>Jiný čas</strong> nastavíš vlastní časy (až {MAX_SLOTS} úseky za den).</li>
        <li><strong>Dojezd</strong> = za jak dlouho jsi na stanici. Aplikace si pamatuje poslední hodnotu.</li>
        <li>🟢 kompletní posádka celý den · 🟡 jen část dne · 🔴 někdo chybí. Číslo <strong>3/4</strong> říká, kolik pozic je obsazeno.</li>
        <li>Každý obsadí jen jednu pozici; velitel nebo strojník může zaskočit i za hasiče.</li>
        <li>Kdo je na denní službě, počítá se automaticky. Absence dostupnost ruší.</li>
        <li><strong>Opakovat na další týden</strong> zkopíruje tvoje dny z tohoto týdne na příští.</li>
      </ul>
      <button type="button" className="btn" onClick={onClose} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}>
        Rozumím
      </button>
    </div>
  );
}
