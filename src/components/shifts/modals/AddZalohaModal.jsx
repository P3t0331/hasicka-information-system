import React, { useState } from 'react';
import { getZalohaSlots, getZalohaAssignedSlots, getSlotLabel, getZalohaKind, ZALOHA_KINDS } from '../constants';

export default function AddZalohaModal({ date, mode = 'add', initialConfig, sectionData, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const [kind, setKind] = useState(getZalohaKind(initialConfig));
  const [timeFrom, setTimeFrom] = useState(initialConfig?.timeFrom || '07:00');
  const [timeTo, setTimeTo] = useState(initialConfig?.timeTo || '19:00');
  const [velitelCount, setVelitelCount] = useState(initialConfig?.velitelCount || 1);
  const [strojnikCount, setStrojnikCount] = useState(initialConfig?.strojnikCount || 1);
  const [hasicCount, setHasicCount] = useState(initialConfig?.hasicCount || 2);

  // Lowering a count hides slots — warn about anyone who would lose their position.
  const keptSlots = getZalohaSlots({ velitelCount, strojnikCount, hasicCount });
  const droppedAssignees = isEdit
    ? getZalohaAssignedSlots(sectionData)
        .filter(([slotKey]) => !keptSlots.includes(slotKey))
        .map(([slotKey, assignee]) => `${getSlotLabel(slotKey)} – ${assignee.name}`)
    : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      kind,
      timeFrom,
      timeTo,
      velitelCount,
      strojnikCount,
      hasicCount
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '1.5rem', borderRadius: '12px', background: 'white' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1565C0', textAlign: 'center' }}>
          🛡️ {isEdit ? 'Upravit Zálohu / Stáž' : 'Záloha / Stáž'} ({date}.)
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Typ služby:</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {ZALOHA_KINDS.map(k => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  style={{
                    flex: 1,
                    padding: '0.7rem',
                    borderRadius: '8px',
                    border: kind === k.value ? '2px solid #1976D2' : '2px solid #E0E0E0',
                    background: kind === k.value ? '#E3F2FD' : 'white',
                    color: kind === k.value ? '#0D47A1' : '#666',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {k.icon} {k.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Čas OD:</label>
              <input
                type="time"
                value={timeFrom}
                onChange={e => setTimeFrom(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #BBDEFB', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Čas DO:</label>
              <input
                type="time"
                value={timeTo}
                onChange={e => setTimeTo(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #BBDEFB', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Velitel (1-2)</label>
               <input type="number" min="1" max="2" value={velitelCount} onChange={e => setVelitelCount(parseInt(e.target.value)||1)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Strojník (1-2)</label>
               <input type="number" min="1" max="2" value={strojnikCount} onChange={e => setStrojnikCount(parseInt(e.target.value)||1)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Hasič (2-5)</label>
               <input type="number" min="2" max="5" value={hasicCount} onChange={e => setHasicCount(parseInt(e.target.value)||2)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
          </div>

          {droppedAssignees.length > 0 && (
            <div style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: '#E65100' }}>
              ⚠️ Snížením počtu budou z pozic odebráni: {droppedAssignees.join(', ')}. Zůstanou v seznamu zájemců.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: '2px solid #BBDEFB', background: 'white', color: '#1565C0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>Zrušit</button>
            <button type="submit" style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #1976D2, #1565C0)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)' }}>{isEdit ? 'Uložit' : 'Vytvořit'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
