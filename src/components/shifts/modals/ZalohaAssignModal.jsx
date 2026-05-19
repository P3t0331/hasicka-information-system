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
          <p style={{ marginBottom: '1rem', color: '#555' }}>Vyberte zájemce pro obsazení této pozice:</p>
          
          {interestedPool.length === 0 ? (
            <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', color: '#888' }}>
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
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#1976D2'; e.currentTarget.style.background = '#F5F9FF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white'; }}
                >
                  <span style={{ fontWeight: 600, color: '#333' }}>{user.name}</span>
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
