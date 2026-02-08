import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function EventsPage() {
    const { currentUser, userData } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [editEvent, setEditEvent] = useState(null);

    const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
    const canCreate = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'VD'].includes(r));
    const canDeleteAny = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => a.date.localeCompare(b.date));
            setEvents(data);
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

    const upcomingEvents = events.filter(t => t.date >= todayISO);
    const pastEvents = events.filter(t => t.date < todayISO).reverse();

    const handleJoin = async (event) => {
        if (!currentUser || !userData) return;

        if (event.participants?.some(p => p.uid === currentUser.uid)) {
            showToast('warning', 'Již jste přihlášen/a.');
            return;
        }

        if (event.maxParticipants && event.participants?.length >= event.maxParticipants) {
            showToast('error', 'Akce je plně obsazena.');
            return;
        }

        try {
            await updateDoc(doc(db, 'events', event.id), {
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

    const handleLeave = async (event) => {
        const myParticipation = event.participants?.find(p => p.uid === currentUser?.uid);
        if (!myParticipation) return;

        try {
            await updateDoc(doc(db, 'events', event.id), {
                participants: arrayRemove(myParticipation)
            });
            showToast('success', 'Odhlášeno.');
        } catch (err) {
            console.error('Error leaving:', err);
            showToast('error', 'Chyba při odhlašování.');
        }
    };

    const requestDelete = (event) => {
        if (!(canDeleteAny || event.createdBy?.uid === currentUser?.uid)) return;
        setDeleteModal(event);
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        try {
            await deleteDoc(doc(db, 'events', deleteModal.id));
            showToast('success', 'Smazáno.');
        } catch (err) {
            console.error('Error deleting:', err);
            showToast('error', 'Chyba při mazání.');
        }
        setDeleteModal(null);
    };

    const openEditModal = (event) => {
        setEditEvent(event);
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditEvent(null);
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
                <p>Načítám akce...</p>
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
                            <span>🚩</span>
                            <span>Akce a události</span>
                        </h1>
                        <div className="page-header__subtitle">
                            {upcomingEvents.length} nadcházející • {pastEvents.length} proběhlých
                        </div>
                    </div>
                    {canCreate && (
                        <button className="page-header__action" onClick={() => setShowCreateModal(true)}>
                            + Nová akce
                        </button>
                    )}
                </div>
            </div>

            {/* Upcoming Events */}
            <section style={{ marginBottom: '1.5rem' }}>
                <div className="section-header section-header--upcoming">
                    <span className="section-header__title">
                        <span>📅</span>
                        <span>Nadcházející</span>
                    </span>
                    <div className="section-header__meta">
                        <span className="section-header__count">{upcomingEvents.length}</span>
                    </div>
                </div>

                <div className="section-body">
                    {upcomingEvents.length === 0 ? (
                        <div className="section-body--empty">
                            <div className="section-body--empty-icon">📭</div>
                            Žádné nadcházející akce
                        </div>
                    ) : (
                        upcomingEvents.map((e) => (
                            <EventCard
                                key={e.id}
                                event={e}
                                isPast={false}
                                currentUser={currentUser}
                                onJoin={handleJoin}
                                onLeave={handleLeave}
                                onDelete={requestDelete}
                                onEdit={openEditModal}
                                canDelete={canDeleteAny || e.createdBy?.uid === currentUser?.uid}
                                formatDate={formatDate}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* Past Events */}
            <section>
                <div
                    className={`section-header section-header--clickable ${showPast ? 'open' : ''}`}
                    onClick={() => setShowPast(!showPast)}
                >
                    <span className="section-header__title">
                        <span>🕐</span>
                        <span>Proběhlé</span>
                    </span>
                    <div className="section-header__meta">
                        <span className="section-header__count">{pastEvents.length}</span>
                        <span className={`section-header__chevron ${showPast ? 'open' : ''}`}>▼</span>
                    </div>
                </div>

                {showPast && pastEvents.length > 0 && (
                    <div className="section-body">
                        {pastEvents.map((e) => (
                            <EventCard
                                key={e.id}
                                event={e}
                                isPast={true}
                                currentUser={currentUser}
                                onJoin={handleJoin}
                                onLeave={handleLeave}
                                onDelete={requestDelete}
                                onEdit={openEditModal}
                                canDelete={canDeleteAny || e.createdBy?.uid === currentUser?.uid}
                                formatDate={formatDate}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <CreateEventModal
                    onClose={handleCloseModal}
                    currentUser={currentUser}
                    userData={userData}
                    showToast={showToast}
                    initialData={editEvent}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
                    <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Smazat akci?</h3>
                        <p className="confirm-modal__message">
                            Opravdu chcete smazat akci <strong>"{deleteModal.title}"</strong>?
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

function EventCard({ event, isPast, currentUser, onJoin, onLeave, onDelete, onEdit, canDelete, formatDate }) {
    const [expanded, setExpanded] = useState(false);

    const isJoined = event.participants?.some(p => p.uid === currentUser?.uid);
    const count = event.participants?.length || 0;
    const dateInfo = formatDate(event.date);

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
                        <span>{event.title}</span>
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
                                onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                                title="Upravit"
                            >
                                ✏️
                            </button>
                            <button
                                className="event-card__delete-btn"
                                onClick={(e) => { e.stopPropagation(); onDelete(event); }}
                                title="Smazat"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Meta Info */}
                <div className="event-card__meta">
                    {event.departureTime && (
                        <>
                            <span className="event-card__meta-item" title="Čas odjezdu">
                                🚌 {event.departureTime}
                            </span>
                            <span className="event-card__meta-sep">•</span>
                        </>
                    )}
                    <span className="event-card__meta-item" title="Čas konání">
                        ⏰ {event.time}{event.timeEnd ? ` – ${event.timeEnd}` : ''}
                    </span>
                    <span className="event-card__meta-sep">•</span>
                    <span className="event-card__meta-item">
                        📍 {event.location || 'Stanice'}
                    </span>
                </div>

                {event.description && (
                    <div className="event-card__description">{event.description}</div>
                )}

                {/* Footer */}
                <div className="event-card__footer">
                    <div
                        className={`participants-count ${count > 0 ? 'participants-count--clickable' : ''}`}
                        onClick={() => count > 0 && setExpanded(!expanded)}
                    >
                        <span className="participants-count__icon">👥</span>
                        <span className="participants-count__number">
                            {count}{event.maxParticipants ? `/${event.maxParticipants}` : ''}
                        </span>
                        {count > 0 && (
                            <span className={`participants-count__chevron ${expanded ? 'open' : ''}`}>▼</span>
                        )}
                    </div>

                    {!isPast && (
                        isJoined ? (
                            <button className="event-action-btn event-action-btn--leave" onClick={() => onLeave(event)}>
                                Odhlásit
                            </button>
                        ) : (
                            <button className="event-action-btn event-action-btn--join" onClick={() => onJoin(event)}>
                                Přihlásit
                            </button>
                        )
                    )}
                </div>

                {/* Expanded Participants List */}
                {expanded && count > 0 && (
                    <div className="participants-list">
                        {event.participants.map(p => (
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

function CreateEventModal({ onClose, currentUser, userData, showToast, initialData }) {
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
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#999',
                                        fontSize: '1.2rem',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        lineHeight: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
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
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#999',
                                            fontSize: '1.2rem',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            lineHeight: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
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
