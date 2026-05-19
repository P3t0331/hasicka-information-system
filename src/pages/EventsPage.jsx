import React from 'react';
import useEvents from '../hooks/useEvents';
import EventCard from '../components/events/EventCard';
import CreateEventModal from '../components/events/CreateEventModal';

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
