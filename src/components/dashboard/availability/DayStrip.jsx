import React from 'react';
import { CREW_SIZE } from '../../../../shared/availability.js';
import { STATUS_STYLE } from './statusStyle';

const WEEKDAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

export default function DayStrip({ days, selectedDate, onSelect, myUid, myAbsentDates, loading }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
      {days.map((coverage) => {
        const [y, m, d] = coverage.date.split('-').map(Number);
        const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
        const style = STATUS_STYLE[coverage.status];
        const selected = coverage.date === selectedDate;
        const mine = coverage.people.some(p => p.uid === myUid);
        const absent = myAbsentDates.has(coverage.date);

        return (
          <button
            key={coverage.date}
            type="button"
            onClick={() => onSelect(coverage.date)}
            aria-pressed={selected}
            aria-label={`${weekday} ${d}. ${m}.`}
            style={{
              flex: '0 0 auto',
              minWidth: '3.6rem',
              padding: '0.45rem 0.3rem',
              borderRadius: '10px',
              border: `2px solid ${selected ? 'var(--text-primary)' : mine && !loading ? style.border : 'transparent'}`,
              background: loading ? 'var(--surface-alt)' : style.bg,
              color: loading ? 'var(--text-muted)' : style.color,
              opacity: absent ? 0.45 : 1,
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{weekday}</div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{d}.</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>{loading ? '…' : `${coverage.filled}/${CREW_SIZE}`}</div>
            {mine && !loading && <div style={{ fontSize: '0.6rem', fontWeight: 700 }}>✓ já</div>}
          </button>
        );
      })}
    </div>
  );
}
