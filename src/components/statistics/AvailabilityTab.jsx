import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAvailabilityData } from '../../hooks/useAvailability';
import { summarizeMonth, toISODate, CREW_SIZE } from '../../../shared/availability.js';
import StatCard from './StatCard';
import { ChartBlock } from './ChartComponents';
import DayPanel from '../dashboard/availability/DayPanel';
import { STATUS_STYLE } from '../dashboard/availability/statusStyle';

const WEEKDAYS_MON_FIRST = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const pad = (n) => String(n).padStart(2, '0');

function MemberTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.fullName}</div>
      <div style={{ color: 'var(--text-secondary)' }}>{row.hours} h k dispozici</div>
      {row.avgTravelMin !== null && <div style={{ color: 'var(--text-secondary)' }}>Průměrný dojezd {row.avgTravelMin} min</div>}
    </div>
  );
}

export default function AvailabilityTab({ currentDate }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const todayISO = toISODate(new Date());

  const { loading, availabilityDocs, absences, members, dayShiftsByDate } = useAvailabilityData(monthStart, monthEnd);
  const [selectedDate, setSelectedDate] = useState(null);

  const summary = summarizeMonth({ year, month, todayISO, members, availabilityDocs, absences, dayShiftsByDate });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Načítám dostupnost…</div>;
  }

  if (monthStart > todayISO) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Tento měsíc ještě nezačal.</div>;
  }

  const byDate = new Map(summary.perDay.map(d => [d.date, d]));
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedCoverage = selectedDate ? byDate.get(selectedDate) : null;

  const missingData = [
    { name: 'Velitel', dni: summary.missingByPosition.Velitel },
    { name: 'Strojník', dni: summary.missingByPosition['Strojník'] },
    { name: 'Hasič', dni: summary.missingByPosition['Hasič'] },
  ];
  const memberData = summary.memberHours.map(m => ({
    name: m.name.split(' ')[0],
    fullName: m.name,
    hours: m.hours,
    avgTravelMin: m.avgTravelMin,
  }));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <StatCard icon={STATUS_STYLE.complete.icon} value={summary.counts.complete} label="Kompletní dny"
          sublabel={`plná posádka ${CREW_SIZE}/${CREW_SIZE} celý den`} color={STATUS_STYLE.complete.color} bg={STATUS_STYLE.complete.bg} />
        <StatCard icon={STATUS_STYLE.partial.icon} value={summary.counts.partial} label="Částečně"
          sublabel="plná posádka jen část dne" color={STATUS_STYLE.partial.color} bg={STATUS_STYLE.partial.bg} />
        <StatCard icon={STATUS_STYLE.missing.icon} value={summary.counts.missing} label="Chybí"
          sublabel="plná posádka ani chvíli" color={STATUS_STYLE.missing.color} bg={STATUS_STYLE.missing.bg} />
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: 'var(--text-charcoal)' }}>📅 Přehled měsíce</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.3rem' }}>
          {WEEKDAYS_MON_FIRST.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{w}</div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}
          {Array.from({ length: lastDay }, (_, i) => {
            const date = `${year}-${pad(month)}-${pad(i + 1)}`;
            const coverage = byDate.get(date);
            const style = coverage ? STATUS_STYLE[coverage.status] : null;
            return (
              <button
                key={date}
                type="button"
                disabled={!coverage}
                onClick={() => setSelectedDate(date)}
                aria-pressed={selectedDate === date}
                style={{
                  padding: '0.45rem 0',
                  borderRadius: '6px',
                  border: `2px solid ${selectedDate === date ? 'var(--text-primary)' : 'transparent'}`,
                  background: style ? style.bg : 'var(--surface-alt)',
                  color: style ? style.color : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: coverage ? 'pointer' : 'default',
                  opacity: coverage ? 1 : 0.5,
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {selectedCoverage && (
          <div style={{ marginTop: '1rem' }}>
            <DayPanel key={selectedCoverage.date} coverage={selectedCoverage} readOnly />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <ChartBlock title="🔍 Nejčastěji chybí (dny)" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={missingData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-hover)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value} dní`, 'Chyběl']} />
              <Bar dataKey="dni" fill="var(--danger)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBlock>

        {memberData.length > 0 ? (
          <ChartBlock title="🙋 Dostupnost členů (hodiny)" height={Math.max(200, memberData.length * 36 + 40)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} layout="vertical" margin={{ top: 5, right: 24, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-hover)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                <Tooltip content={<MemberTooltip />} />
                <Bar dataKey="hours" fill="var(--indigo)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
        ) : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            V tomto měsíci zatím nikdo nezadal dostupnost.
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Počítá se do dneška. Minulé měsíce se vyhodnocují podle aktuálních rolí členů.
      </p>
    </>
  );
}
