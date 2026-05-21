import React from 'react';

export function ChartBlock({ title, children, height = 280 }) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#444' }}>{title}</h3>
            </div>
            <div style={{ padding: '1rem 0.25rem', height }}>
                {children}
            </div>
        </div>
    );
}

export function ChartTooltip({ active, payload, label, unit = 'h' }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'white', border: '1px solid #eee', borderRadius: 8,
            padding: '0.5rem 0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontSize: '0.8rem', maxWidth: 200
        }}>
            {label !== undefined && label !== '' && (
                <div style={{ fontWeight: 600, marginBottom: '0.3rem', color: '#333' }}>{label}.</div>
            )}
            {payload.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#333', marginTop: i > 0 ? '0.2rem' : 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || entry.fill, display: 'inline-block', flexShrink: 0 }} />
                    <span>
                        {entry.name}:{' '}
                        <strong>
                            {typeof entry.value === 'number'
                                ? (entry.value % 1 === 0 ? entry.value : entry.value.toFixed(1))
                                : entry.value}
                            {unit}
                        </strong>
                    </span>
                </div>
            ))}
        </div>
    );
}

const RADIAN = Math.PI / 180;
export function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
}
