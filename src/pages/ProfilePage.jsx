import React from 'react';
import { Link } from 'react-router-dom';
import useProfile from '../hooks/useProfile';
import ProfileInfo from '../components/profile/ProfileInfo';
import EquipmentSection from '../components/profile/EquipmentSection';
import EquipmentModal from '../components/profile/EquipmentModal';
import ConfirmModal from '../components/profile/ConfirmModal';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator';

export default function ProfilePage() {
    const {
        userData,
        isEditing,
        setIsEditing,
        editForm,
        setEditForm,
        equipmentTypes,
        showEqModal,
        setShowEqModal,
        currentEq,
        setCurrentEq,
        confirmModal,
        setConfirmModal,
        handleLogout,
        handleUpdateProfile,
        handleSaveEquipment,
        handleDeleteEquipment,
        refresh
    } = useProfile();

    const { isRefreshing, pullProgress } = usePullToRefresh(refresh);

    if (!userData) {
        return (
            <div className="page-layout flex-center" style={{ textAlign: 'center' }}>
                <div className="card">
                    <h2 style={{ color: 'var(--primary-red)' }}>Chyba profilu</h2>
                    <p className="mt-2">Váš uživatelský profil nebyl nalezen. Kontaktujte administrátora.</p>
                    <button className="btn btn-secondary mt-2" onClick={handleLogout}>Odhlásit se</button>
                </div>
            </div>
        );
    }

    if (!userData.approved) {
        return (
            <div className="page-layout flex-center" style={{ textAlign: 'center' }}>
                <div className="card">
                    <h2 style={{ color: 'var(--primary-red)' }}>Čekání na schválení</h2>
                    <p className="mt-2">Váš účet musí být schválen správcem systému (VJ).</p>
                    <button className="btn btn-secondary mt-2" onClick={handleLogout}>Odhlásit se</button>
                </div>
            </div>
        );
    }

    const userRoles = userData.roles || [userData.role || 'Hasič'];
    const allEquipment = userData.equipmentList || [];

    return (
        <div className="container mt-4" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '2rem' }}>
            <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />
            {/* Confirm Modal */}
            {confirmModal && (
                <ConfirmModal
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* HERO HEADER */}
            <div style={{
                background: 'linear-gradient(135deg, #263238 0%, #37474F 100%)',
                borderRadius: 'var(--radius)',
                padding: '2.5rem 2rem',
                color: 'white',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                marginBottom: '2rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '2rem',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Background Decorative Element */}
                <div style={{
                    position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
                    borderRadius: '50%', pointerEvents: 'none'
                }} />

                {/* Avatar Circle */}
                <div style={{
                    width: '100px', height: '100px',
                    background: 'linear-gradient(135deg, var(--primary-red), var(--primary-red-dark))',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2.5rem', fontWeight: 700,
                    color: 'white',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    border: '4px solid rgba(255,255,255,0.1)'
                }}>
                    {(userData.firstName?.[0] || '') + (userData.lastName?.[0] || '')}
                </div>

                {/* User Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'white' }}>
                        {userData.firstName} {userData.lastName}
                    </h1>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {userData.registrationNumber && (
                            <span style={{
                                background: 'rgba(255, 193, 7, 0.15)',
                                color: '#FFD54F',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '50px',
                                fontSize: '0.85rem', fontWeight: 600,
                                border: '1px solid rgba(255, 193, 7, 0.3)'
                            }}>
                                Ev. č. {userData.registrationNumber}
                            </span>
                        )}
                        {userRoles.map(role => (
                            <span key={role} style={{
                                background: 'rgba(255,255,255,0.15)',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '50px',
                                fontSize: '0.85rem', fontWeight: 600,
                                border: '1px solid rgba(255,255,255,0.2)'
                            }}>
                                {role}
                            </span>
                        ))}
                        {userData.approved && (
                            <span style={{
                                background: 'rgba(76, 175, 80, 0.2)',
                                color: '#81C784',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '50px',
                                fontSize: '0.85rem', fontWeight: 600,
                                border: '1px solid rgba(76, 175, 80, 0.3)'
                            }}>
                                ✓ Aktivní účet
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN GRID CONTENT */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '1.5rem'
            }}>
                {/* Left Col: Personal Info & Equipment */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <ProfileInfo
                        userData={userData}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        handleUpdateProfile={handleUpdateProfile}
                    />

                    <EquipmentSection
                        equipmentTypes={equipmentTypes}
                        allEquipment={allEquipment}
                        setCurrentEq={setCurrentEq}
                        setShowEqModal={setShowEqModal}
                        handleDeleteEquipment={handleDeleteEquipment}
                    />
                </div>

                {/* Right Col: Certifications & System Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Certifications Card */}
                    <div className="card">
                        <h3 style={{ fontSize: '1.25rem', color: '#333', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                            🎓 Kvalifikace a Oprávnění
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                            {userData.certifications && userData.certifications.length > 0 ? (
                                userData.certifications.map(cert => (
                                    <span key={cert} style={{
                                        background: '#FFF3E0', color: '#E65100',
                                        padding: '0.5rem 1rem', borderRadius: '8px',
                                        fontWeight: 600, border: '1px solid #ffe0b2',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                                    }}>
                                        {cert}
                                    </span>
                                ))
                            ) : (
                                <p style={{ color: '#888', fontStyle: 'italic' }}>Žádané kvalifikace.</p>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions / System */}
                    <div className="card" style={{ background: '#fafafa' }}>
                        <h3 style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem', textTransform: 'uppercase' }}>
                            Systémové akce
                        </h3>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <Link to="/statistiky" className="btn btn-secondary" style={{ flex: 1 }}>
                                📊 Moje Statistiky
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* EQUIPMENT MODAL */}
            {showEqModal && (
                <EquipmentModal
                    onClose={() => setShowEqModal(false)}
                    currentEq={currentEq}
                    setCurrentEq={setCurrentEq}
                    equipmentTypes={equipmentTypes}
                    handleSaveEquipment={handleSaveEquipment}
                />
            )}
        </div>
    );
}
