import React, { useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAvailabilityData, useAvailabilityActions } from '../../../hooks/useAvailability';
import { toISODate, addDays, WINDOW_DAYS, computeDayCoverage, isAbsentOn } from '../../../../shared/availability.js';
import DayStrip from './DayStrip';
import DayPanel from './DayPanel';
import AvailabilityHelp from './AvailabilityHelp';

export default function AvailabilityCard() {
  const { currentUser } = useAuth();
  const todayISO = toISODate(new Date());
  const endISO = addDays(todayISO, WINDOW_DAYS - 1);
  const { loading, availabilityDocs, absences, members, dayShiftsByDate } = useAvailabilityData(todayISO, endISO);
  const { busy, saveDay, removeDay, copyWeek } = useAvailabilityActions();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [showHelp, setShowHelp] = useState(false);

  // Po půlnoci může vybraný den zůstat v minulosti — minulé dny nelze upravovat.
  const activeDate = selectedDate < todayISO || selectedDate > endISO ? todayISO : selectedDate;
  const uid = currentUser?.uid;

  const days = useMemo(() => Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(todayISO, i);
    return computeDayCoverage({ date, members, availabilityDocs, absences, dayShift: dayShiftsByDate[date] });
  }), [todayISO, members, availabilityDocs, absences, dayShiftsByDate]);

  const myAbsentDates = useMemo(
    () => new Set(days.filter(d => isAbsentOn(absences, uid, d.date)).map(d => d.date)),
    [days, absences, uid],
  );

  const selectedCoverage = days.find(d => d.date === activeDate) || days[0];
  const myDoc = availabilityDocs.find(d => d.uid === uid && d.date === activeDate);
  const me = {
    doc: myDoc,
    absent: myAbsentDates.has(activeDate),
    onDayShift: Object.values(dayShiftsByDate[activeDate] || {}).some(s => s?.uid === uid),
  };

  return (
    <section className="dashboard-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', margin: 0 }}>🚑 Dostupnost k výjezdu</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>2× Hasič · 1× Strojník · 1× Velitel</div>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(v => !v)}
          aria-expanded={showHelp}
          aria-controls="availability-help"
          aria-label="Nápověda k dostupnosti"
          title="K čemu to je?"
          style={{
            flex: '0 0 auto', width: '1.9rem', height: '1.9rem', borderRadius: '50%',
            border: '1px solid var(--border)', background: showHelp ? 'var(--indigo-bg)' : 'var(--surface-alt)',
            color: 'var(--text-secondary)', fontWeight: 800, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ?
        </button>
      </div>

      {showHelp && <AvailabilityHelp onClose={() => setShowHelp(false)} />}

      <DayStrip
        days={days}
        selectedDate={activeDate}
        onSelect={setSelectedDate}
        myUid={uid}
        myAbsentDates={myAbsentDates}
        loading={loading}
      />

      {!loading && (
        <DayPanel
          key={activeDate}
          coverage={selectedCoverage}
          me={me}
          busy={busy}
          onSave={(slots) => saveDay(activeDate, slots, myDoc?.slots)}
          onRemove={() => removeDay(activeDate, myDoc?.slots)}
        />
      )}

      <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || loading}
          onClick={() => copyWeek({ todayISO, availabilityDocs, absences })}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          Opakovat na další týden
        </button>
      </div>
    </section>
  );
}
