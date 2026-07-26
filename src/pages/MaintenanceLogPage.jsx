import React from 'react';
import useDailyLog from '../hooks/useDailyLog';
import useMembers from '../hooks/useMembers';
import MonthlyLogTable from '../components/logs/MonthlyLogTable';
import LogEntryEditor from '../components/logs/LogEntryEditor';
import { LOG_PRESETS_MAINTENANCE } from '../utils/constants';

const ACCENT = { from: '#FF6F00', to: '#E65100' };

export default function MaintenanceLogPage() {
    const {
        currentUser,
        userData,
        loading,
        visibleEntries,
        currentDate,
        handleMonthChange,
        canCreate,
        canModifyEntry,
        showEditor,
        editingEntry,
        editorPrefillDate,
        openCreateEditor,
        openEditEditor,
        closeEditor,
        saveEntry,
        deleteModal,
        setDeleteModal,
        requestDelete,
        confirmDelete,
        onlyMine,
        setOnlyMine,
    } = useDailyLog('maintenanceLogs', 'maintenance', 'údržby');

    const { filteredMembers: members } = useMembers();

    if (loading) {
        return (
            <div className="container mt-4" style={{ textAlign: 'center', padding: '3rem' }}>
                <p>Načítám záznamy...</p>
            </div>
        );
    }

    return (
        <>
            <MonthlyLogTable
                title="🔧 Údržba VPPO a PT"
                accentColor={ACCENT}
                currentDate={currentDate}
                entries={visibleEntries}
                canCreate={canCreate}
                canModifyEntry={canModifyEntry}
                onAddForDay={(date) => openCreateEditor(date)}
                onAddGeneric={() => openCreateEditor(null)}
                onEditEntry={openEditEditor}
                onDeleteEntry={requestDelete}
                onMonthChange={handleMonthChange}
                onlyMine={onlyMine}
                setOnlyMine={setOnlyMine}
            />

            {showEditor && (
                <LogEntryEditor
                    title="Přidat záznam údržby"
                    presets={LOG_PRESETS_MAINTENANCE}
                    members={members}
                    initialEntry={editingEntry}
                    prefillDate={editorPrefillDate}
                    currentUser={currentUser}
                    userData={userData}
                    onClose={closeEditor}
                    onSave={saveEntry}
                />
            )}

            {deleteModal && (
                <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
                    <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Smazat záznam?</h3>
                        <p className="confirm-modal__message">
                            Opravdu chcete smazat záznam <strong>„{deleteModal.description}"</strong> ({deleteModal.date})?
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
        </>
    );
}
