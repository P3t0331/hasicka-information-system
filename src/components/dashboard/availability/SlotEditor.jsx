import React, { useState } from 'react';
import { DAY_START, DAY_END, MAX_SLOTS, MIN_TRAVEL, MAX_TRAVEL, TRAVEL_PRESETS, validateSlots } from '../../../../shared/availability.js';

const toRow = (slot) => ({ ...slot, custom: !TRAVEL_PRESETS.includes(slot.travelMin) });

export default function SlotEditor({ initialSlots, defaultTravel, busy, onSave, onCancel, onRemove }) {
  const fallbackTravel = defaultTravel || 5;
  const [rows, setRows] = useState(() =>
    (initialSlots?.length ? initialSlots : [{ from: DAY_START, to: DAY_END, travelMin: fallbackTravel }]).map(toRow),
  );

  const slots = rows.map(({ from, to, travelMin }) => ({ from, to, travelMin }));
  const error = validateSlots(slots);

  const update = (index, patch) => setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index) => {
    if (rows.length === 1) {
      if (onRemove) onRemove();
      else onCancel();
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const addRow = () => setRows(prev => [...prev, toRow({ from: '13:00', to: DAY_END, travelMin: fallbackTravel })]);

  return (
    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--surface-alt)', marginBottom: '0.75rem' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input className="input-field" type="time" min={DAY_START} max={DAY_END} step="60" aria-label="Od"
            value={row.from} onChange={e => update(i, { from: e.target.value })} style={{ width: '6.5rem' }} />
          <span style={{ color: 'var(--text-secondary)' }}>–</span>
          <input className="input-field" type="time" min={DAY_START} max={DAY_END} step="60" aria-label="Do"
            value={row.to} onChange={e => update(i, { to: e.target.value })} style={{ width: '6.5rem' }} />
          <select className="input-field" aria-label="Dojezd" value={row.custom ? 'custom' : String(row.travelMin)}
            onChange={e => (e.target.value === 'custom'
              ? update(i, { custom: true })
              : update(i, { custom: false, travelMin: Number(e.target.value) }))}
            style={{ width: '7rem' }}>
            {TRAVEL_PRESETS.map(min => <option key={min} value={String(min)}>🕒 {min} min</option>)}
            <option value="custom">Jiný…</option>
          </select>
          {row.custom && (
            <input className="input-field" type="number" min={MIN_TRAVEL} max={MAX_TRAVEL} step="1" aria-label="Dojezd v minutách"
              value={Number.isNaN(row.travelMin) ? '' : row.travelMin}
              onChange={e => update(i, { travelMin: e.target.value === '' ? NaN : Number(e.target.value) })}
              style={{ width: '4.5rem' }} />
          )}
          <button type="button" className="btn" disabled={busy} onClick={() => removeRow(i)} aria-label="Smazat čas"
            style={{ padding: '0.35rem 0.6rem' }}>
            🗑
          </button>
        </div>
      ))}

      {rows.length < MAX_SLOTS && (
        <button type="button" className="btn" disabled={busy} onClick={addRow}
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          + Přidat další čas
        </button>
      )}

      {error && <div style={{ color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn btn-primary" disabled={busy || !!error} onClick={() => onSave(slots)}>
          Uložit
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Zpět
        </button>
      </div>
    </div>
  );
}
