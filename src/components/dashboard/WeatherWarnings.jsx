import React, { useState, useEffect } from 'react';

export default function WeatherWarnings() {
    const [warnings, setWarnings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchWeather();
    }, []);

    const fetchWeather = async () => {
        try {
            // Check cache first (30 minutes)
            const cachedData = localStorage.getItem('weatherWarningsCache');
            const cacheTimestamp = localStorage.getItem('weatherWarningsTimestamp');
            
            if (cachedData && cacheTimestamp) {
                const now = new Date().getTime();
                const cacheTime = parseInt(cacheTimestamp, 10);
                const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in ms

                if (now - cacheTime < CACHE_DURATION) {
                    processWeatherData(JSON.parse(cachedData));
                    setLoading(false);
                    return;
                }
            }

            // WeatherAPI.com - Brno
            // Key from .env
            const apiKey = import.meta.env.VITE_WEATHER_API_KEY;
            const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=Brno&days=1&alerts=yes&lang=cs`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Nelze načíst data o počasí');

            const data = await response.json();
            
            // Save to cache
            localStorage.setItem('weatherWarningsCache', JSON.stringify(data));
            localStorage.setItem('weatherWarningsTimestamp', new Date().getTime().toString());

            processWeatherData(data);
        } catch (err) {
            console.error('Error fetching weather:', err);
            setError('Nepodařilo se načíst výstrahy.');
        } finally {
            setLoading(false);
        }
    };

    const loadDemoData = () => {
        setError(null);
        // Demo specific warning to test UI
        setWarnings([
            {
                event: 'DEMO: Silný vítr',
                severity: 'Moderate',
                description: 'Toto je ukázka výstrahy. Rychlost větru překračuje 85 km/h.',
                instruction: 'Doporučuje se zajistit okna a dveře.',
                color: '#F57C00'
            }
        ]);
    };

    const processWeatherData = (data) => {
        if (!data) return;

        // Process Warnings (Alerts)
        let alertsList = [];
        if (data.alerts) {
            if (Array.isArray(data.alerts)) {
                alertsList = data.alerts;
            } else if (data.alerts.alert) {
                alertsList = Array.isArray(data.alerts.alert) ? data.alerts.alert : [data.alerts.alert];
            }
        }

        // Filter alerts relevant for Brno
        const relevantAlerts = alertsList.filter(alert => {
            const text = ((alert.areas || '') + ' ' + (alert.headline || '')).toLowerCase();

            // 1. Explicit Brno mention
            if (text.includes('brno')) return true;

            // 2. Region mention with validation (Jihomoravský / South Moravian)
            if (text.includes('jihomoravsk') || text.includes('south moravian')) {
                // If it contains a list of specific areas in parentheses (e.g. "... (Blansko, Vyškov)"), verify Brno is inside
                // If parens exist but "brno" is missing, we assume it's for other districts only.
                if (text.includes('(') && !text.includes('brno')) return false;
                return true;
            }

            return false;
        });

        const newWarnings = relevantAlerts.map(alert => ({
            event: alert.event || 'Výstraha',
            severity: alert.severity || 'Moderate',
            description: alert.desc || '',
            instruction: alert.instruction || '',
            onset: alert.effective ? new Date(alert.effective).toLocaleString('cs-CZ') : '',
            expires: alert.expires ? new Date(alert.expires).toLocaleString('cs-CZ') : '',
            color: getSeverityColor(alert.severity)
        }));

        setWarnings(newWarnings);
    };

    const getSeverityColor = (severity) => {
        // Map severity to colors
        const s = (severity || '').toLowerCase();
        if (s.includes('extreme') || s.includes('extrém')) return '#D32F2F'; // Red
        if (s.includes('severe') || s.includes('siln')) return '#E64A19'; // Deep Orange
        if (s.includes('moderate') || s.includes('střed')) return '#F57C00'; // Orange
        return '#FBC02D'; // Default Yellow
    };

    // "I do not want to see weather, only if there are or not alerts."
    // If loading, silent.
    if (loading) return null;

    // If error, likely silent too unless we want to debug.
    // I'll show a tiny error icon just in case, but unobtrusive.
    if (error) {
        return (
            <div className="dashboard-card" style={{ padding: '0.5rem', textAlign: 'center', color: '#d32f2f', fontSize: '0.8rem', background: '#ffebee', marginBottom: '1rem' }}>
                ⚠️ {error} <button onClick={loadDemoData} style={{ border: 'none', background: 'none', textDecoration: 'underline', cursor: 'pointer', color: '#d32f2f' }}>Demo</button>
            </div>
        );
    }

    // If no warnings, render a positive state
    if (warnings.length === 0) {
        return (
            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🌤️ Počasí a výstrahy
                </h2>
                <div className="dashboard-card" style={{ padding: '1rem', background: '#E8F5E9', borderLeft: '5px solid #4CAF50', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                    <div>
                        <div style={{ fontWeight: 600, color: '#2E7D32' }}>Bez meteorologických výstrah</div>
                        <div style={{ fontSize: '0.85rem', color: '#4CAF50' }}>Pro oblast Brno a okolí nejsou aktuálně vydány žádné nebezpečné jevy.</div>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚠️ Výstrahy
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {warnings.map((w, index) => (
                    <div key={index} className="dashboard-card" style={{
                        padding: '1.5rem',
                        borderLeft: `5px solid ${w.color}`,
                        background: '#fff3e0' // Light warning bg
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333' }}>
                                {w.event}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: w.color, background: 'rgba(255,255,255,0.5)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                {w.severity}
                            </div>
                        </div>

                        <div style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#444' }}>
                            {w.description}
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                            <strong>Platnost:</strong> {w.onset} - {w.expires}
                        </div>

                        {w.instruction && (
                            <div style={{ fontSize: '0.85rem', color: '#555', fontStyle: 'italic', marginTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '0.5rem' }}>
                                ℹ️ {w.instruction}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
