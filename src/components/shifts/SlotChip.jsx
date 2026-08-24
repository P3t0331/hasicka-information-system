import React from 'react';
import { SLOT_LABELS, SLOT_ICONS } from './constants';

export default function SlotChip({ slotKey, assignee, isSelf, onClick, retroMode }) {
  const isUnqualified = assignee && assignee.qualified === false;
  const isOccupied = !!assignee;

  let bg = 'var(--surface)';
  let border = '1px dashed var(--border)';
  let color = 'var(--text-gray)';
  let shadow = 'none';

  if (isOccupied) {
    border = '1px solid transparent';
    shadow = '0 1px 2px rgba(0,0,0,0.05)';
    if (isSelf) {
      bg = isUnqualified ? 'var(--warning-bg)' : 'var(--success-bg)';
      border = isUnqualified ? '1px solid var(--warning-border-warm)' : '1px solid var(--success-border)';
      color = isUnqualified ? 'var(--warning-text)' : 'var(--success-text)';
    } else {
      bg = isUnqualified ? 'var(--warning-bg-soft)' : 'linear-gradient(to bottom, var(--surface-alt), var(--surface-hover))';
      border = isUnqualified ? '1px solid var(--warning-border)' : '1px solid var(--border)';
      color = isUnqualified ? 'var(--warning)' : 'var(--text-charcoal)';
    }
  } else if (retroMode) {
    border = '1px dashed var(--warning-strong)';
    color = 'var(--warning-dark)';
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
        if (!isOccupied) e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadow;
        if (!isOccupied) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{
        width: '26px', height: '26px',
        borderRadius: '50%',
        background: isOccupied ? 'var(--surface)' : 'var(--surface-alt)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.9rem',
        boxShadow: isOccupied ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
        flexShrink: 0
      }}>
        {isOccupied && assignee.name ? (
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {icon}
          </span>
        ) : (
          <span style={{ opacity: 0.5 }}>{icon}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', lineHeight: 1.1 }}>
        <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
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
        {isOccupied && (assignee.fromHome || assignee.timeFrom) && (
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
            {assignee.fromHome && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 700,
                padding: '1px 4px', borderRadius: '3px',
                background: isSelf ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.07)',
                color: isSelf ? 'var(--success-dark)' : 'var(--text-secondary)'
              }}>
                🏠 SMS
              </span>
            )}
            {assignee.timeFrom && assignee.timeTo && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 700,
                padding: '1px 4px', borderRadius: '3px',
                background: isSelf ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.07)',
                color: isSelf ? 'var(--success-dark)' : 'var(--text-secondary)'
              }}>
                ⏰ {assignee.timeFrom}–{assignee.timeTo}
              </span>
            )}
          </div>
        )}
      </div>

      {!isOccupied && (
        <div style={{ fontSize: '0.9rem', color: retroMode ? 'var(--warning-strong)' : 'var(--border-medium)', fontWeight: 300 }}>
          {retroMode ? '⏱' : '+'}
        </div>
      )}
    </div>
  );
}
