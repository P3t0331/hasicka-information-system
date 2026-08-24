import React from 'react';
import SlotChip from './SlotChip';
import { SLOT_TYPES, getZalohaSlots } from './constants';

function ShiftRow({
  day,
  sectionData,
  section,
  onSlotClick,
  onZalohaInterestedClick,
  currentUser,
  onRemoveDayShift,
  onRemoveZaloha,
  isAdmin,
  retroMode,
  isPast
}) {

  const isEmpty = section === 'zalohaStaz'
    ? Object.keys(sectionData || {}).filter(k => k !== 'config' && k !== 'interested').length === 0
    : !sectionData || Object.keys(sectionData).length === 0;
  
  const canRemove = (section === 'dayShift' && onRemoveDayShift && (isEmpty || isAdmin)) || (section === 'zalohaStaz' && onRemoveZaloha && (isEmpty || isAdmin));

  // Dynamic Slot Visibility Logic
  let visibleSlots = [];
  if (section === 'zalohaStaz' && sectionData?.config) {
    visibleSlots = getZalohaSlots(sectionData.config);
  } else {
    visibleSlots = SLOT_TYPES.filter(type => {
      // Always show core slots
      if (['velitel', 'strojnik', 'hasic1', 'hasic2', 'hasic3'].includes(type)) return true;

      // Check occupancy of previous slots for dynamic ones
      const h1Off = !!sectionData?.['hasic1'];
      const h2Off = !!sectionData?.['hasic2'];
      const h3Off = !!sectionData?.['hasic3'];
      const h4Off = !!sectionData?.['hasic4'];

      // Show Hasič 4 if 1, 2, AND 3 are full (or if 4 is already taken)
      if (type === 'hasic4') return (h1Off && h2Off && h3Off) || h4Off;

      // Show Hasič 5 if 4 is full (or if 5 is already taken)
      if (type === 'hasic5') return h4Off || !!sectionData?.['hasic5'];

      return false;
    });
  }

  // Zajemci logic for zalohaStaz
  const assignedUids = Object.keys(sectionData || {})
    .filter(k => k !== 'config' && k !== 'interested')
    .map(k => sectionData[k]?.uid)
    .filter(Boolean);

  const interestedPool = (sectionData?.interested || []).filter(u => !assignedUids.includes(u.uid));
  const isCurrentlyInterested = (sectionData?.interested || []).some(u => u.uid === currentUser?.uid);
  const isAssignedToThis = assignedUids.includes(currentUser?.uid);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'var(--surface)',
      margin: '0.35rem 0.25rem',
      borderRadius: '8px',
      border: day.isToday ? '2px solid var(--gold-text-on-dark)' : '1px solid var(--border)',
      boxShadow: day.isToday ? '0 4px 12px rgba(255, 193, 7, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
      transition: 'transform 0.2s, box-shadow 0.2s',
      overflow: 'hidden',
      position: 'relative'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = day.isToday ? '0 4px 12px rgba(255, 193, 7, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)'; }}
    >
      {/* Date Column */}
      <div style={{
        width: '75px',
        minWidth: '75px',
        padding: '0.25rem',
        borderRight: '1px solid var(--surface-hover)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: day.isToday ? 'linear-gradient(135deg, var(--warning-bg-soft), var(--warning-glow))' : (day.isWeekend ? 'var(--surface-sunken)' : 'var(--surface)'),
        color: day.isToday ? 'var(--warning-amber)' : (day.isWeekend ? 'var(--text-dim)' : 'var(--text-charcoal)'),
        position: 'relative'
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1 }}>{day.date}.</div>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px', opacity: 0.8 }}>
          {day.dayName.slice(0, 3)}
        </div>

        {canRemove && (
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (section === 'dayShift') onRemoveDayShift(day.date);
              else if (section === 'zalohaStaz') onRemoveZaloha(day.date);
            }}
            title="Odebrat prázdnou službu"
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '18px',
              height: '18px',
              border: 'none',
              background: 'rgba(239, 83, 80, 0.1)',
              color: 'var(--danger-hover)',
              borderRadius: '50%',
              fontSize: '1rem',
              lineHeight: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 0 1px 0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-hover)'; e.currentTarget.style.color = 'var(--text-on-dark)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 83, 80, 0.1)'; e.currentTarget.style.color = 'var(--danger-hover)'; }}
          >
            ×
          </button>
        )}
      </div>

      {/* Slots */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem',
        padding: '0.35rem',
        alignItems: 'center'
      }}>
        {visibleSlots.map(slotKey => {
          const assignee = sectionData?.[slotKey];
          const isSelf = assignee?.uid === currentUser?.uid;

          return (
            <SlotChip
              key={slotKey}
              slotKey={slotKey}
              assignee={assignee}
              isSelf={isSelf}
              retroMode={retroMode}
              onClick={() => onSlotClick(day.date, section, slotKey)}
            />
          );
        })}
        
        {/* Zajemci Pool rendering */}
        {section === 'zalohaStaz' && (
          <div style={{ width: '100%', marginTop: '0.5rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              {isPast ? (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-gray)', fontStyle: 'italic', padding: '0.2rem 0' }}>Proběhlo</span>
              ) : (
                <button
                  onClick={() => onZalohaInterestedClick(day.date)}
                  style={{
                    background: isCurrentlyInterested || isAssignedToThis ? 'var(--danger-bg)' : 'var(--info-bg)',
                    color: isCurrentlyInterested || isAssignedToThis ? 'var(--danger)' : 'var(--info-text)',
                    border: isCurrentlyInterested || isAssignedToThis ? '1px solid var(--danger-border)' : '1px solid var(--info-border-soft)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
                >
                    {isCurrentlyInterested || isAssignedToThis ? '✕ Zrušit zájem' : '✋ Mám zájem'}
                </button>
              )}
              
              {interestedPool.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: '0.25rem' }}>Zájemci:</span>
                  {interestedPool.map(u => (
                    <span key={u.uid} style={{
                      background: 'var(--surface-alt)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem'
                    }}>
                      {u.name}
                    </span>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(ShiftRow);
