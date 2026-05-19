import React from 'react';
import useEvents from '../hooks/useEvents';
import EventCard from '../components/events/EventCard';
import CreateEventModal from '../components/events/CreateEventModal';
import { MONTHS_CZ_FILTER } from '../utils/constants';

export default function EventsPage() {
    const {
        currentUser,
        userData,
        loading,
        showCreateModal,
        showPast,
        setShowPast,
        toast,
        setToast,
        deleteModal,
        setDeleteModal,
        editEvent,
        canCreate,
        canDeleteAny,
        upcomingEvents,
        pastEvents,
        handleJoin,
        handleLeave,
        requestDelete,
        confirmDelete,
        openEditModal,
        handleCloseModal,
        showToast
    } = useEvents();

    const [filterYear, setFilterYear] = React.useState('all');
    const [filterMonth, setFilterMonth] = React.useState('all');
    const [upcomingFilter, setUpcomingFilter] = React.useState('all');

    const uniqueYears = Array.from(new Set(pastEvents.map(e => e.date.split('-')[0]))).sort((a, b) => b.localeCompare(a));

    const today = new Date();
    const currentYearStr = today.getFullYear().toString();
    const currentMonthStr = (today.getMonth() + 1).toString().padStart(2, '0');

    const filteredUpcomingEvents = upcomingEvents.filter(e => {
        if (upcomingFilter === 'thisMonth') {
            const parts = e.date.split('-');
            return parts[0] === currentYearStr && parts[1] === currentMonthStr;
        }
        return true;
    });

    const filteredPastEvents = pastEvents.filter(e => {
        const parts = e.date.split('-');
        const itemYear = parts[0];
        const itemMonth = parts[1];
        const matchesYear = filterYear === 'all' || itemYear === filterYear;
        const matchesMonth = filterMonth === 'all' || itemMonth === filterMonth;
        return matchesYear && matchesMonth;
    });

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
                        <button className="page-header__action" onClick={() => openEditModal(null)}>
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
                        <span className="section-header__count">{filteredUpcomingEvents.length}</span>
                    </div>
                </div>

                <div className="section-body">
                    {upcomingEvents.length > 0 && (
                        <div style={{
                            display: 'flex',
                            gap: '0.5rem',
                            padding: '0.75rem 1rem',
                            background: '#f8f9fa',
                            borderBottom: '1px solid #e9ecef',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: '#495057', fontWeight: 600, marginRight: '0.5rem' }}>Filtr:</span>
                            <button
                                onClick={() => setUpcomingFilter('all')}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    border: '1px solid',
                                    borderColor: upcomingFilter === 'all' ? '#1565C0' : '#ced4da',
                                    background: upcomingFilter === 'all' ? '#E3F2FD' : 'white',
                                    color: upcomingFilter === 'all' ? '#1565C0' : '#495057',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Všechny
                            </button>
                            <button
                                onClick={() => setUpcomingFilter('thisMonth')}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '20px',
                                    border: '1px solid',
                                    borderColor: upcomingFilter === 'thisMonth' ? '#1565C0' : '#ced4da',
                                    background: upcomingFilter === 'thisMonth' ? '#E3F2FD' : 'white',
                                    color: upcomingFilter === 'thisMonth' ? '#1565C0' : '#495057',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Tento měsíc
                            </button>
                        </div>
                    )}

                    {filteredUpcomingEvents.length === 0 ? (
                        <div className="section-body--empty">
                            <div className="section-body--empty-icon">📭</div>
                            Žádné nadcházející akce odpovídající filtru
                        </div>
                    ) : (
                        filteredUpcomingEvents.map((e) => (
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

                {showPast && (
                    <>
                        {pastEvents.length > 0 && (
                            <div style={{
                                display: 'flex',
                                gap: '0.75rem',
                                marginBottom: '1rem',
                                padding: '0.75rem 1rem',
                                background: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #e9ecef',
                                flexWrap: 'wrap',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '0.9rem', color: '#495057', fontWeight: 600 }}>Filtr:</span>
                                
                                <select
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #ced4da',
                                        background: 'white',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="all">Všechny roky</option>
                                    {uniqueYears.map(yr => (
                                        <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                </select>

                                <select
                                    value={filterMonth}
                                    onChange={e => setFilterMonth(e.target.value)}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #ced4da',
                                        background: 'white',
                                        fontSize: '0.9rem',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {MONTHS_CZ_FILTER.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                                
                                {(filterYear !== 'all' || filterMonth !== 'all') && (
                                    <button
                                        onClick={() => { setFilterYear('all'); setFilterMonth('all'); }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#dc3545',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            padding: '0.25rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        Zrušit filtry
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="section-body">
                            {filteredPastEvents.length === 0 ? (
                                <div className="section-body--empty" style={{ padding: '2rem' }}>
                                    <div className="section-body--empty-icon">🔍</div>
                                    Žádné proběhlé akce odpovídající filtrům
                                </div>
                            ) : (
                                filteredPastEvents.map((e) => (
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
                                    />
                                ))
                            )}
                        </div>
                    </>
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
