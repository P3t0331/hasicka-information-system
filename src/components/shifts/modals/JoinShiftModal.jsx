import React, { useState } from 'react';

const SHIFT_DEFAULTS = {
    dayShift:   { timeFrom: '06:00', timeTo: '14:00' },
    nightShift: { timeFrom: '18:00', timeTo: '05:00' },
};

export default function JoinShiftModal({ section, onConfirm, onClose }) {
    const defaults = SHIFT_DEFAULTS[section] || { timeFrom: '06:00', timeTo: '14:00' };

    const [fromHome, setFromHome] = useState(false);
    const [customTime, setCustomTime] = useState(false);
    const [timeFrom, setTimeFrom] = useState(defaults.timeFrom);
    const [timeTo, setTimeTo] = useState(defaults.timeTo);

    const handleConfirm = () => {
        onConfirm({
            fromHome,
            timeFrom: customTime ? timeFrom : null,
            timeTo: customTime ? timeTo : null,
        });
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '1.25rem 1.25rem 1.5rem',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
            }}>
                {/* Handle bar */}
                <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 1rem' }} />

                <h3 style={{ margin: '0 0 1.1rem', fontSize: '1.05rem', color: 'var(--shift-night)' }}>
                    {section === 'dayShift' ? '☀️' : '🌙'} Přihlásit se na službu
                </h3>

                {/* From home toggle */}
                <div
                    onClick={() => setFromHome(v => !v)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        background: fromHome ? 'var(--success-bg)' : 'var(--surface-sunken)',
                        border: fromHome ? '1.5px solid var(--success-text-on-dark)' : '1.5px solid var(--border)',
                        cursor: 'pointer',
                        marginBottom: '0.75rem',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-charcoal)' }}>🏠 Z domu (SMS)</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Pohotovost z domu, poplach přes SMS</div>
                    </div>
                    <div style={{
                        width: '40px', height: '22px',
                        borderRadius: '11px',
                        background: fromHome ? 'var(--success-bright)' : 'var(--border)',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '3px',
                            left: fromHome ? '21px' : '3px',
                            width: '16px', height: '16px',
                            borderRadius: '50%',
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                            transition: 'left 0.2s',
                        }} />
                    </div>
                </div>

                {/* Custom time toggle */}
                <div
                    onClick={() => setCustomTime(v => !v)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.85rem 1rem',
                        borderRadius: customTime ? '10px 10px 0 0' : '10px',
                        background: customTime ? 'var(--info-bg)' : 'var(--surface-sunken)',
                        border: customTime ? '1.5px solid var(--info-border)' : '1.5px solid var(--border)',
                        borderBottom: customTime ? 'none' : undefined,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        userSelect: 'none',
                    }}
                >
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-charcoal)' }}>⏰ Zkrácená služba</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Budu přítomen jen část služby</div>
                    </div>
                    <div style={{
                        width: '40px', height: '22px',
                        borderRadius: '11px',
                        background: customTime ? 'var(--info-bright)' : 'var(--border)',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '3px',
                            left: customTime ? '21px' : '3px',
                            width: '16px', height: '16px',
                            borderRadius: '50%',
                            background: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                            transition: 'left 0.2s',
                        }} />
                    </div>
                </div>

                {/* Time inputs (shown when custom time is on) */}
                {customTime && (
                    <div style={{
                        display: 'flex', gap: '0.75rem', alignItems: 'center',
                        padding: '0.85rem 1rem',
                        background: 'var(--info-bg)',
                        border: '1.5px solid var(--info-border)',
                        borderTop: '1px solid var(--info-border-soft)',
                        borderRadius: '0 0 10px 10px',
                        marginBottom: '0',
                    }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--info-text)', marginBottom: '0.3rem' }}>OD</label>
                            <input
                                type="time"
                                value={timeFrom}
                                onChange={e => setTimeFrom(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.55rem 0.5rem',
                                    borderRadius: '8px', border: '1.5px solid var(--info-border)',
                                    fontSize: '1rem', fontWeight: 600, textAlign: 'center',
                                    background: 'white', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div style={{ paddingTop: '1.2rem', color: 'var(--info-border)', fontWeight: 700 }}>→</div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--info-text)', marginBottom: '0.3rem' }}>DO</label>
                            <input
                                type="time"
                                value={timeTo}
                                onChange={e => setTimeTo(e.target.value)}
                                style={{
                                    width: '100%', padding: '0.55rem 0.5rem',
                                    borderRadius: '8px', border: '1.5px solid var(--info-border)',
                                    fontSize: '1rem', fontWeight: 600, textAlign: 'center',
                                    background: 'white', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1, padding: '0.85rem',
                            borderRadius: '10px', border: '1.5px solid var(--border)',
                            background: 'white', color: 'var(--text-secondary)',
                            fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Zrušit
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{
                            flex: 2, padding: '0.85rem',
                            borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, var(--table-header-dark), var(--shift-night))',
                            color: 'white',
                            fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(55,71,79,0.3)',
                        }}
                    >
                        Přihlásit se
                    </button>
                </div>
            </div>
        </div>
    );
}
