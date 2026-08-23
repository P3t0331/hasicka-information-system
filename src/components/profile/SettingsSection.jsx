import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getTheme, getLandingPage } from '../../../shared/preferences.js';

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

export default function SettingsSection() {
    const { currentUser, userData } = useAuth();
    const preferences = userData?.preferences;

    async function updatePreference(key, value) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { [`preferences.${key}`]: value });
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
        </div>
    );
}
