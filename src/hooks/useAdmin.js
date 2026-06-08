import { useState, useEffect, useCallback } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, deleteDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { sendApprovalEmail, sendDeactivationEmail } from '../utils/emailService';
import { logAction } from '../utils/logger';
import { ROLE_OPTIONS, CERTIFICATION_OPTIONS } from '../components/admin/constants';
import { getEffectiveRoles } from '../utils/roles';

export default function useAdmin() {
  const { currentUser, userData } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Users & Equipment
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [showEqModal, setShowEqModal] = useState(false);
  const [newEq, setNewEq] = useState({
    id: null, name: '', hasBrand: false, hasSize: false, hasAmount: true,
    hasInventoryNumber: false, hasSerialNumber: false,
    hasManufactureYear: false, hasIssueYear: false, hasWear: false, hasPolep: false
  });

  // Tab & Logs
  const [activeTab, setActiveTab] = useState('uzivatele');
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logFilterUser, setLogFilterUser] = useState('all');
  const [logFilterCategory, setLogFilterCategory] = useState('all');

  // Stats
  const [stats, setStats] = useState({ roles: {}, certs: {} });

  // Alerts & Dialogs
  const [confirmModal, setConfirmModal] = useState(null);

  const userRoles = getEffectiveRoles(userData ? (userData.roles || [userData.role || 'Hasič']) : []);
  const isAdminOrVJ = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'Přístup do Administrace'].includes(r));

  const showNotification = useCallback((type, message) => addToast(type, message), [addToast]);

  // Fetch admin data via real-time listeners (serves cache instantly on mobile)
  useEffect(() => {
    if (!userData) return;
    if (!isAdminOrVJ) {
      setDataLoading(false);
      return;
    }

    const usersUnsub = onSnapshot(query(collection(db, "users")), (snapshot) => {
      const allFetchedUsers = snapshot.docs.map(d => d.data());
      const pending = allFetchedUsers.filter(u => u.approved === false);
      const confirmed = allFetchedUsers.filter(u => u.approved === true);
      confirmed.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
      setPendingUsers(pending);
      setAllUsers(confirmed);
      setDataLoading(false);
    }, (error) => {
      console.error("Error fetching admin data:", error);
      showNotification('error', 'Chyba při načítání dat.');
      setDataLoading(false);
    });

    const eqUnsub = onSnapshot(doc(db, "settings", "equipmentTypes"), (eqDoc) => {
      if (eqDoc.exists()) {
        setEquipmentTypes(eqDoc.data().types || []);
      }
    }, (error) => {
      console.error("Error fetching equipment types:", error);
    });

    return () => { usersUnsub(); eqUnsub(); };
  }, [isAdminOrVJ, userData, showNotification]);

  // Calculate statistics
  useEffect(() => {
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

  function requestConfirm(message, onConfirm) {
    setConfirmModal({ message, onConfirm });
  }

  // Equipment type mutations
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
    
    if (newEq.id) {
      const newTypes = equipmentTypes.map(t => t.id === newEq.id ? { ...newEq, name: newEq.name.trim() } : t);
      saveEquipmentTypes(newTypes);
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_UPDATED_EQUIPMENT_TYPE', 'admin',
        `Upravil definici druhu vybavení: "${newEq.name.trim()}"`);
    } else {
      const id = newEq.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
      
      if (equipmentTypes.some(t => t.id === id)) {
        showNotification('error', 'Tento druh vybavení již pravděpodobně existuje (podle názvu).');
        return;
      }
      const newTypes = [...equipmentTypes, { ...newEq, name: newEq.name.trim(), id }];
      saveEquipmentTypes(newTypes);

      const fields = [];
      if (newEq.hasBrand) fields.push('značka');
      if (newEq.hasSize) fields.push('velikost');
      if (newEq.hasAmount) fields.push('počet');
      if (newEq.hasInventoryNumber) fields.push('evid. číslo');
      if (newEq.hasSerialNumber) fields.push('výrobní číslo');
      if (newEq.hasManufactureYear) fields.push('rok výroby');
      if (newEq.hasIssueYear) fields.push('rok nafasování');
      if (newEq.hasWear) fields.push('stav opotřebení');
      if (newEq.hasPolep) fields.push('polep');
      
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_ADDED_EQUIPMENT_TYPE', 'admin',
        `Přidal druh vybavení: "${newEq.name.trim()}" (Eviduje se: ${fields.join(', ') || 'nic'})`);
    }

    setNewEq({
      id: null, name: '', hasBrand: false, hasSize: false, hasAmount: true,
      hasInventoryNumber: false, hasSerialNumber: false,
      hasManufactureYear: false, hasIssueYear: false, hasWear: false, hasPolep: false
    });
    setShowEqModal(false);
  }

  function reorderEquipmentTypes(newTypes) {
    saveEquipmentTypes(newTypes);
    logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
      'ADMIN_UPDATED_EQUIPMENT_TYPE', 'admin',
      `Změnil pořadí druhů vybavení: ${newTypes.map(t => t.name).join(', ')}`);
  }

  function handleRemoveEq(id) {
    const eqType = equipmentTypes.find(t => t.id === id);
    requestConfirm(`⚠️ POZOR: Opravdu smazat druh vybavení "${eqType?.name || id}"? Tímto krokem NENÁVRATNĚ SMAŽETE veškeré zaevidované vybavení tohoto typu všem členům z jejich profilů!`, async () => {
      const newTypes = equipmentTypes.filter(t => t.id !== id);
      await saveEquipmentTypes(newTypes);
      
      const usersToUpdate = allUsers.filter(u => {
        const hasLegacy = u.equipment && u.equipment[id];
        const hasNew = u.equipmentList && u.equipmentList.some(eq => eq.typeId === id);
        return hasLegacy || hasNew;
      });

      let removedCount = 0;
      for (const u of usersToUpdate) {
        const userRef = doc(db, "users", u.uid);
        const updates = {};
        
        if (u.equipmentList) {
          updates.equipmentList = u.equipmentList.filter(eq => eq.typeId !== id);
        }
        
        if (u.equipment && u.equipment[id]) {
          const newLegacyEq = { ...u.equipment };
          delete newLegacyEq[id];
          updates.equipment = newLegacyEq;
        }

        if (Object.keys(updates).length > 0) {
          try {
            await updateDoc(userRef, updates);
            removedCount++;
          } catch(e) {
            console.error(`Failed to delete equipment ${id} for user ${u.uid}`, e);
          }
        }
      }

      // Update local state to immediately show updated inventory tabs
      setAllUsers(prev => prev.map(u => {
        const updates = {};
        if (u.equipmentList) updates.equipmentList = u.equipmentList.filter(eq => eq.typeId !== id);
        if (u.equipment && u.equipment[id]) {
          const newLegacyEq = { ...u.equipment };
          delete newLegacyEq[id];
          updates.equipment = newLegacyEq;
        }
        return Object.keys(updates).length > 0 ? { ...u, ...updates } : u;
      }));

      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_REMOVED_EQUIPMENT_TYPE', 'admin',
        `Smazal druh vybavení: "${eqType?.name || id}" a odebral jej ${removedCount} uživatelům.`);
        
      showNotification('success', `Druh vybavení byl úspěšně smazán a odebrán ${removedCount} uživatelům.`);
    });
  }

  // User state mutations
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
    } catch (error) {
      console.error("Error approving user:", error);
      showNotification('error', 'Chyba při schvalování.');
    }
  }

  function rejectPendingUser(user) {
    requestConfirm(`Opravdu zamítnout a smazat ${user.firstName} ${user.lastName}?`, async () => {
      try {
        await deleteDoc(doc(db, "users", user.uid));
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'ADMIN_REJECTED_USER', 'admin',
          `Zamítl a smazal registraci uživatele ${user.firstName} ${user.lastName} (${user.email})`);
        showNotification('success', 'Žádost zamítnuta.');
      } catch (e) {
        console.error(e);
        showNotification('error', "Chyba akce.");
      }
    });
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
          const userToUpdate = allUsers.find(u => u.uid === uid);
          await updateDoc(doc(db, "users", uid), { disabled: shouldDisable });
          setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, disabled: shouldDisable } : u));

          logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
            shouldDisable ? 'ADMIN_DEACTIVATED_USER' : 'ADMIN_ACTIVATED_USER', 'admin',
            `${shouldDisable ? 'Deaktivoval' : 'Aktivoval'} účet uživatele ${userToUpdate?.firstName} ${userToUpdate?.lastName}`);

          if (shouldDisable) {
            const today = new Date();
            const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            // Remove from future Events
            const eventsQuery = query(collection(db, 'events'), where('date', '>=', todayISO));
            const eventsSnapshot = await getDocs(eventsQuery);
            for (const eventDoc of eventsSnapshot.docs) {
              const participants = eventDoc.data().participants || [];
              if (participants.some(p => p.uid === uid)) {
                const updatedParticipants = participants.filter(p => p.uid !== uid);
                await updateDoc(doc(db, 'events', eventDoc.id), { participants: updatedParticipants });
              }
            }

            // Remove from future Trainings
            const trainingsQuery = query(collection(db, 'trainings'), where('date', '>=', todayISO));
            const trainingsSnapshot = await getDocs(trainingsQuery);
            for (const trainingDoc of trainingsSnapshot.docs) {
              const participants = trainingDoc.data().participants || [];
              if (participants.some(p => p.uid === uid)) {
                const updatedParticipants = participants.filter(p => p.uid !== uid);
                await updateDoc(doc(db, 'trainings', trainingDoc.id), { participants: updatedParticipants });
              }
            }

            // Remove from future Shifts
            const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const currentDay = today.getDate();

            const shiftsSnapshot = await getDocs(collection(db, 'shifts'));
            for (const shiftDoc of shiftsSnapshot.docs) {
              const monthId = shiftDoc.id;
              if (monthId < currentMonth) continue;

              const days = shiftDoc.data().days || {};
              let hasUpdates = false;
              const updatedDays = { ...days };

              for (const [dayNum, dayData] of Object.entries(days)) {
                const dayNumber = parseInt(dayNum);
                if (monthId === currentMonth && dayNumber < currentDay) continue;

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

                if (dayData.zalohaStaz) {
                  let shiftUpdated = false;
                  const updatedZalohaStaz = { ...dayData.zalohaStaz };
                  
                  if (updatedZalohaStaz.interested) {
                    const originalLength = updatedZalohaStaz.interested.length;
                    updatedZalohaStaz.interested = updatedZalohaStaz.interested.filter(p => p.uid !== uid);
                    if (updatedZalohaStaz.interested.length !== originalLength) {
                      shiftUpdated = true;
                      hasUpdates = true;
                    }
                  }

                  for (const [slotKey, assignee] of Object.entries(dayData.zalohaStaz)) {
                    if (slotKey !== 'config' && slotKey !== 'interested') {
                      if (assignee && assignee.uid === uid) {
                        delete updatedZalohaStaz[slotKey];
                        shiftUpdated = true;
                        hasUpdates = true;
                      }
                    }
                  }

                  if (shiftUpdated) {
                    updatedDays[dayNum] = { ...updatedDays[dayNum], zalohaStaz: updatedZalohaStaz };
                  }
                }
              }

              if (hasUpdates) {
                await updateDoc(doc(db, 'shifts', monthId), { days: updatedDays });
              }
            }

            // Remove future absences
            const absenceDocRef = doc(db, 'absences', 'global');
            const absenceSnapshot = await getDoc(absenceDocRef);
            if (absenceSnapshot.exists()) {
              const allAbsences = absenceSnapshot.data().items || [];
              const updatedAbsences = allAbsences.filter(
                absence => !(absence.uid === uid && absence.endDate >= todayISO)
              );
              if (updatedAbsences.length !== allAbsences.length) {
                await updateDoc(absenceDocRef, { items: updatedAbsences });
              }
            }
          }

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

    const uniqueRoles = ['VJ', 'Zástupce VJ', 'Zastupce VJ'];
    const isAddingRole = !roles.includes(roleToToggle);

    if (isAddingRole && uniqueRoles.includes(roleToToggle)) {
      const normalizedRole = roleToToggle === 'Zastupce VJ' ? 'Zástupce VJ' : roleToToggle;
      const existingHolder = allUsers.find(u => {
        if (u.uid === uid) return false;
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

  async function updateRegistrationNumber(uid, newVal, oldVal) {
    if (newVal === oldVal) return;
    try {
      await updateDoc(doc(db, "users", uid), { registrationNumber: newVal });
      setAllUsers(prev => prev.map(u => u.uid === uid ? { ...u, registrationNumber: newVal } : u));
      const targetUser = allUsers.find(u => u.uid === uid);
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'UPDATED_PROFILE', 'admin',
        `Změnil evidenční číslo uživatele ${targetUser?.firstName} ${targetUser?.lastName} na "${newVal}"`);
      showNotification('success', 'Evidenční číslo uloženo.');
    } catch (error) {
      console.error("Error updating registration number:", error);
      showNotification('error', "Chyba při ukládání evidenčního čísla.");
    }
  }

  async function createUserForOther({ firstName, lastName, email, phone, password, roles }) {
    setLoading(true);
    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(auth.app.options, `secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const result = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = result.user.uid;

      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email,
        firstName,
        lastName,
        phone: phone || '',
        address: '',
        roles: roles || ['Hasič'],
        approved: true,
        mustChangePassword: true,
        tempPassword: password,
        createdAt: new Date().toISOString(),
        createdByAdmin: currentUser.uid
      });

      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_CREATED_USER', 'admin',
        `Vytvořil účet pro ${firstName} ${lastName} (${email})`);

      showNotification('success', `Účet pro ${firstName} ${lastName} byl úspěšně vytvořen.`);
      return true;
    } catch (error) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        showNotification('error', 'Tento email je již používán.');
      } else if (error.code === 'auth/invalid-email') {
        showNotification('error', 'Neplatný formát emailu.');
      } else {
        showNotification('error', 'Chyba při vytváření účtu: ' + error.message);
      }
      return false;
    } finally {
      if (secondaryApp) {
        try { await firebaseSignOut(getAuth(secondaryApp)); } catch {}
        try { await deleteApp(secondaryApp); } catch {}
      }
      setLoading(false);
    }
  }

  // Equipment save and delete hooks that reactively update member inventory
  async function onSaveEquipment(e, currentEq, targetUserId) {
    e.preventDefault();
    if (!currentEq || !currentEq.typeId || !targetUserId) return;
    
    try {
      const userRef = doc(db, "users", targetUserId);
      const targetUser = allUsers.find(u => u.uid === targetUserId);
      const baseList = targetUser?.equipmentList || [];
      let newList = [];
      let isNew = false;
      
      if (currentEq.id && !currentEq.id.startsWith('new_')) {
        newList = baseList.map(item => item.id === currentEq.id ? currentEq : item);
      } else {
        isNew = true;
        const newEqObj = { ...currentEq };
        if (newEqObj.id.startsWith('new_')) {
          newEqObj.id = crypto.randomUUID();
        }
        newList = [...baseList, newEqObj];
      }
      
      const eqType = equipmentTypes.find(t => t.id === currentEq.typeId);
      
      await updateDoc(userRef, { equipmentList: newList });
      
      // Update local state to immediately show updated inventory tables without refresh
      setAllUsers(prev => prev.map(u => u.uid === targetUserId ? { ...u, equipmentList: newList } : u));
      
      const actionCreatorName = `${userData.firstName} ${userData.lastName}`;
      logAction(db, currentUser.uid, actionCreatorName,
        'ADMIN_UPDATED_EQUIPMENT', 'admin',
        `${isNew ? 'Přidal' : 'Upravil'} vybavení (${eqType?.name}) uživateli ${targetUser.firstName} ${targetUser.lastName}`);
        
      showNotification('success', 'Záznam vybavení byl úspěšně uložen.');
    } catch (err) {
      console.error(err);
      showNotification('error', 'Chyba při ukládání vybavení.');
    }
  }

  function onDeleteEquipment(itemId, userId) {
    requestConfirm('Opravdu smazat tuto položku vybavení?', async () => {
      try {
        const targetUser = allUsers.find(u => u.uid === userId);
        const userRef = doc(db, "users", userId);
        
        const currentList = targetUser?.equipmentList || [];
        const newList = currentList.filter(item => item.id !== itemId);
        
        await updateDoc(userRef, { equipmentList: newList });
        
        // Update local state to immediately show updated inventory tables without refresh
        setAllUsers(prev => prev.map(u => u.uid === userId ? { ...u, equipmentList: newList } : u));
        
        const actionCreatorName = `${userData.firstName} ${userData.lastName}`;
        logAction(db, currentUser.uid, actionCreatorName,
          'ADMIN_UPDATED_EQUIPMENT', 'admin',
          `Smazal záznam vybavení uživateli ${targetUser.firstName} ${targetUser.lastName}`);
          
        showNotification('success', 'Záznam vybavení byl úspěšně smazán.');
      } catch (err) {
        console.error(err);
        showNotification('error', 'Chyba při mazání vybavení.');
      }
    });
  }

  return {
    currentUser,
    userData,
    loading,
    dataLoading,
    pendingUsers,
    allUsers,
    setAllUsers,
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
    confirmModal,
    setConfirmModal,
    userRoles,
    isAdminOrVJ,
    handleAddEq,
    handleRemoveEq,
    reorderEquipmentTypes,
    approveUser,
    rejectPendingUser,
    deactivateUser,
    deleteUser,
    toggleUserRole,
    toggleUserCertification,
    updateRegistrationNumber,
    onSaveEquipment,
    onDeleteEquipment,
    createUserForOther
  };
}
