import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function TrainingsPage() {
    const { currentUser, userData } = useAuth();
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [editTraining, setEditTraining] = useState(null);

    const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
    const canCreate = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'VD'].includes(r));
    const canDeleteAny = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'trainings'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => a.date.localeCompare(b.date));
            setTrainings(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (type, message) => setToast({ type, message });

    const upcomingTrainings = trainings.filter(t => t.date >= todayISO);
    const pastTrainings = trainings.filter(t => t.date < todayISO).reverse();

    const handleJoin = async (training) => {
        if (!currentUser || !userData) return;

        if (training.participants?.some(p => p.uid === currentUser.uid)) {
            showToast('warning', 'Již jste přihlášen/a.');
            return;
        }

        if (training.maxParticipants && training.participants?.length >= training.maxParticipants) {
            showToast('error', 'Školení je plně obsazeno.');
            return;
        }

        try {
            await updateDoc(doc(db, 'trainings', training.id), {
                participants: arrayUnion({
                    uid: currentUser.uid,
                    name: `${userData.firstName} ${userData.lastName}`,
                    joinedAt: new Date().toISOString()
                })
            });
            showToast('success', 'Přihlášeno!');
        } catch (err) {
            console.error('Error joining:', err);
            showToast('error', 'Chyba při přihlašování.');
        }
    };

    const handleLeave = async (training) => {
        const myParticipation = training.participants?.find(p => p.uid === currentUser?.uid);
        if (!myParticipation) return;

        try {
            await updateDoc(doc(db, 'trainings', training.id), {
                participants: arrayRemove(myParticipation)
            });
            showToast('success', 'Odhlášeno.');
        } catch (err) {
            console.error('Error leaving:', err);
            showToast('error', 'Chyba při odhlašování.');
        }
    };

    const requestDelete = (training) => {
        if (!(canDeleteAny || training.createdBy?.uid === currentUser?.uid)) return;
        setDeleteModal(training);
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        try {
            await deleteDoc(doc(db, 'trainings', deleteModal.id));
            showToast('success', 'Smazáno.');
        } catch (err) {
            console.error('Error deleting:', err);
            showToast('error', 'Chyba při mazání.');
        }
        setDeleteModal(null);
    };

    const openEditModal = (training) => {
        setEditTraining(training);
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditTraining(null);
    };

    const formatDate = (isoDate) => {
        if (!isoDate) return {};
        const [year, month, day] = isoDate.split('-');
        const MONTHS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
        return { day: parseInt(day), month: MONTHS[parseInt(month) - 1], year };
    };

    if (loading) {
        return (
            <div className="container mt-4" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>Načítám školení...</p>
            </div>
        );
    }

    return (
        <div className="container mt-4" style={{ maxWidth: '800px', paddingBottom: '3rem' }}>
            {/* Toast */}
            {toast && (
                <div className={`toast toast--${toast.type}`} onClick={() => setToast(null)}>
                    {toast.message}
                </div>
            )}

            {/* Page Header */}
            <div className="page-header">
                <div className="page-header__content">
                    <div>
                        <h1 className="page-header__title">
                            <span>📚</span>
                            <span>Školení</span>
                        </h1>
                        <div className="page-header__subtitle">
                            {upcomingTrainings.length} nadcházející • {pastTrainings.length} proběhlých
                        </div>
                    </div>
                    {canCreate && (
                        <button className="page-header__action" onClick={() => setShowCreateModal(true)}>
                            + Nové školení
                        </button>
                    )}
                </div>
            </div>

            {/* Upcoming Trainings */}
            <section style={{ marginBottom: '1.5rem' }}>
                <div className="section-header section-header--upcoming">
                    <span className="section-header__title">
                        <span>📅</span>
                        <span>Nadcházející</span>
                    </span>
                    <div className="section-header__meta">
                        <span className="section-header__count">{upcomingTrainings.length}</span>
                    </div>
                </div>

                <div className="section-body">
                    {upcomingTrainings.length === 0 ? (
                        <div className="section-body--empty">
                            <div className="section-body--empty-icon">📭</div>
                            Žádná nadcházející školení
                        </div>
                    ) : (
                        upcomingTrainings.map((t) => (
                            <TrainingCard
                                key={t.id}
                                training={t}
                                isPast={false}
                                currentUser={currentUser}
                                onJoin={handleJoin}
                                onLeave={handleLeave}
                                onDelete={requestDelete}
                                onEdit={openEditModal}
                                canDelete={canDeleteAny || t.createdBy?.uid === currentUser?.uid}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* Past Trainings */}
            <section>
                <div
                    className={`section-header section-header--clickable ${showPast ? 'open' : ''}`}
                    onClick={() => setShowPast(!showPast)}
                >
                    <span className="section-header__title">
                        <span>🕐</span>
                        <span>Proběhlá</span>
                    </span>
                    <div className="section-header__meta">
                        <span className="section-header__count">{pastTrainings.length}</span>
                        <span className={`section-header__chevron ${showPast ? 'open' : ''}`}>▼</span>
                    </div>
                </div>

                {showPast && pastTrainings.length > 0 && (
                    <div className="section-body">
                        {pastTrainings.map((t) => (
                            <TrainingCard
                                key={t.id}
                                training={t}
                                isPast={true}
                                currentUser={currentUser}
                                onJoin={handleJoin}
                                onLeave={handleLeave}
                                onDelete={requestDelete}
                                onEdit={openEditModal}
                                canDelete={canDeleteAny || t.createdBy?.uid === currentUser?.uid}
                                formatDate={formatDate}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <CreateTrainingModal
                    onClose={handleCloseModal}
                    currentUser={currentUser}
                    userData={userData}
                    showToast={showToast}
                    initialData={editTraining}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
                    <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Smazat školení?</h3>
                        <p className="confirm-modal__message">
                            Opravdu chcete smazat školení <strong>"{deleteModal.title}"</strong>?
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>
                                Zrušit
                            </button>
                            <button className="btn btn-primary" onClick={confirmDelete}>
                                Smazat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TrainingCard({ training, isPast, currentUser, onJoin, onLeave, onDelete, onEdit, canDelete, formatDate }) {
    const [expanded, setExpanded] = useState(false);

    const isJoined = training.participants?.some(p => p.uid === currentUser?.uid);
    const count = training.participants?.length || 0;
    const dateInfo = formatDate(training.date);

    const dateBadgeClass = isPast ? 'date-badge date-badge--past' :
        isJoined ? 'date-badge date-badge--joined' : 'date-badge';

    return (
        <div className={`event-card ${isPast ? 'event-card--past' : ''}`}>
            {/* Date Badge */}
            <div className={dateBadgeClass}>
                <div className="date-badge__day">{dateInfo.day}</div>
                <div className="date-badge__month">{dateInfo.month}</div>
            </div>

            {/* Content */}
            <div className="event-card__content">
                <div className="event-card__header">
                    <div className={`event-card__title ${isPast ? 'event-card__title--past' : ''}`}>
                        <span>{training.title}</span>
                        {isJoined && !isPast && (
                            <span className="event-card__badge event-card__badge--joined">✓ Přihlášen</span>
                        )}
                        {isPast && (
                            <span className="event-card__badge event-card__badge--past">Proběhlo</span>
                        )}
                    </div>

                    {canDelete && (
                        <div className="event-card__actions-top">
                            <button
                                className="event-card__edit-btn"
                                onClick={(e) => { e.stopPropagation(); onEdit(training); }}
                                title="Upravit"
                            >
                                ✏️
                            </button>
                            <button
                                className="event-card__delete-btn"
                                onClick={(e) => { e.stopPropagation(); onDelete(training); }}
                                title="Smazat"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Meta Info */}
                <div className="event-card__meta">
                    {training.departureTime && (
                        <>
                            <span className="event-card__meta-item" title="Čas odjezdu">
                                🚌 {training.departureTime}
                            </span>
                            <span className="event-card__meta-sep">•</span>
                        </>
                    )}
                    <span className="event-card__meta-item" title="Čas konání">
                        ⏰ {training.time}{training.timeEnd ? ` – ${training.timeEnd}` : ''}
                    </span>
                    <span className="event-card__meta-sep">•</span>
                    <span className="event-card__meta-item">
                        📍 {training.location || 'Stanice'}
                    </span>
                </div>

                {training.description && (
                    <div className="event-card__description">{training.description}</div>
                )}

                {/* Footer */}
                <div className="event-card__footer">
                    <div
                        className={`participants-count ${count > 0 ? 'participants-count--clickable' : ''}`}
                        onClick={() => count > 0 && setExpanded(!expanded)}
                    >
                        <span className="participants-count__icon">👥</span>
                        <span className="participants-count__number">
                            {count}{training.maxParticipants ? `/${training.maxParticipants}` : ''}
                        </span>
                        {count > 0 && (
                            <span className={`participants-count__chevron ${expanded ? 'open' : ''}`}>▼</span>
                        )}
                    </div>

                    {!isPast && (
                        isJoined ? (
                            <button className="event-action-btn event-action-btn--leave" onClick={() => onLeave(training)}>
                                Odhlásit
                            </button>
                        ) : (
                            <button className="event-action-btn event-action-btn--join" onClick={() => onJoin(training)}>
                                Přihlásit
                            </button>
                        )
                    )}
                </div>

                {/* Expanded Participants List */}
                {expanded && count > 0 && (
                    <div className="participants-list">
                        {training.participants.map(p => (
                            <div
                                key={p.uid}
                                className={`participants-list__item ${p.uid === currentUser?.uid ? 'participants-list__item--current' : ''}`}
                            >
                                {p.uid === currentUser?.uid && <span>⭐</span>}
                                <span>{p.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CreateTrainingModal({ onClose, currentUser, userData, showToast, initialData }) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [date, setDate] = useState(initialData?.date || '');
    const [time, setTime] = useState(initialData?.time || '18:00');
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
                await updateDoc(doc(db, 'trainings', initialData.id), {
                    title: title.trim(),
                    description: description.trim(),
                    date,
                    time,
                    timeEnd: timeEnd || null,
                    departureTime: departureTime || null,
                    location: location.trim(),
                    maxParticipants: maxParticipants ? parseInt(maxParticipants) : null
                });
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
                    createdBy: { uid: currentUser.uid, name: `${userData.firstName} ${userData.lastName}` },
                    createdAt: new Date().toISOString(),
                    participants: []
                });
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
                        <input className="input-field" type="time" value={departureTime} onChange={e => setDepartureTime(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Od *</label>
                            <input className="input-field" type="time" value={time} onChange={e => setTime(e.target.value)} required />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label className="input-label">Do (volitelné)</label>
                            <input className="input-field" type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)} />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Místo</label>
                        <input className="input-field" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="např. Zbrojnice" />
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
