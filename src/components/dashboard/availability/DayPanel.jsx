import React, { useState } from 'react';
import { DAY_START, DAY_END, describeCoverage, describePersonTimes, formatDateCZ } from '../../../../shared/availability.js';
import { STATUS_STYLE } from './statusStyle';
import SlotEditor from './SlotEditor';
import TravelPicker from './TravelPicker';

export default function DayPanel({ coverage, readOnly = false, me = null, busy = false, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [askTravel, setAskTravel] = useState(false);
  const style = STATUS_STYLE[coverage.status];

  const saveFullDay = (travelMin) => onSave([{ from: DAY_START, to: DAY_END, travelMin }]);

  const handleQuickAdd = () => {
    if (!me.rememberedTravel) {
      setAskTravel(true);
      return;
    }
    saveFullDay(me.rememberedTravel);
  };

  const handleTravelPicked = async (travelMin) => {
    const ok = await saveFullDay(travelMin);
    if (ok) setAskTravel(false);
  };

  const handleEditorSave = async (slots) => {
    const ok = await onSave(slots);
    if (ok) setEditing(false);
  };

  const handleRemove = async () => {
    const ok = await onRemove();
    if (ok) setEditing(false);
  };

  const renderMine = () => {
    if (me.absent) {
      return <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>Máš absenci</p>;
    }
    if (editing) {
      return (
        <SlotEditor
          initialSlots={me.doc?.slots}
          defaultTravel={me.rememberedTravel}
          busy={busy}
          onSave={handleEditorSave}
          onCancel={() => setEditing(false)}
          onRemove={me.doc ? handleRemove : null}
        />
      );
    }
    if (askTravel) {
      return <TravelPicker busy={busy} onPick={handleTravelPicked} onCancel={() => setAskTravel(false)} />;
    }
    return (
      <div style={{ marginBottom: '0.75rem' }}>
        {me.onDayShift && (
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>Jsi na denní službě</p>
        )}
        {me.doc ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>✓ Jsem k dispozici</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {me.doc.slots.map(s => `${s.from}–${s.to} (${s.travelMin} min)`).join(', ')}
            </span>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditing(true)}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
              Změnit čas
            </button>
            <button type="button" className="btn" disabled={busy} onClick={handleRemove}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
              Zrušit
            </button>
          </div>
        ) : !me.onDayShift && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleQuickAdd}
              style={{ padding: '0.7rem 1.1rem', fontSize: '1rem', fontWeight: 700 }}>
              Jsem k dispozici ({DAY_START}–{DAY_END})
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setEditing(true)}
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}>
              Jiný čas
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{
        padding: '0.6rem 0.8rem', borderRadius: '8px', background: style.bg, color: style.color,
        border: `1px solid ${style.border}`, fontWeight: 700, marginBottom: '0.75rem',
      }}>
        {style.icon} {formatDateCZ(coverage.date)} — {describeCoverage(coverage)}
      </div>

      {!readOnly && me && renderMine()}

      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
        Kdo je k dispozici
      </div>
      {coverage.people.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Zatím nikdo.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {coverage.people.map(p => (
            <li key={p.uid} style={{
              display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap',
              padding: '0.45rem 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--text-primary)' }}>
                <strong>{p.name}</strong>
                <span style={{ color: 'var(--text-secondary)' }}> · {p.primaryRole || '—'}</span>
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {[p.onDayShift ? 'denní služba · na stanici' : null, describePersonTimes(p) || null].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
