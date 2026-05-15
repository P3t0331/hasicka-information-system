import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, setDoc, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { sendApprovalEmail, sendDeactivationEmail } from '../utils/emailService';
import { logAction } from '../utils/logger';

const ROLE_OPTIONS = ['Hasič', 'Strojník', 'VD', 'Zástupce VJ', 'VJ', 'Admin'];
const CERTIFICATION_OPTIONS = [
  'NDT-16', // Nositel dýchací techniky
  'ZZZ-16', // Zdravotník
  'OMP-64', // Obsluha motorových pil
  'Záchrana na vodě',
  'V-40',   // Velitelé družstev
  'S-40' // Strojníci
];

export default function AdminPage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Admin Data
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Equipment Types
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [showEqModal, setShowEqModal] = useState(false);
  const [newEq, setNewEq] = useState({ name: '', hasSize: false, hasAmount: true });

  // Tab
  const [activeTab, setActiveTab] = useState('uzivatele');

  // Logs
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logFilterUser, setLogFilterUser] = useState('all');
  const [logFilterCategory, setLogFilterCategory] = useState('all');

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
    // Only proceed if userData is actually loaded
    if (!userData) return;

    if (isAdminOrVJ) {
      fetchAdminData();
    } else {
      // If not an admin, stop loading so Access Denied can show
      setDataLoading(false);
    }
  }, [isAdminOrVJ, userData]);

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
      // Fetch all users in one go
      const q = query(collection(db, "users"));
      const querySnapshot = await getDocs(q);
      const allFetchedUsers = [];
      querySnapshot.forEach((doc) => {
        allFetchedUsers.push(doc.data());
      });

      // Filter and sort in memory
      const pending = allFetchedUsers.filter(u => u.approved === false);
      const confirmed = allFetchedUsers.filter(u => u.approved === true);
      
      confirmed.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
      
      setPendingUsers(pending);
      setAllUsers(confirmed);

      // Fetch Equipment Types
      const eqDoc = await getDoc(doc(db, "settings", "equipmentTypes"));
      if (eqDoc.exists()) {
        setEquipmentTypes(eqDoc.data().types || []);
      }

    } catch (error) {
      console.error("Error fetching admin data:", error);
      showNotification('error', 'Chyba při načítání dat.');
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  }

  function showNotification(type, message) {
    setNotification({ type, message });
  }

  function requestConfirm(message, onConfirm) {
    setConfirmModal({ message, onConfirm });
  }

  async function saveEquipmentTypes(newTypes) {
    try {
      await setDoc(doc(db, "settings", "equipmentTypes"), { types: newTypes }, { merge: true });
      setEquipmentTypes(newTypes);
      showNotification('success', 'Druhy vybavení byly uloženy.');
    } catch (err) {
      console.error(err);
      showNotification('error', 'Chyba při ukládání vybavení.');
    }
  }

  function handleAddEq(e) {
    e.preventDefault();
    if (!newEq.name.trim()) return;
    
    // Create an ID that is url-safe and unique-ish
    const id = newEq.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
    
    if (equipmentTypes.some(t => t.id === id)) {
      showNotification('error', 'Tento druh vybavení již pravděpodobně existuje (podle názvu).');
      return;
    }
    const newTypes = [...equipmentTypes, { ...newEq, name: newEq.name.trim(), id }];
    saveEquipmentTypes(newTypes);
    handleAddEqLog(newEq.name.trim(), newEq.hasSize, newEq.hasAmount);
    setNewEq({ name: '', hasSize: false, hasAmount: true });
    setShowEqModal(false);
  }

  function handleRemoveEq(id) {
    const eqType = equipmentTypes.find(t => t.id === id);
    requestConfirm('Opravdu smazat tento druh vybavení ze systému? Uživatelská data zůstanou, ale nepůjdou editovat.', () => {
      const newTypes = equipmentTypes.filter(t => t.id !== id);
      saveEquipmentTypes(newTypes);
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_REMOVED_EQUIPMENT_TYPE', 'admin',
        `Smazal druh vybavení: "${eqType?.name || id}"`);
    });
  }

  function handleAddEqLog(name, hasSize, hasAmount) {
    logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
      'ADMIN_ADDED_EQUIPMENT_TYPE', 'admin',
      `Přidal druh vybavení: "${name}" (velikost: ${hasSize ? 'ano' : 'ne'}, počet: ${hasAmount ? 'ano' : 'ne'})`);
  }

  async function approveUser(uid) {
    try {
      const userToApprove = pendingUsers.find(u => u.uid === uid);

      await updateDoc(doc(db, "users", uid), { approved: true });

      if (userToApprove) {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'ADMIN_APPROVED_USER', 'admin',
          `Schválil registraci uživatele ${userToApprove.firstName} ${userToApprove.lastName} (${userToApprove.email})`);
      }

      if (userToApprove && userToApprove.email) {
        const emailResult = await sendApprovalEmail(
          userToApprove.email,
          `${userToApprove.firstName} ${userToApprove.lastName}`
        );

        if (emailResult.success) {
          showNotification('success', 'Uživatel schválen a email odeslán.');
        } else {
          showNotification('warning', 'Uživatel schválen, ale email se nepodařilo odeslat.');
        }
      } else {
        showNotification('success', 'Uživatel schválen (email nebyl nalezen).');
      }

      fetchAdminData();
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
          // 1. Get user data for email
          const userToUpdate = allUsers.find(u => u.uid === uid);

          // 2. Update DB
          await updateDoc(doc(db, "users", uid), { disabled: shouldDisable });
          setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, disabled: shouldDisable } : u));

          logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
            shouldDisable ? 'ADMIN_DEACTIVATED_USER' : 'ADMIN_ACTIVATED_USER', 'admin',
            `${shouldDisable ? 'Deaktivoval' : 'Aktivoval'} účet uživatele ${userToUpdate?.firstName} ${userToUpdate?.lastName}`);

          // 3. Clean up user from future activities (ONLY if deactivating)
          if (shouldDisable) {
            const today = new Date();
            const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            // 3a. Remove from future Events
            const eventsQuery = query(collection(db, 'events'), where('date', '>=', todayISO));
            const eventsSnapshot = await getDocs(eventsQuery);
            for (const eventDoc of eventsSnapshot.docs) {
              const participants = eventDoc.data().participants || [];
              const userParticipation = participants.find(p => p.uid === uid);
              if (userParticipation) {
                const updatedParticipants = participants.filter(p => p.uid !== uid);
                await updateDoc(doc(db, 'events', eventDoc.id), { participants: updatedParticipants });
              }
            }

            // 3b. Remove from future Trainings
            const trainingsQuery = query(collection(db, 'trainings'), where('date', '>=', todayISO));
            const trainingsSnapshot = await getDocs(trainingsQuery);
            for (const trainingDoc of trainingsSnapshot.docs) {
              const participants = trainingDoc.data().participants || [];
              const userParticipation = participants.find(p => p.uid === uid);
              if (userParticipation) {
                const updatedParticipants = participants.filter(p => p.uid !== uid);
                await updateDoc(doc(db, 'trainings', trainingDoc.id), { participants: updatedParticipants });
              }
            }

            // 3c. Remove from future Shifts
            const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const currentDay = today.getDate();

            // Query current and future month shift documents
            const shiftsSnapshot = await getDocs(collection(db, 'shifts'));
            for (const shiftDoc of shiftsSnapshot.docs) {
              const monthId = shiftDoc.id;
              // Only process current month onwards
              if (monthId < currentMonth) continue;

              const days = shiftDoc.data().days || {};
              let hasUpdates = false;
              const updatedDays = { ...days };

              for (const [dayNum, dayData] of Object.entries(days)) {
                const dayNumber = parseInt(dayNum);
                // Skip past days in current month
                if (monthId === currentMonth && dayNumber < currentDay) continue;

                // Check dayShift
                if (dayData.dayShift) {
                  let shiftUpdated = false;
                  const updatedDayShift = { ...dayData.dayShift };
                  for (const [slotKey, assignee] of Object.entries(dayData.dayShift)) {
                    if (assignee && assignee.uid === uid) {
                      delete updatedDayShift[slotKey];
                      shiftUpdated = true;
                      hasUpdates = true;
                    }
                  }
                  if (shiftUpdated) {
                    updatedDays[dayNum] = { ...updatedDays[dayNum], dayShift: updatedDayShift };
                  }
                }

                // Check nightShift
                if (dayData.nightShift) {
                  let shiftUpdated = false;
                  const updatedNightShift = { ...dayData.nightShift };
                  for (const [slotKey, assignee] of Object.entries(dayData.nightShift)) {
                    if (assignee && assignee.uid === uid) {
                      delete updatedNightShift[slotKey];
                      shiftUpdated = true;
                      hasUpdates = true;
                    }
                  }
                  if (shiftUpdated) {
                    updatedDays[dayNum] = { ...updatedDays[dayNum], nightShift: updatedNightShift };
                  }
                }
              }

              if (hasUpdates) {
                await updateDoc(doc(db, 'shifts', monthId), { days: updatedDays });
              }
            }

            // 3d. Remove future/ongoing absences
            const absenceDocRef = doc(db, 'absences', 'global');
            const absenceSnapshot = await getDoc(absenceDocRef);
            if (absenceSnapshot.exists()) {
              const allAbsences = absenceSnapshot.data().items || [];
              // Remove absences where endDate >= today (future or ongoing)
              const updatedAbsences = allAbsences.filter(
                absence => !(absence.uid === uid && absence.endDate >= todayISO)
              );
              if (updatedAbsences.length !== allAbsences.length) {
                await updateDoc(absenceDocRef, { items: updatedAbsences });
              }
            }
          }

          // 4. Send Email (ONLY if deactivating)
          if (shouldDisable && userToUpdate && userToUpdate.email) {
            const emailResult = await sendDeactivationEmail(
              userToUpdate.email,
              `${userToUpdate.firstName} ${userToUpdate.lastName}`
            );
            if (emailResult.success) {
              showNotification('success', 'Uživatel deaktivován, odstraněn ze služeb a email odeslán.');
            } else {
              showNotification('warning', 'Uživatel deaktivován a odstraněn ze služeb, ale email se nepodařilo odeslat.');
            }
          } else {
            showNotification('success', shouldDisable ? 'Uživatel deaktivován a odstraněn ze služeb.' : 'Uživatel aktivován.');
          }

        } catch (error) {
          console.error("Error updating user status:", error);
          showNotification('error', "Chyba při změně stavu.");
        }
      }
    );
  }

  async function deleteUser(uid) {
    if (uid === currentUser.uid) {
      showNotification('error', "Nemůžete smazat vlastní účet.");
      return;
    }
    const userToDelete = allUsers.find(u => u.uid === uid);

    requestConfirm(
      "Opravdu chcete TRVALE SMAZAT tohoto uživatele? Tato akce je nevratná.",
      async () => {
        try {
          logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
            'ADMIN_DELETED_USER', 'admin',
            `Trvale smazal účet uživatele ${userToDelete?.firstName} ${userToDelete?.lastName} (${userToDelete?.email || uid})`);
          await deleteDoc(doc(db, "users", uid));
          setAllUsers(prev => prev.filter(u => u.uid !== uid));
          showNotification('success', 'Uživatel trvalě smazán.');
        } catch (error) {
          console.error("Error deleting user:", error);
          showNotification('error', "Chyba při mazání uživatele.");
        }
      }
    );
  }

  async function toggleUserRole(uid, currentRoles, roleToToggle) {
    const roles = currentRoles || [];
    let newRoles;

    // Check if we're trying to ADD a unique role (VJ or Zástupce VJ)
    const uniqueRoles = ['VJ', 'Zástupce VJ', 'Zastupce VJ'];
    const isAddingRole = !roles.includes(roleToToggle);

    if (isAddingRole && uniqueRoles.includes(roleToToggle)) {
      // Check if someone else already has this role
      const normalizedRole = roleToToggle === 'Zastupce VJ' ? 'Zástupce VJ' : roleToToggle;
      const existingHolder = allUsers.find(u => {
        if (u.uid === uid) return false; // Skip the user we're editing
        const uRoles = u.roles || [u.role || 'Hasič'];
        return uRoles.includes(roleToToggle) || uRoles.includes(normalizedRole);
      });

      if (existingHolder) {
        showNotification('error', `Role "${roleToToggle}" je již přiřazena uživateli ${existingHolder.firstName} ${existingHolder.lastName}. Nejprve ji odeberte.`);
        return;
      }
    }

    if (roles.includes(roleToToggle)) {
      newRoles = roles.filter(r => r !== roleToToggle);
    } else {
      newRoles = [...roles, roleToToggle];
    }

    try {
      await updateDoc(doc(db, "users", uid), { roles: newRoles });
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, roles: newRoles } : u));
      const targetUser = allUsers.find(u => u.uid === uid);
      const added = newRoles.filter(r => !roles.includes(r));
      const removed = roles.filter(r => !newRoles.includes(r));
      const changeDesc = [
        ...added.map(r => `+${r}`),
        ...removed.map(r => `-${r}`)
      ].join(', ');
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_CHANGED_ROLE', 'admin',
        `Změnil role uživatele ${targetUser?.firstName} ${targetUser?.lastName}: ${changeDesc}`);
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
      const targetUser = allUsers.find(u => u.uid === uid);
      const added = newCerts.filter(c => !certs.includes(c));
      const removed = certs.filter(c => !newCerts.includes(c));
      const changeDesc = [
        ...added.map(c => `+${c}`),
        ...removed.map(c => `-${c}`)
      ].join(', ');
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_CHANGED_CERT', 'admin',
        `Změnil kvalifikace uživatele ${targetUser?.firstName} ${targetUser?.lastName}: ${changeDesc}`);
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

      {/* Add Equipment Modal */}
      {showEqModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }} onClick={() => setShowEqModal(false)}>
          <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', animation: 'fadeIn 0.2s' }}>
            <h3 className="mb-4">Přidat druh vybavení</h3>
            <form onSubmit={handleAddEq}>
              <div className="input-group">
                <label className="input-label">Název (např. Oblečení PS II)</label>
                <input className="input-field" value={newEq.name} onChange={e => setNewEq({...newEq, name: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newEq.hasSize} onChange={e => setNewEq({...newEq, hasSize: e.target.checked})} />
                  Evidovat velikost
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newEq.hasAmount} onChange={e => setNewEq({...newEq, hasAmount: e.target.checked})} />
                  Evidovat počet
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEqModal(false)}>Zrušit</button>
                <button type="submit" className="btn btn-primary">Přidat</button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Tab Bar - Scrollable on mobile */}
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

      {activeTab === 'uzivatele' && (<>
      {/* Stats Dashboard */}
      <div className="card mb-5" style={{ padding: '1.5rem' }}>
        <h3 className="mb-3" style={{ fontSize: '1.2rem' }}>Přehled stavu jednotky</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>

          {/* Roles Stats */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: '#888', marginBottom: '0.75rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>FUNKCE (ROLE)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
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
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
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
                          logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                            'ADMIN_REJECTED_USER', 'admin',
                            `Zamítl a smazal registraci uživatele ${user.firstName} ${user.lastName} (${user.email})`);
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

      </>)}

      {/* Equipment Tab */}
      {activeTab === 'vybaveni' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Druhy vybavení</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#888' }}>Definujte typy vybavení, které mohou členové evidovat na svém profilu.</p>
            </div>
            <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }} onClick={() => setShowEqModal(true)}>+ Přidat</button>
          </div>

          {equipmentTypes.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic', margin: '1rem 0 0' }}>Zatím nejsou definovány žádné druhy. Členové si nemohou evidovat vybavení.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eee' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Název</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Velikost</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Počet</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>Vlastní/JSDH</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentTypes.map((eq, i) => (
                    <tr key={eq.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td data-label="Název" style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#333' }}>{eq.name}</td>
                      <td data-label="Velikost" style={{ textAlign: 'center', padding: '0.6rem' }}>
                        {eq.hasSize ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>✓</span> : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td data-label="Počet" style={{ textAlign: 'center', padding: '0.6rem' }}>
                        {eq.hasAmount ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>✓</span> : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td data-label="Vlastní/JSDH" style={{ textAlign: 'center', padding: '0.6rem' }}>
                        <span style={{ color: '#2e7d32', fontWeight: 700 }}>✓</span>
                      </td>
                      <td style={{ textAlign: 'center', padding: '0.4rem' }}>
                        <button onClick={() => handleRemoveEq(eq.id)} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0.2rem 0.4rem', borderRadius: '4px' }} title="Smazat">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'uzivatele' && (<>
      {/* All Users / Role Management */}
      <div className="card" style={{ overflow: 'hidden', padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <div style={{ padding: '1rem', background: '#fff', borderBottom: '1px solid #eee', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Všichni uživatelé</h3>
        </div>

        <div style={{ background: '#fff', borderRadius: '0 0 12px 12px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
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
                          <div style={{ textAlign: 'left' }}>
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
                          const isProtectedRole = ['VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(roleOption);
                          const currentUserIsAdmin = userRoles.includes('Admin');

                          // Admin role: never editable via UI
                          // VJ/Zástupce VJ: only Admin can change
                          const disabled = isDisabled || isRoleAdmin || (isProtectedRole && !currentUserIsAdmin);
                          const tooltip = isRoleAdmin
                            ? "Roli Admina nelze měnit zde"
                            : (isProtectedRole && !currentUserIsAdmin)
                              ? "Tuto roli může měnit pouze Admin"
                              : "";

                          return (
                            <label
                              key={roleOption}
                              style={{
                                display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '99px',
                                border: isAssigned ? `1px solid ${isRoleAdmin ? '#d32f2f' : (isProtectedRole ? '#F57C00' : '#1976D2')}` : '1px solid #e0e0e0',
                                background: isAssigned ? (isRoleAdmin ? '#ffebee' : (isProtectedRole ? '#FFF3E0' : '#e3f2fd')) : 'transparent',
                                color: isAssigned ? (isRoleAdmin ? '#c62828' : (isProtectedRole ? '#E65100' : '#1565c0')) : '#777',
                                fontSize: '0.75rem', fontWeight: 600,
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: disabled && !isAssigned ? 0.5 : 1,
                                transition: 'all 0.2s'
                              }}
                              title={tooltip}
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
                          )
                        })}
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
                          )
                        })}
                      </div>
                    </td>

                    {/* COL 4: ACTIONS */}
                    <td data-label="Akce">
                      {!isAdmin && !isSelf && (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => deactivateUser(user.uid, !isDisabled)}
                            style={{
                              border: 'none', cursor: 'pointer',
                              padding: '0.5rem 0.8rem', borderRadius: '6px',
                              color: isDisabled ? '#2e7d32' : '#c62828',
                              background: isDisabled ? '#E8F5E9' : '#FFEBEE',
                              fontWeight: 600, fontSize: '0.8rem',
                              transition: 'background 0.2s'
                            }}
                            title={isDisabled ? "Aktivovat účet" : "Deaktivovat účet"}
                          >
                            {isDisabled ? 'AKTIVOVAT' : 'DEAKTIVOVAT'}
                          </button>

                          {isDisabled && (
                            <button
                              onClick={() => deleteUser(user.uid)}
                              style={{
                                border: 'none', cursor: 'pointer',
                                padding: '0.5rem 0.8rem', borderRadius: '6px',
                                color: '#fff',
                                background: '#d32f2f',
                                fontWeight: 600, fontSize: '0.8rem',
                                transition: 'background 0.2s',
                                boxShadow: '0 2px 4px rgba(211, 47, 47, 0.2)'
                              }}
                              title="Trvale smazat uživatele"
                            >
                              SMAZAT
                            </button>
                          )}
                        </div>
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
      </>)}

      {/* Equipment Overview Matrix Tab */}
      {activeTab === 'prehled' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Přehled vybavení členů</h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#888' }}>
                {allUsers.filter(u => !u.disabled).length} členů &middot; {equipmentTypes.length} druhů vybavení
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: '#666', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }}></span> Fasované (JSDH)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2196F3', display: 'inline-block' }}></span> Vlastní
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#e0e0e0', display: 'inline-block' }}></span> Neevidováno
              </span>
            </div>
          </div>

          {equipmentTypes.length === 0 ? (
            <p style={{ padding: '2rem', color: '#888', fontStyle: 'italic', textAlign: 'center' }}>Nejsou definovány žádné druhy vybavení. Přejděte na záložku Vybavení a přidejte typy.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{
                      position: 'sticky', left: 0, zIndex: 2,
                      background: '#f5f5f5', textAlign: 'left',
                      padding: '0.6rem 1rem', fontWeight: 700, color: '#333',
                      borderRight: '2px solid #e0e0e0', borderBottom: '2px solid #e0e0e0',
                      minWidth: '160px', whiteSpace: 'nowrap'
                    }}>
                      Člen
                    </th>
                    {equipmentTypes.map(eq => (
                      <th key={eq.id} style={{
                        padding: '0.5rem 0.75rem',
                        fontWeight: 600, color: '#555',
                        borderBottom: '2px solid #e0e0e0',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        minWidth: '110px',
                        fontSize: '0.78rem'
                      }}>
                        {eq.name}
                        <div style={{ fontWeight: 400, color: '#aaa', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                          {[eq.hasSize && 'vel.', eq.hasAmount && 'ks'].filter(Boolean).join(' · ')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allUsers.filter(u => !u.disabled).map((user, rowIdx) => {
                    const userEq = user.equipment || {};
                    const hasAnyEquipment = equipmentTypes.some(eq => {
                      const d = userEq[eq.id];
                      return d && (d.size || (d.amount && d.amount > 0));
                    });

                    return (
                      <tr key={user.uid} style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                        {/* Sticky name column */}
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 1,
                          background: rowIdx % 2 === 0 ? 'white' : '#fafafa',
                          padding: '0.6rem 1rem',
                          borderRight: '2px solid #e0e0e0',
                          whiteSpace: 'nowrap'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                              background: 'linear-gradient(135deg, #263238, #546E7A)',
                              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: 700, fontSize: '0.75rem'
                            }}>
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>{user.firstName} {user.lastName}</div>
                              <div style={{ fontSize: '0.72rem', color: '#888' }}>
                                {(user.roles || [user.role || 'Hasič']).join(', ')}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Equipment columns */}
                        {equipmentTypes.map(eq => {
                          const d = userEq[eq.id];
                          const hasData = d && (d.size || (d.amount && d.amount > 0));
                          const isOwn = d?.ownership === 'vlastni';

                          return (
                            <td key={eq.id} style={{ padding: '0.4rem 0.5rem', textAlign: 'center', verticalAlign: 'middle' }}>
                              {hasData ? (
                                <div style={{
                                  display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                                  background: isOwn ? '#E3F2FD' : '#E8F5E9',
                                  border: `1px solid ${isOwn ? '#90CAF9' : '#A5D6A7'}`,
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.5rem',
                                  minWidth: '60px',
                                  gap: '0.1rem'
                                }}>
                                  {eq.hasSize && d.size && (
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isOwn ? '#1565C0' : '#2E7D32' }}>{d.size}</span>
                                  )}
                                  {eq.hasAmount && d.amount > 0 && (
                                    <span style={{ fontSize: '0.72rem', color: isOwn ? '#1976D2' : '#388E3C' }}>{d.amount} ks</span>
                                  )}
                                  <span style={{ fontSize: '0.6rem', color: isOwn ? '#64B5F6' : '#81C784', letterSpacing: '0.02em' }}>
                                    {isOwn ? 'vlastní' : 'JSDH'}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#d0d0d0', fontSize: '1rem' }}>—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========== LOGY TAB ========== */}
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

// ======== CATEGORY CONFIGURATION ========
const CATEGORY_CONFIG = {
  shifts:     { label: 'Směny',       color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9', icon: '📅' },
  activities: { label: 'Aktivity',     color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7', icon: '🎓' },
  profile:    { label: 'Profil',       color: '#6A1B9A', bg: '#F3E5F5', border: '#CE93D8', icon: '👤' },
  admin:      { label: 'Administrace', color: '#B71C1C', bg: '#FFEBEE', border: '#EF9A9A', icon: '🛡️' },
};

const ACTION_LABELS = {
  JOINED_SHIFT:              'Přihlášen na směnu',
  LEFT_SHIFT:                'Odhlášen ze směny',
  REMOVED_USER_FROM_SHIFT:   'Odebral uživatele ze směny',
  ADDED_ABSENCE:             'Přidána absence',
  DELETED_ABSENCE:           'Smazána absence',
  JOINED_TRAINING:           'Přihlášen na školení',
  LEFT_TRAINING:             'Odhlášen ze školení',
  JOINED_EVENT:              'Přihlášen na akci',
  LEFT_EVENT:                'Odhlášen z akce',
  UPDATED_PROFILE:           'Aktualizace profilu',
  UPDATED_EQUIPMENT:         'Aktualizace vybavení',
  USER_REGISTERED:           'Registrace do systému',
  ADMIN_APPROVED_USER:       'Schválení registrace',
  ADMIN_REJECTED_USER:       'Zamítnutí registrace',
  ADMIN_DEACTIVATED_USER:    'Deaktivace účtu',
  ADMIN_ACTIVATED_USER:      'Aktivace účtu',
  ADMIN_DELETED_USER:        'Smazání účtu',
  ADMIN_CHANGED_ROLE:        'Změna role',
  ADMIN_CHANGED_CERT:        'Změna kvalifikace',
  ADMIN_ADDED_EQUIPMENT_TYPE:   'Přidán druh vybavení',
  ADMIN_REMOVED_EQUIPMENT_TYPE: 'Smazán druh vybavení',
  ADMIN_CREATED_TRAINING:    'Vytvořeno školení',
  ADMIN_UPDATED_TRAINING:    'Upraveno školení',
  ADMIN_DELETED_TRAINING:    'Smazáno školení',
  ADMIN_CREATED_EVENT:       'Vytvořena akce',
  ADMIN_UPDATED_EVENT:       'Upravena akce',
  ADMIN_DELETED_EVENT:       'Smazána akce',
  ADMIN_ADDED_DAY_SHIFT:     'Přidána denní služba',
  ADMIN_REMOVED_DAY_SHIFT:   'Zrušena denní služba',
  ADMIN_UPDATED_SHIFT_HOURS: 'Úprava hodin služby',
};

function formatRelativeTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'právě teď';
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} hod`;
  if (diff < 604800) return `před ${Math.floor(diff / 86400)} dny`;
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAbsoluteTime(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function LogsTab({
  allUsers, activityLogs, setActivityLogs,
  logsLoading, setLogsLoading, logsLoaded, setLogsLoaded,
  logFilterUser, setLogFilterUser, logFilterCategory, setLogFilterCategory
}) {
  // Use the imported db instead of non-existent useDbInstance
  const dbCtx = db;

  // Load logs lazily when tab first opened
  React.useEffect(() => {
    if (logsLoaded) return;
    setLogsLoading(true);
    const q = query(
      collection(db, 'activityLogs'),
      orderBy('timestamp', 'desc'),
      limit(300)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivityLogs(docs);
      setLogsLoading(false);
      setLogsLoaded(true);
    }, (err) => {
      console.error('Logs error:', err);
      setLogsLoading(false);
    });
    return unsub;
  }, [logsLoaded]);

  const filteredLogs = activityLogs.filter(log => {
    if (logFilterUser !== 'all' && log.uid !== logFilterUser) return false;
    if (logFilterCategory !== 'all' && log.category !== logFilterCategory) return false;
    return true;
  });

  const uniqueUsers = Array.from(
    new Map(activityLogs.map(l => [l.uid, { uid: l.uid, name: l.userName }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'cs'));

  return (
    <div>
      {/* Filter Bar */}
      <div style={{
        background: 'white', borderRadius: '12px', padding: '1rem 1.25rem',
        marginBottom: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* User filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, whiteSpace: 'nowrap' }}>Uživatel:</span>
            <select
              value={logFilterUser}
              onChange={e => setLogFilterUser(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #e0e0e0',
                fontSize: '0.85rem', background: '#fafafa', cursor: 'pointer', minWidth: '160px'
              }}
            >
              <option value="all">Všichni</option>
              {uniqueUsers.map(u => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Category filter pills */}
          <div style={{ 
            display: 'flex', 
            gap: '0.4rem', 
            flexWrap: 'nowrap', 
            overflowX: 'auto', 
            paddingBottom: '0.25rem',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }} className="hide-scrollbar">
            {[{ id: 'all', label: 'Vše', icon: '🔍' }, ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({ id: k, label: v.label, icon: v.icon }))]
              .map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setLogFilterCategory(cat.id)}
                  style={{
                    padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem',
                    fontWeight: logFilterCategory === cat.id ? 700 : 500,
                    border: `1px solid ${logFilterCategory === cat.id ? (CATEGORY_CONFIG[cat.id]?.border || '#aaa') : '#e0e0e0'}`,
                    background: logFilterCategory === cat.id ? (CATEGORY_CONFIG[cat.id]?.bg || '#eee') : 'white',
                    color: logFilterCategory === cat.id ? (CATEGORY_CONFIG[cat.id]?.color || '#333') : '#666',
                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))
            }
          </div>
        </div>

        {/* Actions (Refresh) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          <button
            onClick={() => {
              setLogsLoaded(false);
              setActivityLogs([]); // Clear existing logs to show loading state
            }}
            disabled={logsLoading}
            style={{
              background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px',
              padding: '0.4rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.8rem', color: '#555', transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#f9f9f9'; e.currentTarget.style.borderColor = '#ccc'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e0e0e0'; }}
          >
            <span style={{ 
              display: 'inline-block', 
              animation: logsLoading ? 'spin 1s linear infinite' : 'none',
              fontSize: '0.9rem'
            }}>
              🔄
            </span>
            <span className="d-desktop-only">Obnovit</span>
          </button>

          {/* Count */}
          <span style={{ fontSize: '0.75rem', color: '#aaa', whiteSpace: 'nowrap' }}>
            {filteredLogs.length} <span className="d-desktop-only">záznamů</span>
          </span>
        </div>
      </div>

      {/* Log List */}
      {logsLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          Načítám záznamy...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem', color: '#bbb',
          background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
          <div style={{ fontWeight: 600, color: '#999', marginBottom: '0.3rem' }}>Žádné záznamy</div>
          <div style={{ fontSize: '0.82rem' }}>Změňte filtry nebo počkejte, až nějaká akce proběhne.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredLogs.map((log, idx) => {
            const cat = CATEGORY_CONFIG[log.category] || { label: log.category, color: '#555', bg: '#f5f5f5', border: '#ddd', icon: '•' };
            const actionLabel = ACTION_LABELS[log.action] || log.action;
            const initials = log.userName ? log.userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

            return (
              <div
                key={log.id || idx}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  background: 'white', borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  borderLeft: `4px solid ${cat.border}`,
                  transition: 'box-shadow 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'}
              >
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: cat.bg, border: `2px solid ${cat.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: cat.color, fontWeight: 700, fontSize: '0.72rem'
                }}>
                  {initials}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#222' }}>{log.userName}</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
                      borderRadius: '12px', background: cat.bg, color: cat.color, border: `1px solid ${cat.border}`
                    }}>
                      {cat.icon} {actionLabel}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#555', lineHeight: 1.45 }}>
                    {log.detail}
                  </p>
                </div>

                {/* Timestamp */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '70px', alignSelf: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888', fontWeight: 600 }}>
                    {formatRelativeTime(log.timestamp)}
                  </div>
                  <div className="d-desktop-only" style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '0.15rem' }}>
                    {formatAbsoluteTime(log.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Thin hook shim so LogsTab can use db without prop drilling
function useDbInstance() { return { db }; }
