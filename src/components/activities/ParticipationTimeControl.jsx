import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logAction } from '../../utils/logger';
import { updateParticipantTimesTx } from '../../utils/activityParticipants';
import { formatParticipantTimes, validateParticipantTimes } from '../../../shared/participantTimes.js';

// Čip „⏱ Celou dobu / ⏱ do 16:00" + modal pro zadání částečné účasti.
// Zobrazuje se jen přihlášenému členovi; o skrytí u proběhlých akcí rozhoduje rodič.
export default function ParticipationTimeControl({ activity, collectionName, compact = false }) {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [open, setOpen] = useState(false);
    const [from, setFrom] = useState('');
    const [until, setUntil] = useState('');
    const [saving, setSaving] = useState(false);

    const me = activity.participants?.find(p => p.uid === currentUser?.uid);
    if (!me) return null;

    const label = formatParticipantTimes(me) || 'Celou dobu';
    const hasPartial = !!formatParticipantTimes(me);
    const error = validateParticipantTimes(activity, { from, until });

    const openModal = (e) => {
        e.stopPropagation();
        setFrom(me.from || '');
        setUntil(me.until || '');
        setOpen(true);
    };

    const save = async (values) => {
        setSaving(true);
        try {
            await updateParticipantTimesTx(db, collectionName, activity.id, currentUser.uid, values);
            const typeLabel = collectionName === 'trainings' ? 'školení' : 'akci';
            const desc = formatParticipantTimes(values) || 'celou dobu';
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'UPDATED_ACTIVITY_TIMES', 'activities',
                `Upravil čas účasti na ${typeLabel} „${activity.title}“ (${activity.date}): ${desc}`);
            addToast('success', 'Uloženo.');
            setOpen(false);
        } catch (err) {
            if (err.code === 'NOT_JOINED') addToast('warning', 'Nejste přihlášen/a.');
            else if (err.code === 'NOT_FOUND') addToast('error', 'Aktivita už neexistuje.');
            else {
                console.error('Error updating participant times:', err);
                addToast('error', 'Chyba při ukládání.');
            }
        } finally {
            setSaving(false);
        }
    };

    const chipStyle = {
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        padding: compact ? '0.2rem 0.5rem' : '0.35rem 0.65rem',
        borderRadius: '999px',
        fontSize: compact ? '0.72rem' : '0.8rem', fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
        background: hasPartial ? 'var(--warning-bg-soft)' : 'var(--surface-sunken)',
        color: hasPartial ? 'var(--warning-dark)' : 'var(--text-muted)',
        border: `1px solid ${hasPartial ? 'var(--warning-strong)' : 'var(--border)'}`,
    };

    const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' };

    return (
        <>
            <button type="button" style={chipStyle} onClick={openModal} title="Nastavit, od kdy / do kdy se zúčastníte">
                ⏱ {label}
            </button>
            {open && createPortal(
                <div className="modal-overlay" style={{ zIndex: 1600 }} onClick={() => setOpen(false)}>
                    <div className="modal-content" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Čas účasti</h3>
                            <button className="modal-close" onClick={() => setOpen(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{activity.title}</strong><br />
                                Čas akce: {activity.time}{activity.timeEnd ? ` – ${activity.timeEnd}` : ''}
                            </p>
                            <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Nemůžete celou dobu? Vyplňte, kdy přijdete a/nebo odejdete. Prázdné pole = od začátku / do konce.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Přijdu v</label>
                                    <input className="input-field" type="time" value={from} onChange={e => setFrom(e.target.value)} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Odejdu v</label>
                                    <input className="input-field" type="time" value={until} onChange={e => setUntil(e.target.value)} />
                                </div>
                            </div>
                            {error && (
                                <div style={{ marginTop: '0.6rem', color: 'var(--danger-text)', fontSize: '0.8rem' }}>{error}</div>
                            )}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" disabled={saving} onClick={() => save({})}>
                                Celou dobu
                            </button>
                            <button className="btn btn-primary" disabled={saving || !!error} onClick={() => save({ from, until })}>
                                Uložit
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
