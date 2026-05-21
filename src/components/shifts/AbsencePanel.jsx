import React from 'react';
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
  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r));
  return (
    <section style={{ marginBottom: '2rem' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #7B1FA2, #512DA8)',
          color: 'white',
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
        <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
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
          border: '1px solid #E1BEE7',
          borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          overflow: 'hidden',
          background: 'white'
        }}>
          {absencesData.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9575CD' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
              Žádné absence v tomto měsíci
            </div>
          ) : (
            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {absencesData.map((absence, index) => {
                const canDelete = absence.uid === currentUser?.uid || userRoles.includes('Admin') || userRoles.includes('VJ');
                const isMine = absence.uid === currentUser?.uid;

                const today = new Date();
                const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const isPast = absence.endDate < todayISO;
                const isFuture = absence.startDate > todayISO;

                let cardBg, cardBorder, cardOpacity, badgeBg, statusLabel;
                if (isPast) {
                  cardBg = '#f5f5f5';
                  cardBorder = '1px solid #e0e0e0';
                  cardOpacity = 0.6;
                  badgeBg = 'linear-gradient(135deg, #9E9E9E, #757575)';
                  statusLabel = 'Proběhlo';
                } else if (isFuture) {
                  cardBg = isMine ? '#E8EAF6' : '#FAFAFA';
                  cardBorder = isMine ? '2px dashed #7986CB' : '2px dashed #BDBDBD';
                  cardOpacity = 1;
                  badgeBg = 'linear-gradient(135deg, #5C6BC0, #3949AB)';
                  statusLabel = 'Naplánováno';
                } else {
                  cardBg = isMine ? '#F3E5F5' : '#FAFAFA';
                  cardBorder = isMine ? '1px solid #CE93D8' : '1px solid #eee';
                  cardOpacity = 1;
                  badgeBg = 'linear-gradient(135deg, #9C27B0, #7B1FA2)';
                  statusLabel = null;
                }

                return (
                  <div
                    key={absence.id || index}
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
                      color: 'white',
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
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isPast ? '#888' : '#333' }}>
                          {absence.userName}
                        </span>
                        {statusLabel && (
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            background: isPast ? '#EEEEEE' : '#E8EAF6',
                            color: isPast ? '#757575' : '#3949AB'
                          }}>
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: isPast ? '#aaa' : '#666',
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
                          color: '#E53935',
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
                        onMouseEnter={e => e.currentTarget.style.background = '#FFEBEE'}
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

          {userData?.approved && (
            <div style={{
              padding: '0.75rem',
              borderTop: '1px solid #F3E5F5',
              background: '#FAFAFA'
            }}>
              <button
                className="btn btn-primary"
                onClick={() => setAbsenceModal({ mode: 'add' })}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
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
                    background: '#FFF8E1',
                    border: '1px solid #FFB300',
                    color: '#E65100',
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
