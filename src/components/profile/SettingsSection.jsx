import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getTheme, getLandingPage, DEFAULT_DASHBOARD_WIDGET_ORDER } from '../../../shared/preferences.js';

const THEME_OPTIONS = [
    { value: 'light', label: 'Světlé' },
    { value: 'dark', label: 'Tmavé' },
    { value: 'system', label: 'Podle systému' },
];

const LANDING_PAGE_OPTIONS = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'sluzby', label: 'Služby' },
    { value: 'skoleni', label: 'Školení' },
    { value: 'kvizy', label: 'Kvízy' },
];

const WIDGET_LABELS = {
    bulletin: 'Nástěnka',
    nextShift: 'Nejbližší služba',
    quiz: 'Nesplněné kvízy',
    monthlyStats: 'Měsíční statistiky',
    upcomingActivities: 'Nadcházející aktivity',
    myAbsences: 'Moje absence',
    importantLinks: 'Důležité odkazy',
};

export default function SettingsSection() {
    const { currentUser, userData } = useAuth();
    const preferences = userData?.preferences;

    async function updatePreference(key, value) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { [`preferences.${key}`]: value });
    }

    const hidden = preferences?.dashboardWidgets?.hidden || [];
    const fullOrder = preferences?.dashboardWidgets?.order || DEFAULT_DASHBOARD_WIDGET_ORDER;

    async function toggleWidget(widgetId) {
        const nextHidden = hidden.includes(widgetId)
            ? hidden.filter(id => id !== widgetId)
            : [...hidden, widgetId];
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            'preferences.dashboardWidgets': { order: fullOrder, hidden: nextHidden },
        });
    }

    async function moveWidget(widgetId, direction) {
        const idx = fullOrder.indexOf(widgetId);
        const swapWith = idx + direction;
        if (idx === -1 || swapWith < 0 || swapWith >= fullOrder.length) return;
        const nextOrder = [...fullOrder];
        [nextOrder[idx], nextOrder[swapWith]] = [nextOrder[swapWith], nextOrder[idx]];
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            'preferences.dashboardWidgets': { order: nextOrder, hidden },
        });
    }

    return (
        <div className="card">
            <h3 style={{ marginTop: 0 }}>Nastavení</h3>

            <div style={{ marginBottom: '1.5rem' }}>
                <div className="input-label">Vzhled</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {THEME_OPTIONS.map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="theme"
                                value={opt.value}
                                checked={getTheme(preferences) === opt.value}
                                onChange={() => updatePreference('theme', opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <div className="input-label">Úvodní stránka</div>
                <select
                    className="select-field"
                    value={getLandingPage(preferences)}
                    onChange={(e) => updatePreference('landingPage', e.target.value)}
                >
                    {LANDING_PAGE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
                <div className="input-label">Nástěnka</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {fullOrder.map((widgetId, idx) => (
                        <div key={widgetId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <input
                                type="checkbox"
                                checked={!hidden.includes(widgetId)}
                                onChange={() => toggleWidget(widgetId)}
                            />
                            <span style={{ flex: 1 }}>{WIDGET_LABELS[widgetId] || widgetId}</span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }}
                                disabled={idx === 0} onClick={() => moveWidget(widgetId, -1)}>↑</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }}
                                disabled={idx === fullOrder.length - 1} onClick={() => moveWidget(widgetId, 1)}>↓</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
