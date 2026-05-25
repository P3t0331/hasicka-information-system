import React, { useState, useEffect, useRef, useCallback } from 'react';

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
    'Extreme': '#D32F2F',
    'Severe': '#E64A19',
    'Moderate': '#F57C00',
    'Minor': '#FBC02D',
};

const SEVERITY_BG = {
    'Extreme': '#FFEBEE',
    'Severe': '#FBE9E7',
    'Moderate': '#FFF3E0',
    'Minor': '#FFFDE7',
};

export default function WeatherWarnings() {
    const [warnings, setWarnings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timerText, setTimerText] = useState('');
    const nextUpdateRef = useRef(null);

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

            setWarnings(data.warnings || []);
            nextUpdateRef.current = targetTime;
            setError(null);
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

    if (loading) return null;

    if (error) return (
        <div className="dashboard-card" style={{ padding: '0.5rem 1rem', color: '#d32f2f', fontSize: '0.8rem', background: '#ffebee', marginBottom: '1rem' }}>
            ⚠️ {error}
        </div>
    );

    if (warnings.length === 0) return (
        <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🌤️ Počasí a výstrahy</span>
                {timerText && <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal', background: '#e0e0e0', padding: '0.2rem 0.5rem', borderRadius: '12px' }}>{timerText}</span>}
            </h2>
            <div className="dashboard-card" style={{ padding: '1rem', background: '#E8F5E9', borderLeft: '5px solid #4CAF50', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>✅</span>
                <div>
                    <div style={{ fontWeight: 600, color: '#2E7D32' }}>Bez meteorologických výstrah</div>
                    <div style={{ fontSize: '0.85rem', color: '#4CAF50' }}>Pro oblast Brno nejsou aktuálně vydány žádné výstrahy ČHMÚ.</div>
                </div>
            </div>
        </section>
    );

    return (
        <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>⚠️ Výstrahy</span>
                {timerText && <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 'normal', background: '#e0e0e0', padding: '0.2rem 0.5rem', borderRadius: '12px' }}>{timerText}</span>}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {warnings.map((w, i) => {
                    const color = SEVERITY_COLORS[w.severity] || '#FBC02D';
                    const bg = SEVERITY_BG[w.severity] || '#FFFDE7';
                    const name = EVENT_NAMES[w.event] || w.event;
                    const sevLabel = SEVERITY_LABELS[w.severity] || w.severity;
                    const onset = w.onset ? new Date(w.onset).toLocaleString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    const expires = w.expires ? new Date(w.expires).toLocaleString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                        <div key={i} className="dashboard-card" style={{ padding: '1rem 1.25rem', borderLeft: `5px solid ${color}`, background: bg }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#222' }}>{name}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color, background: 'rgba(255,255,255,0.6)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{sevLabel}</div>
                            </div>
                            {(onset || expires) && (
                                <div style={{ fontSize: '0.82rem', color: '#555' }}>
                                    {onset && <span>Od: {onset}</span>}
                                    {onset && expires && <span> &nbsp;·&nbsp; </span>}
                                    {expires && <span>Do: {expires}</span>}
                                </div>
                            )}
                            <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.3rem' }}>
                                Zdroj: Meteoalarm / ČHMÚ
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
