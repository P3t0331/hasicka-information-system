import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const DEFAULT_NIGHT_HOURS = 11;
const DEFAULT_DAY_HOURS = 8;
export default function ProfilePage() {
  const { currentUser, userData, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Admin Data
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Normalize roles to array
  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
  
  const isAdminOrVJ = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

  // Statistics State
  const [monthlyHours, setMonthlyHours] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    const date = new Date();
    const currentDocId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const docRef = doc(db, 'shifts', currentDocId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().days || {};
        let total = 0;
        
        Object.entries(data).forEach(([dayStr, dayData]) => {
          // Check date - exclude future
          const [year, month] = currentDocId.split('-').map(Number);
          const shiftDate = new Date(year, month - 1, Number(dayStr));
          shiftDate.setHours(0, 0, 0, 0);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (shiftDate > today) return;

          // Check explicit hours first
          if (dayData.hours && dayData.hours[currentUser.uid]) {
            const h = dayData.hours[currentUser.uid];
            // Handle both old format (h.hours number or object) and new format (h.day/h.night)
            // Use loose check for robustness or strict check
            if (h && (typeof h.day === 'number' || typeof h.night === 'number')) {
               total += (h.day || 0) + (h.night || 0);
            } else if (h && h.hours !== undefined) {
               total += (Number(h.hours) || 0);
            }
          } else {
            // Calculate default
            let dayTotal = 0;
            if (dayData.dayShift && Object.values(dayData.dayShift).some(u => u?.uid === currentUser.uid)) {
              dayTotal += DEFAULT_DAY_HOURS;
            }
            if (dayData.nightShift && Object.values(dayData.nightShift).some(u => u?.uid === currentUser.uid)) {
              dayTotal += DEFAULT_NIGHT_HOURS;
            }
            total += dayTotal;
          }
        });
        setMonthlyHours(total);
      } else {
        setMonthlyHours(0);
      }
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && userData) {
      setEditForm({
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        address: userData.address
      });
    }
  }, [currentUser, userData]);

  useEffect(() => {
    if (isAdminOrVJ && activeTab === 'admin') {
      fetchAdminData();
    }
  }, [isAdminOrVJ, activeTab]);

  async function fetchAdminData() {
    setLoading(true);
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
      // "Správa uživatelů a rolí should not contain not yet confirmed users"
      const qAll = query(collection(db, "users"), where("approved", "==", true));
      const querySnapshotAll = await getDocs(qAll);
      const startAll = [];
      querySnapshotAll.forEach((doc) => {
        startAll.push(doc.data());
      });
      setAllUsers(startAll);

    } catch (error) {
      console.error("Error fetching admin data:", error);
    }
    setLoading(false);
  }

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
       console.error("Failed to log out", error);
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        address: editForm.address
      });
      setIsEditing(false);
      window.location.reload(); 
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  }

  async function approveUser(uid) {
    try {
      await updateDoc(doc(db, "users", uid), { approved: true });
      fetchAdminData(); // Refresh list
    } catch (error) {
      console.error("Error approving user:", error);
    }
  }

  async function deactivateUser(uid, shouldDisable) {
    if (uid === currentUser.uid) {
      alert("Nemůžete deaktivovat vlastní účet.");
      return;
    }
    
    if (!confirm(shouldDisable ? `Opravdu chcete DEAKTIVOVAT tohoto uživatele? Nebude se moci přihlásit.` : `Aktivovat uživatele?`)) return;

    try {
      await updateDoc(doc(db, "users", uid), { disabled: shouldDisable });
      setAllUsers(allUsers.map(u => u.uid === uid ? { ...u, disabled: shouldDisable } : u));
    } catch (error) {
       console.error("Error updating user status:", error);
       alert("Chyba při změně stavu uživatele.");
    }
  }

  async function toggleUserRole(uid, currentRoles, roleToToggle) {
    const roles = currentRoles || [];
    let newRoles;
    if (roles.includes(roleToToggle)) {
      newRoles = roles.filter(r => r !== roleToToggle);
    } else {
      newRoles = [...roles, roleToToggle];
    }
    
    // Ensure at least one role remains ?? Or allow empty? 
    // Usually Hasič is base, but we will allow flexible.
    
    try {
      await updateDoc(doc(db, "users", uid), { roles: newRoles });
      // Update local state for immediate feedback
      setAllUsers(allUsers.map(u => u.uid === uid ? { ...u, roles: newRoles } : u));
    } catch (error) {
      console.error("Error updating roles:", error);
    }
  }

  if (loading) return <div>Načítání...</div>;

  if (!userData) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center' }}>
        <div className="card">
          <h2 style={{color: 'var(--primary-red)'}}>Chyba profilu</h2>
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
          <h2 style={{color: 'var(--primary-red)'}}>Čekání na schválení</h2>
          <p className="mt-2">Váš účet musí být schválen správcem systému (VJ).</p>
          <button className="btn btn-secondary mt-2" onClick={handleLogout}>Odhlásit se</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="flex-center mb-2" style={{ gap: '1rem', justifyContent: 'flex-start' }}>
        <button 
          className={`btn ${activeTab === 'profile' ? 'btn-accent' : 'btn-secondary'}`} 
          onClick={() => setActiveTab('profile')}
        >
          Můj Profil
        </button>
        {isAdminOrVJ && (
          <button 
            className={`btn ${activeTab === 'admin' ? 'btn-accent' : 'btn-secondary'}`} 
            onClick={() => setActiveTab('admin')}
          >
            Správa (Admin)
          </button>
        )}
      </div>

      {activeTab === 'profile' && (
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Můj Profil</h2>
              {!isEditing && <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Upravit Profil</button>}
            </div>

            {/* Stats Widget */}
            <div style={{ 
              background: 'linear-gradient(135deg, #FF6F00, #EF6C00)', 
              borderRadius: '8px', 
              padding: '1rem', 
              color: 'white',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 4px rgba(239, 108, 0, 0.2)'
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Moje hodiny tento měsíc</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{monthlyHours}h</div>
              </div>
              <Link to="/statistiky" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
                Zobrazit detail →
              </Link>
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateProfile}>
                 <div className="input-group">
                  <label className="input-label">Jméno</label>
                  <input className="input-field" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Příjmení</label>
                  <input className="input-field" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Telefon</label>
                  <input className="input-field" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                </div>
                <div className="input-group">
                  <label className="input-label">Bydliště</label>
                  <input className="input-field" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-success" style={{background: '#2e7d32', color: 'white'}} type="submit">Uložit</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setIsEditing(false)}>Zrušit</button>
                </div>
              </form>
            ) : (
              <div>
                <ProfileDetail label="Jméno" value={`${userData.firstName} ${userData.lastName}`} />
                <ProfileDetail label="Role" value={userRoles.join(', ')} highlight />
                <ProfileDetail label="Email" value={userData.email} />
                <ProfileDetail label="Telefon" value={userData.phone} />
                <ProfileDetail label="Bydliště" value={userData.address} />
                <div className="mt-2">
                  <span className="badge badge-approved">Účet aktivní</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && isAdminOrVJ && (
          <div>
            {/* Pending Approvals */}
            <div className="card mb-2">
              <h3 className="mb-2">Čekající na schválení</h3>
              {pendingUsers.length === 0 ? (
                <p style={{ color: '#666' }}>Žádní uživatelé k schválení.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pendingUsers.map(user => (
                    <div key={user.uid} style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{user.firstName} {user.lastName}</strong> ({user.email})<br/>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{(user.roles || [user.role]).join(', ')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                            className="btn btn-sm btn-secondary" 
                            style={{ color: '#d32f2f', borderColor: '#d32f2f' }}
                            onClick={async () => {
                                if (confirm(`Opravdu chcete ZAMÍTNOUT a SMAZAT žádost uživatele ${user.firstName} ${user.lastName}?`)) {
                                    try {
                                        const { deleteDoc, doc } = await import('firebase/firestore');
                                        await deleteDoc(doc(db, "users", user.uid));
                                        fetchAdminData();
                                    } catch (e) {
                                        console.error(e);
                                        alert("Chyba při mazání.");
                                    }
                                }
                            }}
                        >
                            Zamítnout
                        </button>
                        <button className="btn btn-primary" onClick={() => approveUser(user.uid)}>Schválit</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* All Users / Role Management */}
            <div className="card">
              <h3 className="mb-2">Správa uživatelů a rolí</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                      <th style={{ padding: '0.5rem' }}>Jméno</th>
                      <th style={{ padding: '0.5rem' }}>Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(user => {
                      const roles = user.roles || [user.role || 'Hasič'];
                      return (
                        <tr key={user.uid} style={{ borderBottom: '1px solid #eee', opacity: user.disabled ? 0.6 : 1, background: user.disabled ? '#f9f9f9' : 'white' }}>
                          <td style={{ padding: '0.5rem', verticalAlign: 'top' }}>
                            <strong style={{ textDecoration: user.disabled ? 'line-through' : 'none' }}>{user.firstName} {user.lastName}</strong>
                            <div style={{fontSize: '0.8rem', color: '#888'}}>{user.email}</div>
                            {user.disabled && <div className="badge" style={{background: '#c62828', color: 'white', marginTop: '4px', fontSize: '10px'}}>DEAKTIVOVÁN</div>}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {['Hasič', 'Strojník', 'Pilař', 'VD', 'VJ', 'Zástupce VJ', 'Admin'].map(roleOption => {
                                const disabled = user.disabled || roleOption === 'Admin';
                                return (
                                <label key={roleOption} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
                                  <input 
                                    type="checkbox" 
                                    disabled={disabled}
                                    checked={roles.includes(roleOption)} 
                                    onChange={() => toggleUserRole(user.uid, roles, roleOption)}
                                  />
                                  {roleOption}
                                </label>
                              )})}
                            </div>
                            <div style={{ marginTop: '0.75rem' }}>
                              {!roles.includes('Admin') && user.uid !== currentUser.uid ? (
                                <button 
                                  className="btn btn-sm" 
                                  onClick={() => deactivateUser(user.uid, !user.disabled)}
                                  style={{ 
                                    background: user.disabled ? '#43A047' : '#e0e0e0', 
                                    color: user.disabled ? 'white' : '#333',
                                    padding: '0.3rem 0.8rem',
                                    fontSize: '0.8rem',
                                    border: user.disabled ? 'none' : '1px solid #ccc'
                                  }}
                                >
                                  {user.disabled ? '✅ Aktivovat účet' : '🚫 Deaktivovat'}
                                </button>
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>
                                  {user.uid === currentUser.uid ? 'Nelze deaktivovat vlastní účet' : 'Admin účet nelze deaktivovat'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

function ProfileDetail({ label, value, highlight }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: highlight ? 'bold' : 'normal', color: highlight ? 'var(--primary-red)' : 'inherit' }}>{value}</span>
    </div>
  );
}
