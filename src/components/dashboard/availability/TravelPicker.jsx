import React, { useState } from 'react';
import { TRAVEL_PRESETS, MIN_TRAVEL, MAX_TRAVEL } from '../../../../shared/availability.js';

export default function TravelPicker({ busy, onPick, onCancel }) {
  const [custom, setCustom] = useState('');
  const customNumber = Number(custom);
  const customValid = custom !== '' && Number.isInteger(customNumber) && customNumber >= MIN_TRAVEL && customNumber <= MAX_TRAVEL;

  return (
    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--surface-alt)', marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Za jak dlouho jsi na stanici?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {TRAVEL_PRESETS.map(min => (
          <button key={min} type="button" className="btn btn-secondary" disabled={busy} onClick={() => onPick(min)}
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}>
            {min} min
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} htmlFor="travel-custom">Jiný:</label>
        <input id="travel-custom" className="input-field" type="number" min={MIN_TRAVEL} max={MAX_TRAVEL} step="1"
          value={custom} onChange={e => setCustom(e.target.value)} style={{ width: '5rem' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>min</span>
        <button type="button" className="btn btn-primary" disabled={busy || !customValid} onClick={() => onPick(customNumber)}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          Uložit
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          Zrušit
        </button>
      </div>
    </div>
  );
}
