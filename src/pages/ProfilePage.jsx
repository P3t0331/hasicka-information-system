import React from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '../firebase';
import useProfile from '../hooks/useProfile';
import ProfileInfo from '../components/profile/ProfileInfo';
import EquipmentSection from '../components/profile/EquipmentSection';
import QuizHistory from '../components/profile/QuizHistory';
import EquipmentModal from '../components/profile/EquipmentModal';
import ConfirmModal from '../components/profile/ConfirmModal';
import { generateICS, downloadICS, activityToICSEvent, shiftSlotToICSEvent } from '../utils/icsExport';

export default function ProfilePage() {
    const {
        currentUser,
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

    const handleExportAll = async () => {
        const today = new Date();
        const pad = n => String(n).padStart(2, '0');
        const monthDocIds = [0, 1, 2].map(offset => {
            const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        });
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        const [shiftDocs, trainingsSnap, eventsSnap] = await Promise.all([
            Promise.all(monthDocIds.map(id => getDoc(doc(db, 'shifts', id)))),
            getDocs(collection(db, 'trainings')),
            getDocs(collection(db, 'events')),
        ]);

        const events = [];

        shiftDocs.forEach((docSnap, idx) => {
            if (!docSnap.exists()) return;
            const [yearStr, monthStr] = monthDocIds[idx].split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const daysData = docSnap.data().days || {};
            Object.entries(daysData).forEach(([dayStr, dayData]) => {
                const day = parseInt(dayStr, 10);
                ['nightShift', 'dayShift', 'zalohaStaz'].forEach(section => {
                    const sectionData = dayData[section];
                    if (!sectionData) return;
                    const zalohaConfig = section === 'zalohaStaz' ? sectionData.config : undefined;
                    Object.entries(sectionData).forEach(([slotKey, slotData]) => {
                        if (slotKey === 'config' || slotKey === 'interested') return;
                        if (slotData && slotData.uid === currentUser.uid) {
                            events.push(shiftSlotToICSEvent(year, month, day, section, slotKey, slotData, zalohaConfig));
                        }
                    });
                });
            });
        });

        trainingsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(t => t.date >= todayStr && t.participants?.some(p => p.uid === currentUser.uid))
            .forEach(t => events.push(activityToICSEvent(t, 'training')));

        eventsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(e => e.date >= todayStr && e.participants?.some(p => p.uid === currentUser.uid))
            .forEach(e => events.push(activityToICSEvent(e, 'event')));

        events.sort((a, b) => a.dtstart.localeCompare(b.dtstart));
        downloadICS(generateICS(events), 'hasicka-kalendar.ics');
    };

    return (
        <>
            <style>{`
                .profile-hero {
                    background: linear-gradient(160deg, var(--profile-hero-grad-1) 0%, var(--profile-hero-grad-2) 55%, var(--profile-hero-grad-3) 100%);
                    border-bottom: 3px solid var(--primary-red);
                    padding: 2.75rem 2rem;
                    color: white;
                    position: relative;
                    overflow: hidden;
                }
                .profile-hero::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background:
                        radial-gradient(ellipse at 75% 50%, rgba(211,47,47,0.14) 0%, transparent 60%),
                        radial-gradient(ellipse at 10% 80%, rgba(211,47,47,0.06) 0%, transparent 50%);
                    pointer-events: none;
                }
                .profile-hero-inner {
                    max-width: 1300px;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    gap: 2rem;
                    position: relative;
                    z-index: 1;
                }
                .profile-avatar {
                    width: 100px;
                    height: 100px;
                    background: linear-gradient(135deg, var(--primary-red) 0%, var(--primary-red-dark) 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2.5rem;
                    font-weight: 700;
                    color: white;
                    font-family: 'Oswald', sans-serif;
                    letter-spacing: 2px;
                    box-shadow: 0 0 0 4px rgba(211,47,47,0.25), 0 8px 28px rgba(0,0,0,0.5);
                    flex-shrink: 0;
                    user-select: none;
                }
                .profile-hero-name {
                    font-family: 'Oswald', sans-serif;
                    font-size: 2.6rem;
                    font-weight: 700;
                    color: white;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    line-height: 1.05;
                    margin-bottom: 0.8rem;
                }
                .profile-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.45rem;
                    align-items: center;
                }
                .profile-badge {
                    padding: 0.28rem 0.8rem;
                    border-radius: 50px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    letter-spacing: 0.3px;
                    line-height: 1.5;
                }
                .profile-layout {
                    max-width: 1300px;
                    margin: 0 auto;
                    padding: 2rem 1.5rem 3rem;
                    display: grid;
                    grid-template-columns: 320px 1fr;
                    gap: 1.75rem;
                    align-items: start;
                }
                .profile-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    position: sticky;
                    top: 76px;
                }
                .profile-cert-card {
                    background: var(--glass-bg);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    padding: 1.5rem;
                    border-radius: var(--radius);
                    box-shadow: var(--shadow-soft);
                    border: var(--glass-border);
                }
                .profile-cert-heading {
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    margin-bottom: 0.85rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--border);
                }
                .profile-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 0.6rem;
                }
                @media (max-width: 920px) {
                    .profile-layout {
                        grid-template-columns: 1fr;
                    }
                    .profile-sidebar {
                        position: static;
                    }
                    .profile-actions {
                        flex-direction: row;
                    }
                    .profile-actions .btn {
                        flex: 1;
                    }
                }
                @media (max-width: 640px) {
                    .profile-hero {
                        padding: 1.75rem 1.25rem;
                    }
                    .profile-hero-name {
                        font-size: 1.8rem;
                    }
                    .profile-avatar {
                        width: 72px;
                        height: 72px;
                        font-size: 1.8rem;
                    }
                    .profile-layout {
                        padding: 1.25rem 1rem 2.5rem;
                        gap: 1.25rem;
                    }
                    .profile-actions {
                        flex-direction: column;
                    }
                }
            `}</style>

            {confirmModal && (
                <ConfirmModal
                    message={confirmModal.message}
                    onConfirm={confirmModal.onConfirm}
                    onCancel={() => setConfirmModal(null)}
                />
            )}

            {/* HERO */}
            <div className="profile-hero">
                <div className="profile-hero-inner">
                    <div className="profile-avatar">
                        {(userData.firstName?.[0] || '') + (userData.lastName?.[0] || '')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="profile-hero-name">
                            {userData.firstName} {userData.lastName}
                        </div>
                        <div className="profile-badges">
                            {userData.registrationNumber && (
                                <span className="profile-badge" style={{
                                    background: 'rgba(255,193,7,0.13)',
                                    color: 'var(--gold-text-on-dark)',
                                    border: '1px solid rgba(255,193,7,0.32)'
                                }}>
                                    Ev. č.&nbsp;{userData.registrationNumber}
                                </span>
                            )}
                            {userRoles.map(role => (
                                <span key={role} className="profile-badge" style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.88)',
                                    border: '1px solid rgba(255,255,255,0.18)'
                                }}>
                                    {role}
                                </span>
                            ))}
                            {userData.approved && (
                                <span className="profile-badge" style={{
                                    background: 'rgba(76,175,80,0.18)',
                                    color: 'var(--success-text-on-dark)',
                                    border: '1px solid rgba(76,175,80,0.32)'
                                }}>
                                    ✓ Aktivní
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN LAYOUT */}
            <div className="profile-layout">

                {/* SIDEBAR */}
                <div className="profile-sidebar">
                    <ProfileInfo
                        userData={userData}
                        isEditing={isEditing}
                        setIsEditing={setIsEditing}
                        editForm={editForm}
                        setEditForm={setEditForm}
                        handleUpdateProfile={handleUpdateProfile}
                    />

                    <div className="profile-cert-card">
                        <div className="profile-cert-heading">Kvalifikace a oprávnění</div>
                        {userData.certifications?.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {userData.certifications.map(cert => (
                                    <span key={cert} style={{
                                        background: 'var(--warning-bg)',
                                        color: 'var(--warning-dark)',
                                        padding: '0.38rem 0.85rem',
                                        borderRadius: '8px',
                                        fontSize: '0.88rem',
                                        fontWeight: 600,
                                        border: '1px solid var(--warning-border)'
                                    }}>
                                        {cert}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.88rem', margin: 0 }}>
                                Žádné kvalifikace.
                            </p>
                        )}
                    </div>

                    <div className="profile-actions">
                        <Link to="/statistiky" className="btn btn-secondary" style={{ textAlign: 'center', fontSize: '0.9rem', padding: '0.7rem 1.25rem' }}>
                            Moje statistiky
                        </Link>
                        <button onClick={handleExportAll} className="btn btn-secondary" style={{ fontSize: '0.9rem', padding: '0.7rem 1.25rem' }}>
                            Export kalendáře
                        </button>
                    </div>
                </div>

                {/* EQUIPMENT + QUIZ HISTORY */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    <EquipmentSection
                        equipmentTypes={equipmentTypes}
                        allEquipment={allEquipment}
                        setCurrentEq={setCurrentEq}
                        setShowEqModal={setShowEqModal}
                        handleDeleteEquipment={handleDeleteEquipment}
                    />
                    <QuizHistory />
                </div>
            </div>

            {showEqModal && (
                <EquipmentModal
                    onClose={() => setShowEqModal(false)}
                    currentEq={currentEq}
                    setCurrentEq={setCurrentEq}
                    equipmentTypes={equipmentTypes}
                    handleSaveEquipment={handleSaveEquipment}
                />
            )}
        </>
    );
}
