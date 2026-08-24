import React, { useState } from 'react';
import { formatDateCZ } from './constants';

export default function AbsencePanel({
  absencesData,
  currentUser,
  userRoles,
  handleDeleteAbsence,
  setAbsenceModal,
  userData,
  absencePanelOpen,
  setAbsencePanelOpen,
  retroMode,
  onAddAbsenceForOther
}) {
  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Přístup do Administrace'].includes(r));
  const [showPast, setShowPast] = useState(false);

  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const activeAbsences = absencesData
    .filter(a => a.endDate >= todayISO)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
  const pastAbsences = absencesData
    .filter(a => a.endDate < todayISO)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate)); // chronological order

  const displayAbsences = showPast ? [...activeAbsences, ...pastAbsences] : activeAbsences;

  return (
    <section style={{ marginBottom: '2rem' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-purple-deep))',
          color: 'var(--text-on-dark)',
          padding: '0.75rem 1rem',
          borderRadius: absencePanelOpen ? '12px 12px 0 0' : '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(123, 31, 162, 0.3)'
        }}
        onClick={() => setAbsencePanelOpen(!absencePanelOpen)}
      >
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-on-dark)' }}>
          🚫 Absence
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {absencesData.length > 0 && (
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '0.2rem 0.6rem',
              borderRadius: '12px',
              fontSize: '0.8rem'
            }}>
              {absencesData.length}
            </span>
          )}
          <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
            {absencePanelOpen ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {absencePanelOpen && (
        <div style={{
          border: '1px solid var(--accent-purple-border)',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          background: 'var(--surface)'
        }}>
          {displayAbsences.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-purple-light)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
              Žádné {showPast ? '' : 'nadcházející'} absence v tomto měsíci
            </div>
          ) : (
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {displayAbsences.map((absence, index) => {
                const canDelete = absence.uid === currentUser?.uid || userRoles.includes('Admin') || userRoles.includes('VJ') || userRoles.includes('Přístup do Administrace');
                const isMine = absence.uid === currentUser?.uid;

                const isPast = absence.endDate < todayISO;
                const isFuture = absence.startDate > todayISO;

                let cardBg, cardBorder, cardOpacity, badgeBg, statusLabel;
                if (isPast) {
                  cardBg = 'var(--surface-alt)';
                  cardBorder = '1px solid var(--border)';
                  cardOpacity = 0.6;
                  badgeBg = 'linear-gradient(135deg, var(--text-gray), var(--text-dim))';
                  statusLabel = 'Proběhlo';
                } else if (isFuture) {
                  cardBg = isMine ? 'var(--indigo-bg)' : 'var(--surface-sunken)';
                  cardBorder = isMine ? '2px dashed var(--indigo)' : '2px dashed var(--border-strong)';
                  cardOpacity = 1;
                  badgeBg = 'linear-gradient(135deg, var(--indigo-dark), var(--indigo-deep))';
                  statusLabel = 'Naplánováno';
                } else {
                  cardBg = isMine ? 'var(--accent-purple-bg)' : 'var(--surface-sunken)';
                  cardBorder = isMine ? '1px solid var(--accent-purple-border-soft)' : '1px solid var(--surface-hover)';
                  cardOpacity = 1;
                  badgeBg = 'linear-gradient(135deg, var(--accent-purple-bright), var(--accent-purple))';
                  statusLabel = null;
                }

                return (
                  <div
                    key={absence.id || `${absence.uid}-${absence.startDate}-${absence.endDate}-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      background: cardBg,
                      borderRadius: '8px',
                      border: cardBorder,
                      opacity: cardOpacity,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    <div style={{
                      background: badgeBg,
                      color: 'var(--text-on-dark)',
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      minWidth: '55px',
                      textAlign: 'center'
                    }}>
                      {absence.startDate === absence.endDate
                        ? formatDateCZ(absence.startDate)
                        : `${formatDateCZ(absence.startDate)}-${formatDateCZ(absence.endDate)}`}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isPast ? 'var(--text-muted)' : 'var(--text-charcoal)' }}>
                          {absence.userName}
                        </span>
                        {statusLabel && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: isPast ? 'var(--surface-hover)' : 'var(--indigo-bg)',
                            color: isPast ? 'var(--text-dim)' : 'var(--indigo-deep)'
                          }}>
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: isPast ? 'var(--text-subtle)' : 'var(--text-steel)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {absence.reason}
                      </div>
                    </div>

                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAbsence(absence); }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger-hover)',
                          cursor: 'pointer',
                          fontSize: '1.1rem',
                          padding: '0.3rem',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.2s',
                          flexShrink: 0
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--danger-bg)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pastAbsences.length > 0 && (
            <div style={{ padding: '0.5rem', textAlign: 'center', background: 'var(--surface-sunken)', borderTop: '1px solid var(--accent-purple-bg)' }}>
              <button
                onClick={() => setShowPast(!showPast)}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent-purple)',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {showPast ? 'Skrýt historii' : `Zobrazit historii (${pastAbsences.length})`}
              </button>
            </div>
          )}

          {userData?.approved && (
            <div style={{
              padding: '0.75rem',
              borderTop: '1px solid var(--accent-purple-bg)',
              background: 'var(--surface-sunken)'
            }}>
              <button
                className="btn btn-primary"
                onClick={() => setAbsenceModal({ mode: 'add' })}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, var(--accent-purple-bright), var(--accent-purple))',
                  border: 'none',
                  padding: '0.7rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                + Přidat mou absenci
              </button>
              {retroMode && isAdmin && (
                <button
                  className="btn"
                  onClick={onAddAbsenceForOther}
                  style={{
                    width: '100%',
                    marginTop: '0.5rem',
                    background: 'var(--warning-bg-soft)',
                    border: '1px solid var(--warning-strong)',
                    color: 'var(--warning-dark)',
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ⏱ Přidat absenci za člena
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
