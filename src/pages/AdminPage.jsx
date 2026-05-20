import React from 'react';
import { Link } from 'react-router-dom';
import useAdmin from '../hooks/useAdmin';
import UsersTab from '../components/admin/UsersTab';
import EquipmentTypesTab from '../components/admin/EquipmentTypesTab';
import DetailedInventoryTab from '../components/admin/DetailedInventoryTab';
import LogsTab from '../components/admin/LogsTab';
import AddEquipmentTypeModal from '../components/admin/modals/AddEquipmentTypeModal';

export default function AdminPage() {
  const {
    currentUser,
    userData,
    dataLoading,
    pendingUsers,
    allUsers,
    equipmentTypes,
    showEqModal,
    setShowEqModal,
    newEq,
    setNewEq,
    activeTab,
    setActiveTab,
    activityLogs,
    setActivityLogs,
    logsLoading,
    setLogsLoading,
    logsLoaded,
    setLogsLoaded,
    logFilterUser,
    setLogFilterUser,
    logFilterCategory,
    setLogFilterCategory,
    stats,
    notification,
    confirmModal,
    setConfirmModal,
    userRoles,
    isAdminOrVJ,
    handleAddEq,
    handleRemoveEq,
    approveUser,
    rejectPendingUser,
    deactivateUser,
    deleteUser,
    toggleUserRole,
    toggleUserCertification,
    updateRegistrationNumber,
    onSaveEquipment,
    onDeleteEquipment
  } = useAdmin();

  if (!userData) return <div className="p-4 text-center">Načítání profilu...</div>;

  if (!isAdminOrVJ) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center', height: '80vh' }}>
        <div className="card" style={{ maxWidth: '400px', borderLeft: '4px solid #d32f2f' }}>
          <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>⛔ Přístup zamítnut</h2>
          <p className="text-secondary">Nemáte dostatečná oprávnění pro přístup do administrace.</p>
          <Link to="/" className="btn btn-secondary mt-3">Zpět na profil</Link>
        </div>
      </div>
    );
  }

  if (dataLoading) return <div className="container mt-4 text-center">Načítání administrace...</div>;

  return (
    <div className="container mt-4 mb-5">
      {/* Notifications */}
      {notification && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 1000,
          padding: '1rem 2rem', borderRadius: '8px',
          background: notification.type === 'success' ? '#E8F5E9' : '#FFEBEE',
          color: notification.type === 'success' ? '#2E7D32' : '#C62828',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <strong>{notification.type === 'success' ? '✓' : '⚠'}</strong>
          {notification.message}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setConfirmModal(null)}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', animation: 'fadeIn 0.2s' }}>
            <h3 className="mb-2">Potvrzení akce</h3>
            <p className="mb-4">{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Zrušit</button>
              <button className="btn btn-primary" onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal(null);
              }}>Potvrdit</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Equipment Type Modal */}
      {showEqModal && (
        <AddEquipmentTypeModal
          newEq={newEq}
          setNewEq={setNewEq}
          onSubmit={handleAddEq}
          onClose={() => setShowEqModal(false)}
        />
      )}

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>Administrace</h1>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Správa členů, rolí a kvalifikací</span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '0.8rem 1.2rem', minWidth: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#666', fontWeight: 'bold' }}>Celkem</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{allUsers.length}</span>
          </div>
          {pendingUsers.length > 0 && (
            <div className="card" style={{ padding: '0.8rem 1.2rem', minWidth: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', border: '2px solid var(--accent-gold)' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#d32f2f', fontWeight: 'bold' }}>Ke schválení</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#d32f2f' }}>{pendingUsers.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation Menu */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '2rem',
        borderBottom: '2px solid #e0e0e0',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none'
      }} className="hide-scrollbar">
        {[
          { id: 'uzivatele', label: '👥 Uživatelé' },
          { id: 'vybaveni', label: `🧰 Vybavení ${equipmentTypes.length > 0 ? `(${equipmentTypes.length})` : ''}` },
          { id: 'prehled', label: '📋 Přehled vybavení' },
          { id: 'logy', label: '📜 Logy' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.6rem 1.4rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--primary-red)' : '#666',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary-red)' : '2px solid transparent',
              marginBottom: '-2px',
              fontSize: '0.9rem',
              whiteSpace: 'nowrap',
              transition: 'color 0.2s',
              flexShrink: 0
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Views */}
      {activeTab === 'uzivatele' && (
        <UsersTab
          allUsers={allUsers}
          pendingUsers={pendingUsers}
          stats={stats}
          currentUser={currentUser}
          userRoles={userRoles}
          approveUser={approveUser}
          deactivateUser={deactivateUser}
          deleteUser={deleteUser}
          toggleUserRole={toggleUserRole}
          toggleUserCertification={toggleUserCertification}
          updateRegistrationNumber={updateRegistrationNumber}
          rejectPendingUser={rejectPendingUser}
        />
      )}

      {activeTab === 'vybaveni' && (
        <EquipmentTypesTab
          equipmentTypes={equipmentTypes}
          onAddClick={() => {
            setNewEq({ id: null, name: '', hasBrand: false, hasSize: false, hasAmount: true, hasInventoryNumber: false, hasSerialNumber: false, hasManufactureYear: false, hasIssueYear: false, hasWear: false });
            setShowEqModal(true);
          }}
          onEditClick={(eq) => {
            setNewEq(eq);
            setShowEqModal(true);
          }}
          onRemoveClick={handleRemoveEq}
        />
      )}

      {activeTab === 'prehled' && (
        <DetailedInventoryTab
          allUsers={allUsers}
          equipmentTypes={equipmentTypes}
          onSaveEquipment={onSaveEquipment}
          onDeleteEquipment={onDeleteEquipment}
        />
      )}

      {activeTab === 'logy' && (
        <LogsTab
          allUsers={allUsers}
          activityLogs={activityLogs}
          setActivityLogs={setActivityLogs}
          logsLoading={logsLoading}
          setLogsLoading={setLogsLoading}
          logsLoaded={logsLoaded}
          setLogsLoaded={setLogsLoaded}
          logFilterUser={logFilterUser}
          setLogFilterUser={setLogFilterUser}
          logFilterCategory={logFilterCategory}
          setLogFilterCategory={setLogFilterCategory}
        />
      )}
    </div>
  );
}
