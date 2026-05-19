import React, { useState } from 'react';
import { db } from '../../firebase';
import { collection, doc, addDoc, updateDoc } from 'firebase/firestore';
import { logAction } from '../../utils/logger';

export default function CreateEventModal({ onClose, currentUser, userData, showToast, initialData }) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [date, setDate] = useState(initialData?.date || '');
    const [time, setTime] = useState(initialData?.time || '09:00');
    const [timeEnd, setTimeEnd] = useState(initialData?.timeEnd || '');
    const [departureTime, setDepartureTime] = useState(initialData?.departureTime || '');
    const [location, setLocation] = useState(initialData?.location || '');
    const [maxParticipants, setMaxParticipants] = useState(initialData?.maxParticipants || '');
    const [saving, setSaving] = useState(false);

    const isEdit = !!initialData;

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
        try {
            if (isEdit) {
                await updateDoc(doc(db, 'events', initialData.id), {
                    title: title.trim(),
                    description: description.trim(),
                    date,
                    time,
                    timeEnd: timeEnd || null,
                    departureTime: departureTime || null,
                    location: location.trim(),
                    maxParticipants: maxParticipants ? parseInt(maxParticipants) : null
                });
                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    'ADMIN_UPDATED_EVENT', 'admin',
                    `Upravil akci „${title.trim()}“ (${date})`);
                showToast('success', 'Upraveno!');
            } else {
                await addDoc(collection(db, 'events'), {
                    title: title.trim(),
                    description: description.trim(),
                    date,
                    time,
                    timeEnd: timeEnd || null,
                    departureTime: departureTime || null,
                    location: location.trim(),
                    maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
                    createdBy: { uid: currentUser.uid, name: `${userData.firstName} ${userData.lastName}` },
                    createdAt: new Date().toISOString(),
                    participants: []
                });
                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    'ADMIN_CREATED_EVENT', 'admin',
                    `Vytvořil novou akci „${title.trim()}“ (${date})`);
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
                    <h3 className="modal-title">{isEdit ? '✏️ Upravit akci' : '🚩 Nová akce'}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Název *</label>
                        <input className="input-field" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="např. Výcvik v terénu" required />
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
                        <label className="input-label">Popis</label>
                        <textarea className="input-field" value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Max. účastníků</label>
                        <input className="input-field" type="number" min="1" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} placeholder="Bez limitu" />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušit</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Ukládám...' : (isEdit ? 'Uložit změny' : 'Vytvořit')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
