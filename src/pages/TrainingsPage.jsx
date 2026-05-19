import React from 'react';
import useTrainings from '../hooks/useTrainings';
import TrainingCard from '../components/trainings/TrainingCard';
import CreateTrainingModal from '../components/trainings/CreateTrainingModal';

export default function TrainingsPage() {
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
        editTraining,
        canCreate,
        canDeleteAny,
        upcomingTrainings,
        pastTrainings,
        handleJoin,
        handleLeave,
        requestDelete,
        confirmDelete,
        openEditModal,
        handleCloseModal,
        showToast
    } = useTrainings();

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
                        <button className="page-header__action" onClick={() => openEditModal(null)}>
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
