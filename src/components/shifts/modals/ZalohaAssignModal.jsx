import React from 'react';

export default function ZalohaAssignModal({ shiftsData, zalohaAssignModal, onAssign, onClose }) {
  if (!zalohaAssignModal) return null;

  const { day, section } = zalohaAssignModal;
  const sectionData = shiftsData[day]?.[section] || {};
  const assignedUids = Object.keys(sectionData)
    .filter(k => k !== 'config' && k !== 'interested')
    .map(k => sectionData[k]?.uid)
    .filter(Boolean);
    
  const interestedPool = (sectionData.interested || []).filter(u => !assignedUids.includes(u.uid));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Přiřadit uživatele</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Vyberte zájemce pro obsazení této pozice:</p>

          {interestedPool.length === 0 ? (
            <div style={{ padding: '1rem', background: 'var(--surface-alt)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Žádní volní zájemci v tuto chvíli.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {interestedPool.map(user => (
                <button
                  key={user.uid}
                  onClick={() => onAssign(user)}
                  style={{
                    padding: '0.75rem',
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--info)'; e.currentTarget.style.background = 'var(--info-bg-soft)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'white'; }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-charcoal)' }}>{user.name}</span>
                  <span style={{ fontSize: '1.2rem' }}>+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
