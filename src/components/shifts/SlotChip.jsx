import React from 'react';
import { SLOT_LABELS, SLOT_ICONS } from './constants';

export default function SlotChip({ slotKey, assignee, isSelf, onClick }) {
  const isUnqualified = assignee && assignee.qualified === false;
  const isOccupied = !!assignee;

  let bg = 'white';
  let border = '1px dashed #ddd';
  let color = '#999';
  let shadow = 'none';

  if (isOccupied) {
    border = '1px solid transparent';
    shadow = '0 1px 2px rgba(0,0,0,0.05)';
    if (isSelf) {
      bg = isUnqualified ? '#FFF3E0' : '#E8F5E9';
      border = isUnqualified ? '1px solid #FFE0B2' : '1px solid #C8E6C9';
      color = isUnqualified ? '#EF6C00' : '#2E7D32';
    } else {
      bg = isUnqualified ? '#FFF8E1' : 'linear-gradient(to bottom, #f5f5f5, #eeeeee)';
      border = isUnqualified ? '1px solid #FFCC80' : '1px solid #e0e0e0';
      color = isUnqualified ? '#F57C00' : '#424242';
    }
  }

  const icon = SLOT_ICONS[slotKey] || '👤';

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: border,
        borderRadius: '6px',
        padding: '0.3rem 0.5rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        transition: 'all 0.2s ease',
        minWidth: '110px',
        maxWidth: '160px',
        flex: '1 1 auto',
        boxShadow: shadow,
        position: 'relative',
        opacity: isOccupied ? 1 : 0.8
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        if (!isOccupied) e.currentTarget.style.borderColor = '#bbb';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadow;
        if (!isOccupied) e.currentTarget.style.borderColor = '#ddd';
      }}
    >
      <div style={{
        width: '26px', height: '26px',
        borderRadius: '50%',
        background: isOccupied ? 'white' : '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.9rem',
        boxShadow: isOccupied ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
        flexShrink: 0
      }}>
        {isOccupied && assignee.name ? (
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#555' }}>
            {icon}
          </span>
        ) : (
          <span style={{ opacity: 0.5 }}>{icon}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', lineHeight: 1.1 }}>
        <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: '#888', fontWeight: 600, letterSpacing: '0.5px' }}>
          {SLOT_LABELS[slotKey]}
        </span>
        <span style={{
          fontSize: '0.85rem',
          fontWeight: isOccupied ? 700 : 500,
          color: color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {isOccupied ? assignee.name : 'Volno'}
        </span>
      </div>

      {!isOccupied && (
        <div style={{ fontSize: '0.9rem', color: '#ccc', fontWeight: 300 }}>+</div>
      )}
    </div>
  );
}
