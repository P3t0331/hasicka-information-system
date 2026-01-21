import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

const ROLE_OPTIONS = ['Hasič', 'Strojník', 'VD', 'Zástupce VJ', 'VJ', 'Admin'];
const CERTIFICATION_OPTIONS = [
    'NDT-16', // Nositel dýchací techniky
    'ZZZ-16', // Zdravotník
    'OMP-64', // Obsluha motorových pil
    'Záchrana na vodě',
    'V-40',   // Velitelé družstev
    'Kurz S-40' // Strojníci
];

export default function AdminPage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Admin Data
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Stats
  const [stats, setStats] = useState({ roles: {}, certs: {} });

  // Notifications & Modals
  const [notification, setNotification] = useState(null); // { type: 'success'|'error', message: '' }
  const [confirmModal, setConfirmModal] = useState(null); // { message: '', onConfirm: () => {} }

  // Normalize roles to array
  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
  
  // STRICT CHECK: Admin or VJ/Zástupce only
  const isAdminOrVJ = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

  useEffect(() => {
    if (isAdminOrVJ) {
      fetchAdminData();
    } else {
        setDataLoading(false); // Stop loading so we can show Access Denied
    }
  }, [isAdminOrVJ]);

  useEffect(() => {
      // Calculate stats whenever users change
      const roleCounts = {};
      const certCounts = {};

      ROLE_OPTIONS.forEach(r => roleCounts[r] = 0);
      CERTIFICATION_OPTIONS.forEach(c => certCounts[c] = 0);

      allUsers.forEach(user => {
          if (user.disabled) return;
          const uRoles = user.roles || [user.role || 'Hasič'];
          const uCerts = user.certifications || [];
          
          uRoles.forEach(r => { if (roleCounts[r] !== undefined) roleCounts[r]++ });
          uCerts.forEach(c => { if (certCounts[c] !== undefined) certCounts[c]++ });
      });
      setStats({ roles: roleCounts, certs: certCounts });

  }, [allUsers]);

  // Auto-dismiss notification
  useEffect(() => {
      if (notification) {
          const timer = setTimeout(() => setNotification(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [notification]);

  async function fetchAdminData() {
    setLoading(true);
    setDataLoading(true);
    try {
      // Fetch Pending (approved == false)
      const qPending = query(collection(db, "users"), where("approved", "==", false));
      const querySnapshotPending = await getDocs(qPending);
      const startPending = [];
      querySnapshotPending.forEach((doc) => {
        startPending.push(doc.data());
      });
      setPendingUsers(startPending);

      // Fetch All Confirmed Users (approved == true)
      const qAll = query(collection(db, "users"), where("approved", "==", true));
      const querySnapshotAll = await getDocs(qAll);
      const startAll = [];
      querySnapshotAll.forEach((doc) => {
        startAll.push(doc.data());
      });
      // Sort alphabetically
      startAll.sort((a,b) => (a.lastName || '').localeCompare(b.lastName || ''));
      setAllUsers(startAll);

    } catch (error) {
      console.error("Error fetching admin data:", error);
      showNotification('error', 'Chyba při načítání dat.');
    }
    setLoading(false);
    setDataLoading(false);
  }

  function showNotification(type, message) {
      setNotification({ type, message });
  }

  function requestConfirm(message, onConfirm) {
      setConfirmModal({ message, onConfirm });
  }

  async function approveUser(uid) {
    try {
      await updateDoc(doc(db, "users", uid), { approved: true });
      fetchAdminData(); 
      showNotification('success', 'Uživatel schválen.');
    } catch (error) {
      console.error("Error approving user:", error);
      showNotification('error', 'Chyba při schvalování.');
    }
  }

  async function deactivateUser(uid, shouldDisable) {
    if (uid === currentUser.uid) {
      showNotification('error', "Nemůžete deaktivovat vlastní účet.");
      return;
    }
    
    requestConfirm(
        shouldDisable ? `Opravdu chcete DEAKTIVOVAT tohoto uživatele? Nebude se moci přihlásit.` : `Aktivovat uživatele?`,
        async () => {
            try {
                await updateDoc(doc(db, "users", uid), { disabled: shouldDisable });
                setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, disabled: shouldDisable } : u));
                showNotification('success', shouldDisable ? 'Uživatel deaktivován.' : 'Uživatel aktivován.');
            } catch (error) {
                console.error("Error updating user status:", error);
                showNotification('error', "Chyba při změně stavu.");
            }
        }
    );
  }

  async function toggleUserRole(uid, currentRoles, roleToToggle) {
    const roles = currentRoles || [];
    let newRoles;
    if (roles.includes(roleToToggle)) {
      newRoles = roles.filter(r => r !== roleToToggle);
    } else {
      newRoles = [...roles, roleToToggle];
    }
    
    try {
      await updateDoc(doc(db, "users", uid), { roles: newRoles });
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, roles: newRoles } : u));
    } catch (error) {
      console.error("Error updating roles:", error);
      showNotification('error', "Chyba při aktualizaci rolí.");
    }
  }

  async function toggleUserCertification(uid, currentCerts, certToToggle) {
    const certs = currentCerts || [];
    let newCerts;
    if (certs.includes(certToToggle)) {
        newCerts = certs.filter(c => c !== certToToggle);
    } else {
        newCerts = [...certs, certToToggle];
    }

    try {
        await updateDoc(doc(db, "users", uid), { certifications: newCerts });
        setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, certifications: newCerts } : u));
    } catch (error) {
        console.error("Error updating certifications:", error);
        showNotification('error', "Chyba při aktualizaci certifikací.");
    }
  }

  // Access Control View
  if (!userData) return <div className="p-4 text-center">Načítání profilu...</div>;
  
  if (!isAdminOrVJ) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center', height: '80vh' }}>
        <div className="card" style={{ maxWidth: '400px', borderLeft: '4px solid #d32f2f' }}>
          <h2 style={{color: '#d32f2f', marginBottom: '1rem'}}>⛔ Přístup zamítnut</h2>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
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
      
      {/* Stats Dashboard */}
      <div className="card mb-5" style={{ padding: '1.5rem' }}>
          <h3 className="mb-3" style={{ fontSize: '1.2rem' }}>Přehled stavu jednotky</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
              
              {/* Roles Stats */}
              <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '0.75rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>FUNKCE (ROLE)</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {ROLE_OPTIONS.filter(r => r !== 'Admin').map(role => (
                          <div key={role} style={{ 
                              background: '#e3f2fd', color: '#1565c0', padding: '0.4rem 0.8rem', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600
                          }}>
                              <span>{role}</span>
                              <span style={{ background: 'white', padding: '0 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{stats.roles[role] || 0}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Certs Stats */}
              <div>
                  <h4 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '0.75rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>KVALIFIKACE</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {CERTIFICATION_OPTIONS.map(cert => (
                          <div key={cert} style={{ 
                              background: '#fff3e0', color: '#e65100', padding: '0.4rem 0.8rem', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600
                          }}>
                              <span>{cert}</span>
                              <span style={{ background: 'white', padding: '0 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{stats.certs[cert] || 0}</span>
                          </div>
                      ))}
                  </div>
              </div>

          </div>
      </div>

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div className="mb-5 animation-fade-in">
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ 
                    width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-gold)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                    boxShadow: '0 4px 10px rgba(255, 193, 7, 0.3)'
                }}>⚠️</div>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>Žádosti o registraci</h3>
             </div>
            <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {pendingUsers.map(user => (
                <div key={user.uid} className="card" style={{ 
                    padding: '0', 
                    border: 'none',
                    overflow: 'hidden',
                    display: 'flex', 
                    flexDirection: 'column',
                    transition: 'transform 0.2s',
                    position: 'relative'
                }}>
                    <div style={{ 
                        padding: '1.5rem', 
                        borderLeft: '5px solid var(--accent-gold)', 
                        background: 'linear-gradient(to right, #fff, #fbfbfb)' 
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                             <div>
                                <strong style={{ fontSize: '1.2rem', display: 'block', color: 'var(--text-primary)' }}>{user.firstName} {user.lastName}</strong>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{user.email}</span>
                             </div>
                             <div style={{ 
                                 background: '#FFF8E1', color: '#FFA000', padding: '0.25rem 0.6rem', 
                                 borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' 
                             }}>
                                Nový
                             </div>
                        </div>
                        
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                            <div style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Požadované role</div>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {(user.roles || [user.role]).map(r => (
                                    <span key={r} style={{ 
                                        fontSize: '0.8rem', background: '#eee', padding: '0.2rem 0.5rem', borderRadius: '4px', color: '#444' 
                                    }}>
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', borderTop: '1px solid #eee' }}>
                        <button 
                            style={{ 
                                flex: 1, padding: '1rem', border: 'none', background: 'white', 
                                color: '#d32f2f', fontWeight: 600, cursor: 'pointer',
                                transition: 'background 0.2s',
                                borderRight: '1px solid #eee'
                            }}
                            className="hover-bg-red-50"
                            onClick={async () => {
                                requestConfirm(`Opravdu zamítnout a smazat ${user.firstName} ${user.lastName}?`, async () => {
                                    try {
                                        await deleteDoc(doc(db, "users", user.uid));
                                        fetchAdminData();
                                        showNotification('success', 'Žádost zamítnuta.');
                                    } catch (e) { console.error(e); showNotification('error', "Chyba akce."); }
                                });
                            }}
                        >
                            🚫 ZAMÍTNOUT
                        </button>
                        <button 
                            style={{ 
                                flex: 1, padding: '1rem', border: 'none', background: 'white', 
                                color: '#2e7d32', fontWeight: 600, cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            className="hover-bg-green-50"
                            onClick={() => approveUser(user.uid)}
                        >
                            ✅ SCHVÁLIT
                        </button>
                    </div>
                </div>
                ))}
            </div>
        </div>
      )}

      {/* All Users / Role Management */}
      <div className="card" style={{ overflow: 'hidden', padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <div style={{ padding: '1rem', background: '#fff', borderBottom: '1px solid #eee', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Všichni uživatelé</h3>
        </div>
        
        <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <table className="responsive-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Jméno & Email</th>
                <th style={{ width: '30%' }}>Funkce (Role)</th>
                <th style={{ width: '30%' }}>Kvalifikace (Školení)</th>
                <th style={{ textAlign: 'right' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(user => {
                const roles = user.roles || [user.role || 'Hasič'];
                const certs = user.certifications || [];
                const isDisabled = user.disabled;
                const isAdmin = roles.includes('Admin');
                const isSelf = user.uid === currentUser.uid;

                return (
                  <tr key={user.uid} className="hover-row" style={{ 
                      background: isDisabled ? '#fafafa' : 'white',
                      opacity: isDisabled ? 0.8 : 1
                  }}>
                    {/* COL 1: User Info */}
                    <td data-label="Uživatel">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
                         {/* Flex-end on mobile due to text-align:right default, but we can override inline if needed for desktop */}
                         <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ 
                                width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                                background: isAdmin ? 'var(--primary-red)' : (isDisabled ? '#ccc' : '#2196F3'), 
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem'
                            }}>
                                {user.firstName[0]}{user.lastName[0]}
                            </div>
                            <div style={{textAlign: 'left'}}>
                                <div style={{ fontWeight: 600, color: isDisabled ? '#999' : 'var(--text-primary)', textDecoration: isDisabled ? 'line-through' : 'none' }}>
                                    {user.firstName} {user.lastName}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#777', wordBreak: 'break-all' }}>{user.email}</div>
                            </div>
                         </div>
                      </div>
                    </td>
                    
                    {/* COL 2: ROLES - mobile-col for stacking pills */}
                    <td data-label="Funkce" className="mobile-col">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {ROLE_OPTIONS.map(roleOption => {
                          const isAssigned = roles.includes(roleOption);
                          const isRoleAdmin = roleOption === 'Admin';
                          const disabled = isDisabled || isRoleAdmin; 

                          return (
                          <label 
                            key={roleOption} 
                            style={{ 
                                display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '99px',
                                border: isAssigned ? `1px solid ${isRoleAdmin ? '#d32f2f' : '#1976D2'}` : '1px solid #e0e0e0',
                                background: isAssigned ? (isRoleAdmin ? '#ffebee' : '#e3f2fd') : 'transparent',
                                color: isAssigned ? (isRoleAdmin ? '#c62828' : '#1565c0') : '#777',
                                fontSize: '0.75rem', fontWeight: 600, 
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: disabled && !isAssigned ? 0.5 : 1,
                                transition: 'all 0.2s'
                            }}
                            title={isRoleAdmin ? "Roli Admina nelze měnit zde" : ""}
                          >
                            <input 
                              type="checkbox" 
                              style={{ display: 'none' }}
                              disabled={disabled}
                              checked={isAssigned} 
                              onChange={() => toggleUserRole(user.uid, roles, roleOption)}
                            />
                            {roleOption}
                          </label>
                        )})}
                      </div>
                    </td>

                    {/* COL 3: CERTIFICATIONS - mobile-col */}
                    <td data-label="Kvalifikace" className="mobile-col">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {CERTIFICATION_OPTIONS.map(certOption => {
                          const isAssigned = certs.includes(certOption);
                          const disabled = isDisabled;

                          return (
                          <label 
                            key={certOption} 
                            style={{ 
                                display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '4px',
                                border: isAssigned ? '1px solid #F57C00' : '1px solid #e0e0e0',
                                background: isAssigned ? '#fff3e0' : 'transparent',
                                color: isAssigned ? '#e65100' : '#777',
                                fontSize: '0.75rem', fontWeight: 600, 
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: disabled && !isAssigned ? 0.5 : 1,
                                transition: 'all 0.2s'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              style={{ display: 'none' }}
                              disabled={disabled}
                              checked={isAssigned} 
                              onChange={() => toggleUserCertification(user.uid, certs, certOption)}
                            />
                            {certOption}
                          </label>
                        )})}
                      </div>
                    </td>

                    {/* COL 4: ACTIONS */}
                    <td data-label="Akce">
                        {!isAdmin && !isSelf && (
                            <button 
                                onClick={() => deactivateUser(user.uid, !isDisabled)}
                                style={{ 
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '0.7rem', borderRadius: '6px',
                                    color: isDisabled ? '#2e7d32' : '#c62828',
                                    background: isDisabled ? '#E8F5E9' : '#FFEBEE',
                                    fontWeight: 600, fontSize: '0.85rem',
                                    transition: 'background 0.2s'
                                }}
                                title={isDisabled ? "Aktivovat účet" : "Deaktivovat účet"}
                            >
                                {isDisabled ? 'AKTIVOVAT' : 'DEAKTIVOVAT'}
                            </button>
                        )}
                        {(isAdmin || isSelf) && <span style={{ color: '#ccc', fontSize: '0.8rem' }}>---</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
