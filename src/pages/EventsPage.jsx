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
                <div style={{
                    position: 'fixed',
                    top: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    background: toast.type === 'error' ? '#FFEBEE' : toast.type === 'warning' ? '#FFF8E1' : '#E8F5E9',
                    color: toast.type === 'error' ? '#B71C1C' : toast.type === 'warning' ? '#F57C00' : '#1B5E20',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    zIndex: 2100,
                    fontSize: '0.9rem',
                    fontWeight: 500
                }} onClick={() => setToast(null)}>
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #FF6F00, #EF6C00)', // Orange/Red gradient
                borderRadius: '12px',
                padding: '1.25rem',
                color: 'white',
                marginBottom: '1.5rem',
                boxShadow: '0 4px 20px rgba(239, 108, 0, 0.25)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>🚩 Akce a události</h1>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.25rem' }}>
                            {upcomingEvents.length} nadcházející • {pastEvents.length} proběhlých
                        </div>
                    </div>
                    {canCreate && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                color: 'white',
                                border: '1px solid rgba(255,255,255,0.3)',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            + Nová akce
                        </button>
                    )}
                </div>
            </div>

            {/* Upcoming */}
            <section style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #D84315, #BF360C)', // Deep Orange
                    color: 'white',
                    padding: '0.6rem 1rem',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'white' }}>📅 Nadcházející</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>{upcomingEvents.length}</span>
                </div>

                <div style={{ border: '1px solid #FFCCBC', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                    {upcomingEvents.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                            Žádné nadcházející akce
                        </div>
                    ) : (
                        upcomingEvents.map((e, i) => (
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
                                isLast={i === upcomingEvents.length - 1}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* Past */}
            <section>
                <div
                    onClick={() => setShowPast(!showPast)}
                    style={{
                        background: '#EEEEEE',
                        padding: '0.6rem 1rem',
                        borderRadius: showPast ? '8px 8px 0 0' : '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#666' }}>🕐 Proběhlé</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{pastEvents.length}</span>
                        <span style={{ color: '#999', transform: showPast ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                </div>

                {showPast && pastEvents.length > 0 && (
                    <div style={{ border: '1px solid #E0E0E0', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                        {pastEvents.map((e, i) => (
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
                                isLast={i === pastEvents.length - 1}
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
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1001,
                        padding: '1rem'
                    }}
                    onClick={() => setDeleteModal(null)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            width: '100%',
                            maxWidth: '350px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.1rem', color: '#333' }}>Smazat akci?</h3>
                        <p style={{ margin: '0 0 1.25rem 0', color: '#666', fontSize: '0.9rem' }}>
                            Opravdu chcete smazat akci <strong>"{deleteModal.title}"</strong>?
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setDeleteModal(null)}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem',
                                    background: '#F5F5F5',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    fontWeight: 500
                                }}
                            >
                                Zrušit
                            </button>
                            <button
                                onClick={confirmDelete}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem',
                                    background: '#E53935',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Smazat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function EventCard({ event, isPast, currentUser, onJoin, onLeave, onDelete, onEdit, canDelete, formatDate, isLast }) {
    const [expanded, setExpanded] = useState(false);

    const isJoined = event.participants?.some(p => p.uid === currentUser?.uid);
    const count = event.participants?.length || 0;
    const dateInfo = formatDate(event.date);

    return (
        <div style={{
            padding: '0.875rem',
            background: isPast ? '#FAFAFA' : 'white',
            borderBottom: isLast ? 'none' : '1px solid #eee',
            opacity: isPast ? 0.7 : 1
        }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                {/* Date Badge */}
                <div style={{
                    background: isPast ? '#BDBDBD' : isJoined ? '#D84315' : '#FF6F00', // Different orange/red
                    color: 'white',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    minWidth: '50px',
                    flexShrink: 0
                }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>{dateInfo.day}</div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}>{dateInfo.month}</div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: isPast ? '#666' : '#333' }}>
                                    {event.title}
                                </span>
                                {canDelete && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                                        title="Upravit"
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#FFAB91',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            padding: '0 0.3rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            opacity: 0.7,
                                            transition: 'opacity 0.2s'
                                        }}
                                        onMouseEnter={e => e.target.style.opacity = 1}
                                        onMouseLeave={e => e.target.style.opacity = 0.7}
                                    >
                                        ✏️
                                    </button>
                                )}
                                {isJoined && !isPast && (
                                    <span style={{
                                        fontSize: '0.6rem',
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        background: '#FBE9E7',
                                        color: '#D84315'
                                    }}>
                                        ✓
                                    </span>
                                )}
                                {isPast && (
                                    <span style={{
                                        fontSize: '0.6rem',
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '4px',
                                        fontWeight: 600,
                                        background: '#EEEEEE',
                                        color: '#757575'
                                    }}>
                                        Proběhlo
                                    </span>
                                )}
                            </div>

                            {/* Time & Location */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#555', fontSize: '0.9rem' }}>
                                {event.departureTime && (
                                    <>
                                        <span title="Čas odjezdu">🚌 {event.departureTime}</span>
                                        <span style={{ margin: '0 0.1rem', color: '#ccc' }}>•</span>
                                    </>
                                )}
                                <span title="Čas konání">⏰ {event.time}{event.timeEnd ? ` – ${event.timeEnd}` : ''}</span>
                                <span style={{ margin: '0 0.3rem', color: '#ccc' }}>•</span>
                                <span>📍 {event.location || 'Stanice'}</span>
                            </div>
                        </div>

                        {canDelete && (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                    onClick={() => onDelete(event)}
                                    title="Smazat"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#ccc',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        padding: '0.2rem',
                                        flexShrink: 0
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>

                    {event.description && (
                        <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.35rem' }}>
                            {event.description}
                        </div>
                    )}

                    <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div
                            onClick={() => count > 0 && setExpanded(!expanded)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                cursor: count > 0 ? 'pointer' : 'default',
                                padding: '0.25rem 0.5rem',
                                background: '#F5F5F5',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                color: '#666'
                            }}
                        >
                            <span>👥</span>
                            <span style={{ fontWeight: 600 }}>{count}{event.maxParticipants ? `/${event.maxParticipants}` : ''}</span>
                            {count > 0 && <span style={{ fontSize: '0.65rem', color: '#999' }}>{expanded ? '▲' : '▼'}</span>}
                        </div>

                        {!isPast && (
                            isJoined ? (
                                <button
                                    onClick={() => onLeave(event)}
                                    style={{
                                        background: 'transparent',
                                        color: '#E53935',
                                        border: '1px solid #EF9A9A',
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Odhlásit
                                </button>
                            ) : (
                                <button
                                    onClick={() => onJoin(event)}
                                    style={{
                                        background: '#FF6F00',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Přihlásit
                                </button>
                            )
                        )}
                    </div>

                    {expanded && count > 0 && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            background: '#F8F9FA',
                            borderRadius: '6px',
                            fontSize: '0.75rem'
                        }}>
                            {event.participants.map(p => (
                                <div key={p.uid} style={{
                                    padding: '0.2rem 0',
                                    color: p.uid === currentUser?.uid ? '#D84315' : '#666',
                                    fontWeight: p.uid === currentUser?.uid ? 600 : 400
                                }}>
                                    {p.uid === currentUser?.uid && '⭐ '}{p.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
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
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001,
                padding: '1rem'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '1.25rem',
                width: '100%',
                maxWidth: '400px',
                maxHeight: '90vh',
                overflow: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{isEdit ? '✏️ Upravit akci' : '🚩 Nová akce'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#999' }}>✕</button>
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

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Zrušit</button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Ukládám...' : (isEdit ? 'Uložit změny' : 'Vytvořit')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
