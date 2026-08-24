import React from 'react';

export default function StatCard({ icon, value, label, sublabel, color, bg }) {
    return (
        <div
            className="card"
            style={{
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
        >
            <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: bg,
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem'
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-charcoal)', lineHeight: 1 }}>
                    {value}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {label}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-gray)' }}>
                    {sublabel}
                </div>
            </div>
        </div>
    );
}
