import React, { useState, useMemo } from 'react';
import { db } from '../../firebase';
import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import { logAction } from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';

export default function CreateTrainingModal({ onClose, currentUser, userData, initialData, members = [], onSaveAsTemplate }) {
    const { addToast: showToast } = useToast();
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [date, setDate] = useState(initialData?.date || '');
    const [time, setTime] = useState(initialData?.time || '18:00');
    const [timeEnd, setTimeEnd] = useState(initialData?.timeEnd || '');
    const [departureTime, setDepartureTime] = useState(initialData?.departureTime || '');
    const [location, setLocation] = useState(initialData?.location || '');
    const [maxParticipants, setMaxParticipants] = useState(initialData?.maxParticipants || '');
    const [vehicles, setVehicles] = useState(() => {
        if (typeof initialData?.vehicles === 'string') return initialData.vehicles.split(',').map(v => v.trim()).filter(Boolean);
        if (Array.isArray(initialData?.vehicles)) return initialData.vehicles;
        return [];
    });
    
    const VEHICLE_OPTIONS = ['OA', 'DA-12', 'CAS 30', 'CAS 20'];

    const toggleVehicle = (v) => {
        setVehicles(prev => prev.includes(v) ? prev.filter(item => item !== v) : [...prev, v]);
    };
    const [instructorUids, setInstructorUids] = useState(() => {
        if (initialData?.instructors?.length) return initialData.instructors.map(i => i.uid);
        if (initialData?.instructor?.uid) return [initialData.instructor.uid];
        return [];
    });
    const [instructorSearch, setInstructorSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveTemplate, setSaveTemplate] = useState(false);

    const isEdit = !!(initialData?.id);

    const sortedMembers = useMemo(() =>
        [...members].sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || (a.firstName || '').localeCompare(b.firstName || '')),
        [members]
    );

    const filteredInstructorMembers = useMemo(() => {
        const q = instructorSearch.trim().toLowerCase();
        if (!q) return sortedMembers;
        return sortedMembers.filter(m => `${m.firstName} ${m.lastName}`.toLowerCase().includes(q));
    }, [sortedMembers, instructorSearch]);

    const toggleInstructor = (uid) => {
        setInstructorUids(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
    };

    const buildInstructors = () =>
        instructorUids.map(uid => {
            const m = members.find(m => (m.uid || m.id) === uid);
            return m ? { uid, name: `${m.firstName} ${m.lastName}` } : null;
        }).filter(Boolean);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !date) {
            showToast('error', 'Vyplňte název a datum.');
            return;
        }

        if (timeEnd && timeEnd < time) {
            showToast('error', 'Čas "Do" musí být po čase "Od".');
            return;
        }

        if (departureTime && departureTime > time) {
            showToast('error', 'Odjezd musí být před začátkem akce.');
            return;
        }

        setSaving(true);
        const now = new Date().toISOString();
        const instructors = buildInstructors();

        const instructorParticipants = instructors.map(i => ({
            uid: i.uid,
            name: i.name,
            joinedAt: now
        }));

        try {
            if (isEdit) {
                const currentParticipants = initialData.participants || [];
                const mergedParticipants = [...currentParticipants];
                for (const ip of instructorParticipants) {
                    if (!mergedParticipants.some(p => p.uid === ip.uid)) {
                        mergedParticipants.push(ip);
                    }
                }

                await updateDoc(doc(db, 'trainings', initialData.id), {
                    title: title.trim(),
                    description: description.trim(),
                    date,
                    time,
                    timeEnd: timeEnd || null,
                    departureTime: departureTime || null,
                    location: location.trim(),
                    maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
                    vehicles: vehicles.length > 0 ? vehicles.join(', ') : null,
                    instructors,
                    instructor: null,
                    participants: mergedParticipants
                });
                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    'ADMIN_UPDATED_TRAINING', 'admin',
                    `Upravil školení „${title.trim()}“ (${date})`);
                showToast('success', 'Upraveno!');
            } else {
                await addDoc(collection(db, 'trainings'), {
                    title: title.trim(),
                    description: description.trim(),
                    date,
                    time,
                    timeEnd: timeEnd || null,
                    departureTime: departureTime || null,
                    location: location.trim(),
                    maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
                    vehicles: vehicles.length > 0 ? vehicles.join(', ') : null,
                    instructors,
                    createdBy: { uid: currentUser.uid, name: `${userData.firstName} ${userData.lastName}` },
                    createdAt: now,
                    participants: instructorParticipants
                });
                fetch('/api/send-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: '📋 Nové školení',
                        body: [
                            title.trim(),
                            date ? new Date(date).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }) : null,
                            time ? `${time}${timeEnd ? '–' + timeEnd : ''}` : null,
                            location.trim() || null,
                        ].filter(Boolean).join(' · '),
                        url: '/skoleni',
                        tag: 'skoleni',
                    }),
                });
                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    'ADMIN_CREATED_TRAINING', 'admin',
                    `Vytvořil nové školení „${title.trim()}” (${date})`);
                if (saveTemplate && onSaveAsTemplate) {
                    await onSaveAsTemplate({
                        title: title.trim(), description: description.trim(),
                        time, timeEnd: timeEnd || null, departureTime: departureTime || null,
                        location: location.trim(),
                        maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
                        vehicles: vehicles.length > 0 ? vehicles.join(', ') : null,
                        instructors: buildInstructors(),
                    });
                }
                showToast('success', 'Vytvořeno!');
            }
            onClose();
        } catch (err) {
            console.error('Error:', err);
            showToast('error', 'Chyba při ukládání.');
        }
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal-content">
                <div className="modal-header">
                    <h3 className="modal-title">{isEdit ? '✏️ Upravit školení' : '🎓 Nové školení'}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Název *</label>
                        <input className="input-field" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="např. Kurz NDT-16" required />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Datum *</label>
                        <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Odjezd (volitelné)</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input-field"
                                type="time"
                                value={departureTime}
                                onChange={e => setDepartureTime(e.target.value)}
                                style={{ paddingRight: departureTime ? '2rem' : undefined }}
                            />
                            {departureTime && (
                                <button
                                    type="button"
                                    onClick={() => setDepartureTime('')}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'rgba(255,255,255,0.8)',
                                        borderRadius: '50%',
                                        width: '24px',
                                        height: '24px',
                                        border: 'none',
                                        color: '#333',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 10,
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                    }}
                                    title="Vymazat čas"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="input-group">
                            <label className="input-label">Od *</label>
                            <input className="input-field" type="time" value={time} onChange={e => setTime(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Do (volitelné)</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input-field"
                                    type="time"
                                    value={timeEnd}
                                    onChange={e => setTimeEnd(e.target.value)}
                                    style={{ paddingRight: timeEnd ? '2rem' : undefined }}
                                />
                                {timeEnd && (
                                    <button
                                        type="button"
                                        onClick={() => setTimeEnd('')}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(255,255,255,0.8)',
                                            borderRadius: '50%',
                                            width: '24px',
                                            height: '24px',
                                            border: 'none',
                                            color: '#333',
                                            fontSize: '1rem',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10,
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                        }}
                                        title="Vymazat čas"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Místo</label>
                        <input className="input-field" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="např. Areál" />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Školitelé</label>
                        {instructorUids.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                {instructorUids.map(uid => {
                                    const m = members.find(m => (m.uid || m.id) === uid);
                                    if (!m) return null;
                                    return (
                                        <span key={uid} style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                            background: '#E3F2FD', color: '#1565C0',
                                            padding: '0.2rem 0.55rem', borderRadius: '999px',
                                            fontSize: '0.8rem', fontWeight: 600, border: '1px solid #90CAF9'
                                        }}>
                                            {m.firstName} {m.lastName}
                                            <button type="button" onClick={() => toggleInstructor(uid)}
                                                style={{ background: 'transparent', border: 'none', color: '#1565C0', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0 }}>×</button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <input
                            className="input-field"
                            type="text"
                            placeholder="Hledat školitele..."
                            value={instructorSearch}
                            onChange={e => setInstructorSearch(e.target.value)}
                            style={{ marginBottom: '0.4rem' }}
                        />
                        <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa' }}>
                            {filteredInstructorMembers.length === 0 ? (
                                <div style={{ padding: '0.75rem', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>Nikdo neodpovídá hledání.</div>
                            ) : filteredInstructorMembers.map(m => {
                                const uid = m.uid || m.id;
                                const isSelected = instructorUids.includes(uid);
                                return (
                                    <label key={uid} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        padding: '0.4rem 0.6rem', cursor: 'pointer',
                                        background: isSelected ? '#E3F2FD' : 'transparent',
                                        borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem'
                                    }}>
                                        <input type="checkbox" checked={isSelected} onChange={() => toggleInstructor(uid)} style={{ margin: 0 }} />
                                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>{m.firstName} {m.lastName}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Popis</label>
                        <textarea className="input-field" value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Max. účastníků</label>
                        <input className="input-field" type="number" min="1" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} placeholder="Bez limitu" />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Technika</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.25rem' }}>
                            {VEHICLE_OPTIONS.map(v => {
                                const isSelected = vehicles.includes(v);
                                return (
                                    <label key={v} style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.4rem 0.75rem', borderRadius: '8px',
                                        background: isSelected ? '#E8EAF6' : '#f5f5f5',
                                        border: `1px solid ${isSelected ? '#7986CB' : '#e0e0e0'}`,
                                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: isSelected ? 600 : 500,
                                        color: isSelected ? '#283593' : '#555',
                                        transition: 'all 0.15s'
                                    }}>
                                        <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => toggleVehicle(v)} 
                                            style={{ margin: 0, width: '14px', height: '14px' }} 
                                        />
                                        {v}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {!isEdit && onSaveAsTemplate && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer', fontSize: '0.88rem', color: '#555' }}>
                            <input type="checkbox" checked={saveTemplate} onChange={e => setSaveTemplate(e.target.checked)} />
                            💾 Uložit jako šablonu pro příště
                        </label>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušit</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Ukládám...' : (isEdit ? 'Uložit změny' : 'Vytvořit')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
