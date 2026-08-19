import React from 'react';
import useTrainings from '../hooks/useTrainings';
import useMembers from '../hooks/useMembers';
import useMyQuizzes from '../hooks/useMyQuizzes';
import TrainingCard from '../components/trainings/TrainingCard';
import CreateTrainingModal from '../components/trainings/CreateTrainingModal';
import QuizCard from '../components/quizzes/QuizCard';
import { MEMBER_STATUS } from '../../shared/quizStatus.js';
import { MONTHS_CZ_FILTER } from '../utils/constants';
import { generateICS, downloadICS, activityToICSEvent } from '../utils/icsExport';
import { useToast } from '../contexts/ToastContext';

export default function TrainingsPage() {
    const {
        currentUser,
        userData,
        loading,
        showCreateModal,
        setShowCreateModal,
        showPast,
        setShowPast,
        deleteModal,
        setDeleteModal,
        editTraining,
        canCreate,
        canDeleteAny,
        upcomingTrainings,
        pastTrainings,
        templates,
        handleJoin,
        handleLeave,
        requestDelete,
        confirmDelete,
        openEditModal,
        handleCloseModal,
        saveAsTemplate,
        deleteTemplate,
    } = useTrainings();

    const { filteredMembers: members } = useMembers();
    const { myQuizzes } = useMyQuizzes();
    const { addToast } = useToast();

    // Na Školení patří jen kvízy, se kterými má člen ještě co dělat. Splněné,
    // uzavřené i vyčerpané mizí — jejich historie zůstává v Profilu.
    const openQuizzes = React.useMemo(() => myQuizzes.filter(q => (
        q.canStart
        || q.myStatus === MEMBER_STATUS.IN_PROGRESS
        || q.myStatus === MEMBER_STATUS.PENDING_REVIEW
    )), [myQuizzes]);

    const [filterYear, setFilterYear] = React.useState('all');
    const [filterMonth, setFilterMonth] = React.useState('all');
    const [upcomingFilter, setUpcomingFilter] = React.useState('all');
    const [showTemplates, setShowTemplates] = React.useState(false);
    const [activeTemplate, setActiveTemplate] = React.useState(null);

    const handleClose = () => { handleCloseModal(); setActiveTemplate(null); };

    const uniqueYears = Array.from(new Set(pastTrainings.map(t => t.date.split('-')[0]))).sort((a, b) => b.localeCompare(a));

    const today = new Date();
    const currentYearStr = today.getFullYear().toString();
    const currentMonthStr = (today.getMonth() + 1).toString().padStart(2, '0');

    const filteredUpcomingTrainings = upcomingTrainings.filter(t => {
        if (upcomingFilter === 'thisMonth') {
            const parts = t.date.split('-');
            return parts[0] === currentYearStr && parts[1] === currentMonthStr;
        }
        return true;
    });

    const filteredPastTrainings = pastTrainings.filter(t => {
        const parts = t.date.split('-');
        const itemYear = parts[0];
        const itemMonth = parts[1];
        const matchesYear = filterYear === 'all' || itemYear === filterYear;
        const matchesMonth = filterMonth === 'all' || itemMonth === filterMonth;
        return matchesYear && matchesMonth;
    });

    if (loading) {
        return (
            <div className="container mt-4" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>Načítám školení...</p>
            </div>
        );
    }

    return (
        <div className="container mt-4" style={{ maxWidth: '800px', paddingBottom: '3rem' }}>
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

            {/* Templates Section */}
            {canCreate && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <div
                        onClick={() => setShowTemplates(v => !v)}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '0.6rem 0.85rem', borderRadius: '8px',
                            background: '#f5f5f5', border: '1px solid #e0e0e0',
                            cursor: 'pointer', userSelect: 'none'
                        }}
                    >
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#444' }}>
                            📋 Šablony {templates.length > 0 ? `(${templates.length})` : ''}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>{showTemplates ? '▲' : '▼'}</span>
                    </div>
                    {showTemplates && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                            {templates.length === 0 ? (
                                <p style={{ color: '#888', fontSize: '0.85rem', padding: '0.5rem 0.85rem', margin: 0 }}>
                                    Zatím žádné šablony. Vytvořte školení a zaškrtněte "Uložit jako šablonu".
                                </p>
                            ) : templates.map(t => (
                                <div key={t.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.65rem 0.85rem', background: 'white',
                                    border: '1px solid #e0e0e0', borderRadius: '8px', gap: '0.75rem'
                                }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#222' }}>{t.title}</div>
                                        <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.1rem' }}>
                                            {t.time}{t.timeEnd ? ` – ${t.timeEnd}` : ''}
                                            {t.location ? ` · ${t.location}` : ''}
                                            {t.vehicles ? ` · ${t.vehicles}` : ''}
                                            {t.isImportant ? ' · ⚠️ Důležité' : ''}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                        <button
                                            onClick={() => { setActiveTemplate(t); setShowCreateModal(true); }}
                                            style={{
                                                padding: '0.35rem 0.75rem', borderRadius: '6px',
                                                border: '1px solid #90CAF9', background: '#E3F2FD',
                                                color: '#1565C0', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
                                            }}
                                        >Použít</button>
                                        <button
                                            onClick={() => deleteTemplate(t.id)}
                                            style={{
                                                padding: '0.35rem 0.5rem', borderRadius: '6px',
                                                border: '1px solid #ffcdd2', background: '#fff',
                                                color: '#c62828', fontSize: '0.9rem', cursor: 'pointer'
                                            }}
                                        >×</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quizzes */}
            {openQuizzes.length > 0 && (
                <section style={{ marginBottom: '1.5rem' }}>
                    <div className="section-header">
                        <span className="section-header__title">
                            <span>📝</span>
                            <span>Kvízy</span>
                        </span>
                        <div className="section-header__meta">
                            <span className="section-header__count">{openQuizzes.length}</span>
                        </div>
                    </div>
                    <div className="section-body" style={{ padding: '0.85rem', display: 'grid', gap: '0.75rem' }}>
                        {openQuizzes.map((q) => (
                            <QuizCard key={q.id} quiz={q} />
                        ))}
                    </div>
                </section>
            )}

            {/* Upcoming Trainings */}
            <section style={{ marginBottom: '1.5rem' }}>
                <div className="section-header section-header--upcoming">
                    <span className="section-header__title">
                        <span>📅</span>
                        <span>Nadcházející</span>
                    </span>
                    <div className="section-header__meta">
                        <span className="section-header__count">{filteredUpcomingTrainings.length}</span>
                        <button
                            onClick={() => {
                                const joined = upcomingTrainings.filter(t => t.participants?.some(p => p.uid === currentUser?.uid));
                                if (joined.length === 0) { addToast('info', 'Nemáte žádná přihlášená školení k exportu.'); return; }
                                downloadICS(generateICS(joined.map(t => activityToICSEvent(t, 'training'))), 'skoleni.ics');
                            }}
                            title="Exportovat přihlášená školení do kalendáře (.ics)"
                            style={{
                                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: '5px', padding: '0.15rem 0.5rem',
                                cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, color: 'white',
                                display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 500
                            }}
                        >
                            📅 Export
                        </button>
                    </div>
                </div>

                <div className="section-body">
                    {upcomingTrainings.length > 0 && (
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

                    {filteredUpcomingTrainings.length === 0 ? (
                        <div className="section-body--empty">
                            <div className="section-body--empty-icon">📭</div>
                            Žádná nadcházející školení odpovídající filtru
                        </div>
                    ) : (
                        filteredUpcomingTrainings.map((t) => (
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

                {showPast && (
                    <>
                        {pastTrainings.length > 0 && (
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
                            {filteredPastTrainings.length === 0 ? (
                                <div className="section-body--empty" style={{ padding: '2rem' }}>
                                    <div className="section-body--empty-icon">🔍</div>
                                    Žádná proběhlá školení odpovídající filtrům
                                </div>
                            ) : (
                                filteredPastTrainings.map((t) => (
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
                                ))
                            )}
                        </div>
                    </>
                )}
            </section>

            {/* Create/Edit Modal */}
            {showCreateModal && (
                <CreateTrainingModal
                    onClose={handleClose}
                    currentUser={currentUser}
                    userData={userData}
                    initialData={activeTemplate ?? editTraining}
                    members={members}
                    onSaveAsTemplate={saveAsTemplate}
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
