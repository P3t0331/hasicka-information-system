import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import LogParticipantPicker from './LogParticipantPicker';

const formatHours = (h) => {
    if (!h && h !== 0) return '0';
    return Number(h).toFixed(2).replace(/\.?0+$/, '');
};

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function LogEntryEditor({
    title,
    presets,
    members,
    initialEntry,
    prefillDate,
    currentUser,
    userData,
    onClose,
    onSave
}) {
    const isEdit = !!initialEntry;

    const [date, setDate] = useState(initialEntry?.date || prefillDate || todayISO());
    const [description, setDescription] = useState(initialEntry?.description || '');
    const [hours, setHours] = useState(
        initialEntry?.hours !== undefined && initialEntry?.hours !== null ? String(initialEntry.hours) : '1'
    );
    const [selectedUids, setSelectedUids] = useState(() => {
        if (initialEntry?.participants?.length) {
            return initialEntry.participants.map(p => p.uid);
        }
        return currentUser ? [currentUser.uid] : [];
    });
    const [externalText, setExternalText] = useState(
        (initialEntry?.externalParticipants || []).join(', ')
    );
    const [peopleCountManual, setPeopleCountManual] = useState(
        initialEntry?.peopleCount !== undefined && initialEntry?.peopleCount !== null
            ? String(initialEntry.peopleCount)
            : ''
    );
    const [overrideCount, setOverrideCount] = useState(false);
    const [overridePersonHours, setOverridePersonHours] = useState(
        initialEntry?.personHoursOverride != null
    );
    const [personHoursManual, setPersonHoursManual] = useState(
        initialEntry?.personHoursOverride != null
            ? String(initialEntry.personHoursOverride)
            : ''
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const externalNames = useMemo(() => {
        return externalText.split(',').map(s => s.trim()).filter(Boolean);
    }, [externalText]);

    const computedCount = selectedUids.length + externalNames.length;

    const computedPersonHours = useMemo(() => {
        const h = Number(hours) || 0;
        const p = parseInt(peopleCountManual, 10) || 0;
        return h * p;
    }, [hours, peopleCountManual]);

    useEffect(() => {
        if (!overrideCount) {
            setPeopleCountManual(String(computedCount));
        }
    }, [computedCount, overrideCount]);

    useEffect(() => {
        if (!overridePersonHours) {
            setPersonHoursManual(String(computedPersonHours));
        }
    }, [computedPersonHours, overridePersonHours]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!description.trim()) {
            setError('Vyplňte popis činnosti.');
            return;
        }
        if (!date) {
            setError('Vyberte datum.');
            return;
        }
        if (date > todayISO()) {
            setError('Datum nemůže být v budoucnosti.');
            return;
        }
        const hoursNum = Number(hours);
        if (Number.isNaN(hoursNum) || hoursNum < 0) {
            setError('Zadejte platný počet hodin.');
            return;
        }
        const peopleCountNum = parseInt(peopleCountManual, 10);
        if (Number.isNaN(peopleCountNum) || peopleCountNum < 0) {
            setError('Zadejte platný počet osob.');
            return;
        }
        const personHoursNum = Number(personHoursManual);
        if (Number.isNaN(personHoursNum) || personHoursNum < 0) {
            setError('Zadejte platný počet osobohodin.');
            return;
        }

        const participants = members
            .filter(m => selectedUids.includes(m.uid))
            .map(m => ({
                uid: m.uid,
                name: `${m.firstName} ${m.lastName}`.trim(),
                joinedAt: new Date().toISOString()
            }));

        setSaving(true);
        try {
            await onSave({
                date,
                description: description.trim(),
                participants,
                externalParticipants: externalNames,
                hours: hoursNum,
                peopleCount: peopleCountNum,
                personHoursOverride: overridePersonHours ? personHoursNum : null
            });
        } finally {
            setSaving(false);
        }
    };

    const applyPreset = (preset) => {
        if (!description.trim()) {
            setDescription(preset);
        } else {
            setDescription(prev => `${prev}, ${preset}`);
        }
    };

    return createPortal(
        <div
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
            }}
            onClick={onClose}
        >
            <div
                className="card"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '560px', width: '94%', animation: 'fadeIn 0.2s', maxHeight: '90vh', overflowY: 'auto' }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: 'var(--text-charcoal)' }}>
                    {isEdit ? '✏️ Upravit záznam' : `+ ${title}`}
                </h3>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Datum</label>
                        <input
                            className="input-field"
                            type="date"
                            value={date}
                            max={todayISO()}
                            onChange={e => setDate(e.target.value)}
                            required
                        />
                    </div>

                    {presets && presets.length > 0 && (
                        <div className="input-group">
                            <label className="input-label">Rychlá volba činnosti</label>
                            <select
                                className="input-field"
                                value=""
                                onChange={e => {
                                    if (e.target.value) {
                                        applyPreset(e.target.value);
                                        e.target.value = '';
                                    }
                                }}
                            >
                                <option value="">— Vyberte předlohu —</option>
                                {presets.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="input-group">
                        <label className="input-label">Popis činnosti</label>
                        <textarea
                            className="input-field"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            rows={3}
                            placeholder="Co bylo provedeno..."
                            style={{ resize: 'vertical' }}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Účastníci</label>
                        <LogParticipantPicker
                            members={members}
                            selectedUids={selectedUids}
                            onChange={setSelectedUids}
                            externalText={externalText}
                            setExternalText={setExternalText}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                        <div className="input-group">
                            <label className="input-label">Čas trvání (h)</label>
                            <input
                                className="input-field"
                                type="number"
                                step="0.25"
                                min="0"
                                inputMode="decimal"
                                value={hours}
                                onChange={e => setHours(e.target.value)}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>Počet osob</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                    {overrideCount ? '(ručně)' : '(auto)'}
                                </span>
                            </label>
                            <input
                                className="input-field"
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={peopleCountManual}
                                onChange={e => {
                                    setPeopleCountManual(e.target.value);
                                    setOverrideCount(true);
                                }}
                            />
                            {overrideCount && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverrideCount(false);
                                        setPeopleCountManual(String(computedCount));
                                    }}
                                    style={{
                                        marginTop: '0.25rem',
                                        background: 'none', border: 'none',
                                        color: 'var(--info)', cursor: 'pointer',
                                        fontSize: '0.75rem', padding: 0, textAlign: 'left'
                                    }}
                                >
                                    Použít automatický výpočet ({computedCount})
                                </button>
                            )}
                        </div>
                        <div className="input-group">
                            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>Osobohodiny</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                    {overridePersonHours ? '(ručně)' : '(auto)'}
                                </span>
                            </label>
                            <input
                                className="input-field"
                                type="number"
                                step="0.25"
                                min="0"
                                inputMode="decimal"
                                value={personHoursManual}
                                onChange={e => {
                                    setPersonHoursManual(e.target.value);
                                    setOverridePersonHours(true);
                                }}
                            />
                            {overridePersonHours && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverridePersonHours(false);
                                        setPersonHoursManual(String(computedPersonHours));
                                    }}
                                    style={{
                                        marginTop: '0.25rem',
                                        background: 'none', border: 'none',
                                        color: 'var(--info)', cursor: 'pointer',
                                        fontSize: '0.75rem', padding: 0, textAlign: 'left'
                                    }}
                                >
                                    Použít automatický výpočet ({formatHours(computedPersonHours)})
                                </button>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            marginTop: '0.75rem',
                            padding: '0.5rem 0.75rem',
                            background: 'var(--danger-bg)',
                            color: 'var(--danger-text)',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            border: '1px solid var(--danger-border)'
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                            {saving ? 'Ukládám...' : (isEdit ? 'Uložit změny' : 'Přidat záznam')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
