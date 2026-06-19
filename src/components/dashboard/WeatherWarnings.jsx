import React, { useState, useEffect, useRef, useCallback } from 'react';

const EVENT_ICONS = {
    'High Temperatures': '🌡️',
    'Low Temperatures': '🥶',
    'Wind': '💨',
    'Snow/Ice': '🌨️',
    'Thunderstorms': '⛈️',
    'Rain': '🌧️',
    'Fog': '🌫️',
    'Flooding': '🌊',
    'Danger of Fires': '🔥',
    'Avalanches': '🏔️',
    'Coastal Event': '🌊',
};

const EVENT_NAMES = {
    'High Temperatures': 'Vysoké teploty',
    'Low Temperatures': 'Nízké teploty',
    'Wind': 'Silný vítr',
    'Snow/Ice': 'Sníh / náledí',
    'Thunderstorms': 'Bouřky',
    'Rain': 'Silný déšť',
    'Fog': 'Hustá mlha',
    'Flooding': 'Povodně',
    'Danger of Fires': 'Nebezpečí požárů',
    'Avalanches': 'Laviny',
    'Coastal Event': 'Pobřežní událost',
};

const SEVERITY_LABELS = {
    'Extreme': 'Extrémní',
    'Severe': 'Silná',
    'Moderate': 'Střední',
    'Minor': 'Nízká',
};

const SEVERITY_COLORS = {
    'Extreme': '#C62828',
    'Severe': '#E65100',
    'Moderate': '#F9A825',
    'Minor': '#F9A825',
};

const SEVERITY_ORDER = { 'Extreme': 0, 'Severe': 1, 'Moderate': 2, 'Minor': 3 };

export default function WeatherWarnings() {
    const [warnings, setWarnings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timerText, setTimerText] = useState('');
    const [expandedKeys, setExpandedKeys] = useState(new Set());
    const nextUpdateRef = useRef(null);

    const toggleExpanded = (key) => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const fetchWarnings = useCallback(async () => {
        try {
            const CACHE_DURATION = 30 * 60 * 1000;
            const cached = localStorage.getItem('meteoalarmCache');
            const cachedTime = localStorage.getItem('meteoalarmTimestamp');

            let data = null;
            let targetTime = 0;

            if (cached && cachedTime) {
                const age = Date.now() - parseInt(cachedTime, 10);
                if (age < CACHE_DURATION) {
                    data = JSON.parse(cached);
                    targetTime = parseInt(cachedTime, 10) + CACHE_DURATION;
                }
            }

            if (!data) {
                const res = await fetch('/api/weather-warnings');
                if (!res.ok) throw new Error('Chyba při načítání výstrah');
                data = await res.json();
                localStorage.setItem('meteoalarmCache', JSON.stringify(data));
                localStorage.setItem('meteoalarmTimestamp', Date.now().toString());
                targetTime = Date.now() + CACHE_DURATION;
            }

            setWarnings((data.warnings || [])
                .filter(w => !w.expires || new Date(w.expires) > new Date())
                .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
            );
            setError(null);
            nextUpdateRef.current = targetTime;
        } catch (err) {
            console.error('WeatherWarnings error:', err);
            setError('Nepodařilo se načíst výstrahy.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWarnings();
        const interval = setInterval(() => {
            if (!nextUpdateRef.current) return;
            const diff = nextUpdateRef.current - Date.now();
            if (diff <= 0) {
                setTimerText('Aktualizuji...');
                nextUpdateRef.current = null;
                fetchWarnings();
            } else {
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                setTimerText(`Aktualizace za ${m}:${s.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [fetchWarnings]);

    const SectionHeader = ({ icon, title }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#333', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>{icon}</span>{title}
            </h2>
            {timerText && (
                <span style={{ fontSize: '0.7rem', color: '#999', background: '#f0f0f0', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
                    {timerText}
                </span>
            )}
        </div>
    );

    if (loading) return null;

    if (error) return (
        <div style={{ padding: '0.6rem 1rem', color: '#c62828', fontSize: '0.82rem', background: '#ffebee', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #ffcdd2' }}>
            ⚠️ {error}
        </div>
    );

    if (warnings.length === 0) return (
        <section style={{ marginBottom: '1.75rem' }}>
            <SectionHeader icon="🌤️" title="Počasí a výstrahy" />
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.875rem',
                padding: '0.875rem 1rem', borderRadius: '12px',
                background: 'linear-gradient(135deg, #E8F5E9, #F1F8E9)',
                border: '1px solid #C8E6C9'
            }}>
                <div style={{ fontSize: '1.75rem', lineHeight: 1 }}>✅</div>
                <div>
                    <div style={{ fontWeight: 700, color: '#2E7D32', fontSize: '0.95rem' }}>Bez výstrah</div>
                    <div style={{ fontSize: '0.8rem', color: '#558B2F', marginTop: '0.1rem' }}>Oblast Brno — žádné výstrahy ČHMÚ</div>
                </div>
            </div>
        </section>
    );

    return (
        <section style={{ marginBottom: '1.75rem' }}>
            <SectionHeader icon="⚠️" title="Meteorologické výstrahy" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {warnings.map((w, i) => {
                    const color = SEVERITY_COLORS[w.severity] || '#F9A825';
                    const name = w.eventCz || EVENT_NAMES[w.event] || w.event;
                    const icon = EVENT_ICONS[w.event] || '⚠️';
                    const sevLabel = SEVERITY_LABELS[w.severity] || w.severity;
                    const fmt = dt => dt ? new Date(dt).toLocaleString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    const onset = fmt(w.onset);
                    const expires = fmt(w.expires);

                    return (
                        <div key={i} style={{
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                            border: `1px solid ${color}30`
                        }}>
                            {/* Color bar + header */}
                            <div style={{
                                background: color,
                                padding: '0.6rem 1rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{icon}</span>
                                    <span style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{name}</span>
                                </div>
                                <span style={{
                                    background: 'rgba(255,255,255,0.25)',
                                    color: 'white', fontSize: '0.75rem', fontWeight: 600,
                                    padding: '0.2rem 0.6rem', borderRadius: '20px'
                                }}>
                                    {sevLabel}
                                </span>
                            </div>
                            {/* Always-visible: times row */}
                            <div style={{ background: 'white', padding: '0.6rem 1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {onset && (
                                        <div style={{ fontSize: '0.8rem', color: '#555' }}>
                                            <span style={{ color: '#999', marginRight: '0.25rem' }}>Od</span>
                                            <strong>{onset}</strong>
                                        </div>
                                    )}
                                    {expires && (
                                        <div style={{ fontSize: '0.8rem', color: '#555' }}>
                                            <span style={{ color: '#999', marginRight: '0.25rem' }}>Do</span>
                                            <strong>{expires}</strong>
                                        </div>
                                    )}
                                    {(w.description || w.instruction) && (
                                        <button
                                            onClick={() => toggleExpanded(i)}
                                            style={{
                                                marginLeft: 'auto',
                                                background: 'none',
                                                border: `1px solid ${color}60`,
                                                color: color,
                                                borderRadius: '6px',
                                                padding: '0.2rem 0.6rem',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {expandedKeys.has(i) ? 'Skrýt detail ▲' : 'Zobrazit detail ▼'}
                                        </button>
                                    )}
                                </div>
                                {/* Collapsible: description + instruction */}
                                {expandedKeys.has(i) && (
                                    <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #f0f0f0' }}>
                                        {w.description && (
                                            <div style={{ fontSize: '0.88rem', color: '#333', marginBottom: '0.5rem', fontWeight: 500 }}>
                                                {w.description}
                                            </div>
                                        )}
                                        {w.instruction && (
                                            <div style={{ fontSize: '0.8rem', color: '#555', lineHeight: 1.5, borderLeft: `3px solid ${color}50`, paddingLeft: '0.6rem' }}>
                                                {w.instruction}
                                            </div>
                                        )}
                                        <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: '#bbb', textAlign: 'right' }}>
                                            ČHMÚ / Meteoalarm
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
