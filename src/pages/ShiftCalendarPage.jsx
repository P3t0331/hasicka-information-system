import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, deleteField, updateDoc, arrayUnion, arrayRemove, collection } from 'firebase/firestore';
import { logAction } from '../utils/logger';

const DAYS_CZ = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

// Format ISO date (YYYY-MM-DD) to Czech format (D.M.)
const formatDateCZ = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${parseInt(day)}.${parseInt(month)}.`;
};

// Slot types configuration
// Slot types configuration
const SLOT_TYPES = ['velitel', 'strojnik', 'hasic1', 'hasic2', 'hasic3', 'hasic4', 'hasic5'];
const SLOT_LABELS = {
  velitel: 'Velitel',
  strojnik: 'Strojník',
  hasic1: 'Hasič 1',
  hasic2: 'Hasič 2',
  hasic3: 'Hasič 3',
  hasic4: 'Hasič 4',
  hasic5: 'Hasič 5',
};

const getSlotLabel = (slotKey) => {
  if (SLOT_LABELS[slotKey]) return SLOT_LABELS[slotKey];
  if (slotKey.startsWith('velitel')) return 'Velitel ' + slotKey.replace('velitel', '');
  if (slotKey.startsWith('strojnik')) return 'Strojník ' + slotKey.replace('strojnik', '');
  if (slotKey.startsWith('hasic')) return 'Hasič ' + slotKey.replace('hasic', '');
  return slotKey;
};

const getSlotBaseType = (slotKey) => {
  if (slotKey.startsWith('velitel')) return 'velitel';
  if (slotKey.startsWith('strojnik')) return 'strojnik';
  if (slotKey.startsWith('hasic')) return 'hasic';
  return slotKey;
};

export default function ShiftCalendarPage() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shiftsData, setShiftsData] = useState({});
  const [loading, setLoading] = useState(true);

  // For adding new day shifts
  const [newDayShiftDate, setNewDayShiftDate] = useState('');

  // For adding new Zaloha/Staz
  const [zalohaModal, setZalohaModal] = useState(null);

  // Toast notification state
  const [toast, setToast] = useState(null); // { type: 'error'|'warning'|'success'|'info', message: string }

  // Modal state for confirmations
  const [modal, setModal] = useState(null); // { title, message, onConfirm, onCancel }

  // Vehicle assignment modal
  const [vehicleModal, setVehicleModal] = useState(null); // { day, section, vehicleId, currentAssignees }

  // Absence state
  const [absencesData, setAbsencesData] = useState([]); // Array of { id, uid, userName, startDate, endDate, reason }
  const [absenceModal, setAbsenceModal] = useState(null); // { mode: 'add'|'edit', absence?: object }
  const [absencePanelOpen, setAbsencePanelOpen] = useState(true);

  // Trainings state
  const [trainingsData, setTrainingsData] = useState([]);

  // Events state
  const [eventsData, setEventsData] = useState([]);

  // Activity popup state (for Option B - indicator dots)
  const [activityPopup, setActivityPopup] = useState(null); // { day } - only stores the day, activities derived from live data
  const [collapsedWeeks, setCollapsedWeeks] = useState({}); // { 'd-0': true, 'n-1': false }
  const [zalohaAssignModal, setZalohaAssignModal] = useState(null); // { day, slotKey, section }

  const groupWeeks = (daysArray) => {
    const weeks = [];
    let currentWeek = [];
    daysArray.forEach((day, index) => {
      currentWeek.push(day);
      if (day.dayOfWeek === 0 || index === daysArray.length - 1) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    return weeks;
  };

  const toggleWeek = (weekId) => {
    setCollapsedWeeks(prev => ({ ...prev, [weekId]: !prev[weekId] }));
  };

  const DAY_SHIFTS_PREVIEW_COUNT = 3;

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const showConfirm = (title, message) => {
    return new Promise((resolve) => {
      setModal({
        title,
        message,
        onConfirm: () => { setModal(null); resolve(true); },
        onCancel: () => { setModal(null); resolve(false); }
      });
    });
  };

  const getMonthDocId = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentDocId = getMonthDocId(currentDate);
  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];

  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, 'shifts', currentDocId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setShiftsData(docSnap.data().days || {});
      } else {
        setShiftsData({});
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [currentDocId]);

  // Subscribe to ALL absences (global collection) and filter for current month view
  useEffect(() => {
    const absenceDocRef = doc(db, 'absences', 'global');

    const unsubscribe = onSnapshot(absenceDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const allAbsences = docSnap.data().items || [];

        // Filter absences that overlap with current month
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // An absence overlaps if: startDate <= monthEnd AND endDate >= monthStart
        const relevantAbsences = allAbsences.filter(a =>
          a.startDate <= monthEnd && a.endDate >= monthStart
        );

        setAbsencesData(relevantAbsences);
      } else {
        setAbsencesData([]);
      }
    });

    return unsubscribe;
  }, [currentDate]);

  // Subscribe to trainings
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'trainings'), (snapshot) => {
      const allTrainings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${year}-${month}`;

      // Filter trainings for current month
      const currentMonthTrainings = allTrainings.filter(t => t.date && t.date.startsWith(monthPrefix));
      setTrainingsData(currentMonthTrainings);
    });
    return unsubscribe;
  }, [currentDate]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${year}-${month}`;

      // Filter events for current month
      const currentMonthEvents = allEvents.filter(e => e.date && e.date.startsWith(monthPrefix));
      setEventsData(currentMonthEvents);
    });
    return unsubscribe;
  }, [currentDate]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 1; i <= daysCount; i++) {
      const d = new Date(year, month, i);
      result.push({
        date: i,
        dayName: DAYS_CZ[d.getDay()],
        dayOfWeek: d.getDay(), // 0 = Sunday
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday: new Date().toDateString() === d.toDateString()
      });
    }
    return result;
  };

  const days = getDaysInMonth(currentDate);

  const handleMonthChange = (offset) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
    setNewDayShiftDate('');
  };

  const isQualifiedFor = (slotType) => {
    const base = getSlotBaseType(slotType);
    if (base === 'velitel') return userRoles.some(r => ['VD', 'VJ', 'Zástupce VJ', 'Admin'].includes(r));
    if (base === 'strojnik') return userRoles.some(r => ['Strojník', 'Admin'].includes(r));
    return true; // Everyone is qualified for Hasič
  };

  const handleSlotClick = async (day, section, slotKey) => {
    if (!userData || !userData.approved) return;

    const dayData = shiftsData[day] || { dayShift: {}, nightShift: {} };
    const sectionData = dayData[section] || {};
    const currentAssignee = sectionData[slotKey];

    const userCompact = {
      uid: currentUser.uid,
      name: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''}`,
      qualified: isQualifiedFor(slotKey)
    };

    let newData = { ...dayData };
    if (!newData[section]) newData[section] = {};

    // Helper to clean up explicit hours when changing shift status
    const cleanupHours = (targetUid) => {
      // Ensure hours map exists
      if (!newData.hours) newData.hours = {};

      const checkPresence = (shiftType) => {
        const slots = newData[shiftType] || {};
        return Object.values(slots).some(u => u && u.uid === targetUid);
      };

      // Determine valid presence in the FUTURE state
      // (Since we already updated the slots for 'section' in newData)
      const inDay = checkPresence('dayShift');
      const inNight = checkPresence('nightShift');

      // We wipe the 'day' override if:
      // 1. We are explicitly modifying the Day shift (Removal/Add resets to default)
      // 2. OR The user is simply not in the Day shift anymore (Ghost cleanup)
      const wipeDay = (section === 'dayShift') || !inDay;

      // We wipe the 'night' override if:
      // 1. We are explicitly modifying the Night shift
      // 2. OR The user is not in the Night shift
      const wipeNight = (section === 'nightShift') || !inNight;

      if (wipeDay && wipeNight) {
        // User removed from everything or explicit reset of everything -> Delete entry
        newData.hours[targetUid] = deleteField();
      } else {
        // Partial reset (e.g. keeping Night override but clearing Day)
        const patch = {};
        // Important: Firestore merge deeply. We must explicitely DELETE keys we don't want.
        if (wipeDay) patch.day = deleteField();
        if (wipeNight) patch.night = deleteField();

        newData.hours[targetUid] = patch;
      }
    };

    // --- ZALOHA / STAZ LOGIC ---
    if (section === 'zalohaStaz') {
      const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r));
      
      if (!isAdmin) {
        showToast('error', 'Na pozice u Stáže/Zálohy může přiřazovat pouze velitel. Použijte tlačítko "Mám zájem".');
        return;
      }

      if (currentAssignee) {
        // Admin clicking occupied slot
        const confirmed = await showConfirm('Uvolnit pozici', `Chcete odebrat uživatele ${currentAssignee.name} z této pozice? (Zůstane v seznamu zájemců)`);
        if (!confirmed) return;
        newData[section] = { ...newData[section], [slotKey]: deleteField() };
      } else {
        // Admin clicking empty slot
        setZalohaAssignModal({ day, slotKey, section });
        return; // wait for modal
      }
    } 
    // --- DAY / NIGHT SHIFT LOGIC ---
    else {
      // Case 1: Clicking on own slot -> remove self
      if (currentAssignee && currentAssignee.uid === currentUser.uid) {
      const confirmed = await showConfirm('Zrušit službu', 'Opravdu chcete zrušit svou službu?');
      if (!confirmed) return;
      newData[section] = { ...newData[section], [slotKey]: deleteField() };
      cleanupHours(currentUser.uid);
    }
    // Case 2: Slot is taken by someone else
    else if (currentAssignee) {
      const currentUserIsQualified = isQualifiedFor(slotKey);
      const existingIsUnqualified = currentAssignee.qualified === false;

      // Qualified user can bump unqualified user (only for velitel, strojnik is strict)
      if (slotKey === 'velitel' && currentUserIsQualified && existingIsUnqualified) {
        const hasicSlots = ['hasic1', 'hasic2', 'hasic3'];
        const freeHasicSlot = hasicSlots.find(s => !newData[section][s]);

        if (freeHasicSlot) {
          const confirmed = await showConfirm(
            'Převzít místo',
            `Převzít pozici Velitele od ${currentAssignee.name}? Bude přesunut na Hasiče.`
          );
          if (!confirmed) return;
          newData[section][freeHasicSlot] = { ...currentAssignee, qualified: true };
          newData[section][slotKey] = userCompact;
          // Clean up hours for the user TAKING the spot (reset to default)
          cleanupHours(currentUser.uid);
        } else {
          showToast('error', 'Nelze převzít místo - všechny pozice Hasič jsou obsazené.');
          return;
        }
      } else if (userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r))) {
        const confirmed = await showConfirm('Odebrat uživatele', `Chcete odebrat uživatele ${currentAssignee.name}?`);
        if (!confirmed) return;
        newData[section] = { ...newData[section], [slotKey]: deleteField() };
        cleanupHours(currentAssignee.uid);
      } else {
        showToast('error', 'Toto místo je již obsazeno.');
        return;
      }
    }
    // Case 3: Slot is free
    else {
      // Check if user already has a slot in this shift
      const existingUserSlot = SLOT_TYPES.find(s => sectionData[s]?.uid === currentUser.uid);
      if (existingUserSlot) {
        showToast('warning', `Již máte službu na této směně (${getSlotLabel(existingUserSlot)}). Nejprve se odhlaste.`);
        return;
      }

      // Strojník is STRICT - must be qualified
      if (getSlotBaseType(slotKey) === 'strojnik' && !isQualifiedFor(slotKey)) {
        showToast('error', 'Pro pozici Strojník musíte mít příslušnou kvalifikaci.');
        return;
      }

      // Velitel can have unqualified (yellow) with warning
      if (getSlotBaseType(slotKey) === 'velitel' && !isQualifiedFor(slotKey)) {
        const proceed = await showConfirm(
          '⚠️ Chybí kvalifikace',
          'Nemáte kvalifikaci pro Velitele. Budete označeni žlutě a kvalifikovaný VD vás může nahradit. Pokračovat?'
        );
        if (!proceed) return;
        userCompact.qualified = false;
      }

      newData[section][slotKey] = userCompact;
      // Reset hours to default for the new entry
      cleanupHours(currentUser.uid);
    }
    } // End of Day/Night Shift logic

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, { days: { [day]: newData } }, { merge: true });

      // Determine what happened for logging
      const shiftLabel = section === 'dayShift' ? 'denní' : section === 'nightShift' ? 'noční' : 'záloha/stáž';
      const slotLabel = getSlotLabel(slotKey);
      const dateLabel = `${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      
      if (section === 'zalohaStaz') {
          logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
            'ADMIN_REMOVED_USER_FROM_STAZ', 'shifts',
            `Odebral uživatele z pozice ${slotLabel} – ${shiftLabel} sloužba ${dateLabel}`);
      } else {
          const wasRemoved = currentAssignee && currentAssignee.uid === currentUser.uid;
          const wasKicked = currentAssignee && currentAssignee.uid !== currentUser.uid;
          if (wasKicked) {
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
              'REMOVED_USER_FROM_SHIFT', 'shifts',
              `Odebral ${currentAssignee.name} z pozice ${slotLabel} – ${shiftLabel} sloužba ${dateLabel}`);
          } else if (wasRemoved) {
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
              'LEFT_SHIFT', 'shifts',
              `Odhlásil se z ${shiftLabel} služby ${dateLabel} (${slotLabel})`);
          } else {
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
              'JOINED_SHIFT', 'shifts',
              `Přihlásil se na ${shiftLabel} službu ${dateLabel} – pozice: ${slotLabel}`);
          }
      }

      showToast('success', 'Služba uložena.');
    } catch (err) {
      console.error("Error updating shift:", err);
      showToast('error', 'Chyba při ukládání služby.');
    }
  };

  const handleZalohaInterestedClick = async (day) => {
    if (!userData || !userData.approved) return;

    const dayData = shiftsData[day] || {};
    const sectionData = dayData.zalohaStaz || { interested: [] };
    const interested = sectionData.interested || [];
    
    const isInterested = interested.some(u => u.uid === currentUser.uid);

    let newInterested;
    let newData = { ...dayData };
    if (!newData.zalohaStaz) newData.zalohaStaz = {};

    if (isInterested) {
      // Zrušit zájem
      const confirmed = await showConfirm('Zrušit zájem', 'Opravdu chcete zrušit svůj zájem o tuto Stáž/Zálohu? Budete odebráni i z případné přiřazené pozice.');
      if (!confirmed) return;
      newInterested = interested.filter(u => u.uid !== currentUser.uid);
      
      // Remove from any assigned slot
      const slots = Object.keys(newData.zalohaStaz).filter(k => k !== 'config' && k !== 'interested');
      for (const s of slots) {
          if (newData.zalohaStaz[s] && newData.zalohaStaz[s].uid === currentUser.uid) {
              newData.zalohaStaz[s] = deleteField();
          }
      }
    } else {
      // Mám zájem
      newInterested = [...interested, {
        uid: currentUser.uid,
        name: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''}`,
        qualifiedVelitel: isQualifiedFor('velitel'),
        qualifiedStrojnik: isQualifiedFor('strojnik')
      }];
    }
    
    newData.zalohaStaz.interested = newInterested;

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, { days: { [day]: newData } }, { merge: true });
      showToast('success', isInterested ? 'Zájem zrušen.' : 'Přidáni do seznamu zájemců.');
    } catch (err) {
      console.error("Error updating interested:", err);
      showToast('error', 'Chyba při ukládání.');
    }
  };

  const handleZalohaAssignUser = async (targetUser) => {
      if (!zalohaAssignModal) return;
      
      const { day, slotKey, section } = zalohaAssignModal;
      const dayData = shiftsData[day] || {};
      let newData = { ...dayData };
      
      // check qualification if strict
      const baseType = getSlotBaseType(slotKey);
      if (baseType === 'strojnik' && !targetUser.qualifiedStrojnik) {
          showToast('error', 'Pro pozici Strojník musí mít uživatel příslušnou kvalifikaci.');
          return;
      }
      
      let qualified = true;
      if (baseType === 'velitel' && !targetUser.qualifiedVelitel) {
          const proceed = await showConfirm(
            '⚠️ Chybí kvalifikace',
            `Uživatel nemá kvalifikaci pro Velitele. Bude označen žlutě. Pokračovat?`
          );
          if (!proceed) return;
          qualified = false;
      }

      if (!newData[section]) newData[section] = {};
      
      // Remove user from any other slot in this shift to prevent duplicates
      const slots = Object.keys(newData[section]).filter(k => k !== 'config' && k !== 'interested');
      for (const s of slots) {
          if (newData[section][s] && newData[section][s].uid === targetUser.uid) {
              newData[section][s] = deleteField();
          }
      }

      newData[section][slotKey] = {
          uid: targetUser.uid,
          name: targetUser.name,
          qualified
      };

      try {
        const docRef = doc(db, 'shifts', currentDocId);
        await setDoc(docRef, { days: { [day]: newData } }, { merge: true });
        
        const dateLabel = `${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
            'ADMIN_ASSIGNED_USER_TO_STAZ', 'shifts',
            `Přiřadil ${targetUser.name} na pozici ${getSlotLabel(slotKey)} – stáž ${dateLabel}`);
            
        showToast('success', 'Uživatel přiřazen na pozici.');
        setZalohaAssignModal(null);
      } catch (err) {
        console.error("Error updating shift:", err);
        showToast('error', 'Chyba při ukládání služby.');
      }
  };

  // Get only days that have dayShift enabled
  const enabledDayShifts = days.filter(day => {
    const dayData = shiftsData[day.date];
    return dayData && (dayData.dayShiftEnabled || (dayData.dayShift && Object.keys(dayData.dayShift).length > 0));
  });

  const enabledZalohaShifts = days.filter(day => {
    const dayData = shiftsData[day.date];
    return dayData && dayData.zalohaStaz;
  });

  // Remove an empty day shift
  const handleRemoveDayShift = async (date) => {
    const dayData = shiftsData[date] || {};
    const currentShift = dayData.dayShift || {};
    
    const takenSlots = Object.keys(currentShift);
    let warningMsg = `Opravdu chcete zrušit denní službu pro ${date}. ${MONTHS_CZ[currentDate.getMonth()]}?`;
    if (takenSlots.length > 0) {
      warningMsg = `POZOR: Tato denní služba má obsazené pozice! Opravdu chcete směnu ZRUŠIT a odebrat lidi?`;
    }

    const confirmed = await showConfirm('Odebrat denní službu', warningMsg);
    if (!confirmed) return;

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      // Remove the dayShiftEnabled flag and the dayShift object
      await setDoc(docRef, {
        days: {
          [date]: {
            dayShiftEnabled: deleteField(),
            dayShift: deleteField()
          }
        }
      }, { merge: true });
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_REMOVED_DAY_SHIFT', 'admin',
        `Zrušil denní službu pro den ${date}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`);
      showToast('success', 'Denní služba odebrána.');
    } catch (err) {
      console.error("Error removing day shift:", err);
      showToast('error', 'Chyba při odebírání služby.');
    }
  };

  const handleRemoveZaloha = async (date) => {
    const dayData = shiftsData[date] || {};
    const currentShift = dayData.zalohaStaz || {};
    
    // Check if any slots are taken (excluding the config)
    const takenSlots = Object.keys(currentShift).filter(k => k !== 'config' && k !== 'interested');
    let warningMsg = `Opravdu chcete zrušit stáž/zálohu pro ${date}. ${MONTHS_CZ[currentDate.getMonth()]}?`;
    if (takenSlots.length > 0) {
      warningMsg = `POZOR: Tato stáž/záloha má obsazené pozice! Opravdu chcete směnu ZRUŠIT a odebrat lidi?`;
    }

    const confirmed = await showConfirm('Odebrat stáž/zálohu', warningMsg);
    if (!confirmed) return;

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, {
        days: {
          [date]: {
            zalohaStaz: deleteField()
          }
        }
      }, { merge: true });
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_REMOVED_SHIFT', 'admin',
        `Zrušil stáž/zálohu pro den ${date}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`);
      showToast('success', 'Stáž/záloha odebrána.');
    } catch (err) {
      console.error("Error removing zaloha shift:", err);
      showToast('error', 'Chyba při odebírání služby.');
    }
  };

  // Add a new day shift for a specific date
  const handleAddDayShift = async () => {
    if (!newDayShiftDate) {
      showToast('warning', 'Vyberte datum pro denní službu.');
      return;
    }

    const dateNum = parseInt(newDayShiftDate);
    if (isNaN(dateNum) || dateNum < 1 || dateNum > days.length) {
      showToast('error', 'Neplatné datum.');
      return;
    }

    // Check if already exists
    if (enabledDayShifts.some(d => d.date === dateNum)) {
      showToast('warning', 'Denní služba pro tento den již existuje.');
      return;
    }

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, {
        days: {
          [dateNum]: {
            dayShiftEnabled: true,
            dayShift: {}
          }
        }
      }, { merge: true });
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_ADDED_DAY_SHIFT', 'admin',
        `Vytvořil denní službu pro den ${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`);
      showToast('success', `Denní služba pro ${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} vytvořena.`);
      setNewDayShiftDate('');
    } catch (err) {
      console.error("Error adding day shift:", err);
      showToast('error', 'Chyba při vytváření denní služby.');
    }
  };

  // Absence handlers
  const handleAddAbsence = async (absenceData) => {
    if (!userData || !userData.approved) return;

    const newAbsence = {
      id: `${currentUser.uid}-${Date.now()}`,
      uid: currentUser.uid,
      userName: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''}`,
      startDate: absenceData.startDate, // Now ISO string like "2026-02-15"
      endDate: absenceData.endDate,     // Now ISO string like "2026-03-05"
      reason: absenceData.reason
    };

    try {
      const absenceDocRef = doc(db, 'absences', 'global');
      await setDoc(absenceDocRef, {
        items: arrayUnion(newAbsence)
      }, { merge: true });
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADDED_ABSENCE', 'shifts',
        `Přidal absenci: "${absenceData.reason}" (${absenceData.startDate} – ${absenceData.endDate})`);
      showToast('success', 'Absence uložena.');
      setAbsenceModal(null);
    } catch (err) {
      console.error("Error adding absence:", err);
      showToast('error', 'Chyba při ukládání absence.');
    }
  };

  const handleDeleteAbsence = async (absence) => {
    // Only allow deleting own absences (or admin)
    const isAdmin = userRoles.includes('Admin') || userRoles.includes('VJ');
    if (absence.uid !== currentUser.uid && !isAdmin) {
      showToast('error', 'Můžete mazat pouze své vlastní absence.');
      return;
    }

    const confirmed = await showConfirm('Smazat absenci', `Opravdu chcete smazat absenci "${absence.reason}"?`);
    if (!confirmed) return;

    try {
      const absenceDocRef = doc(db, 'absences', 'global');
      await updateDoc(absenceDocRef, {
        items: arrayRemove(absence)
      });
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'DELETED_ABSENCE', 'shifts',
        `Smazal absenci: "${absence.reason}" (${absence.startDate} – ${absence.endDate})`);
      showToast('success', 'Absence smazána.');
    } catch (err) {
      console.error("Error deleting absence:", err);
      showToast('error', 'Chyba při mazání absence.');
    }
  };

  if (loading) {
    return (
      <div className="container mt-4 flex-center" style={{ minHeight: '300px' }}>
        <p>Načítám služby...</p>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ maxWidth: '900px', position: 'relative' }}>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          padding: '1rem 1.5rem',
          borderRadius: '8px',
          background: toast.type === 'error' ? '#FFEBEE' :
            toast.type === 'warning' ? '#FFF8E1' :
              toast.type === 'success' ? '#E8F5E9' : '#E3F2FD',
          color: toast.type === 'error' ? '#B71C1C' :
            toast.type === 'warning' ? '#F57C00' :
              toast.type === 'success' ? '#1B5E20' : '#1565C0',
          border: `1px solid ${toast.type === 'error' ? '#EF9A9A' :
            toast.type === 'warning' ? '#FFCC80' :
              toast.type === 'success' ? '#81C784' : '#64B5F6'
            }`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxWidth: '350px',
          fontSize: '0.9rem',
          fontWeight: 500,
          animation: 'fadeIn 0.3s ease'
        }} onClick={() => setToast(null)}>
          {toast.message}
        </div>
      )}

      {/* Confirmation Modal */}
      {modal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{modal.title}</h3>
            <p style={{ marginBottom: '1.5rem', color: '#555' }}>{modal.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={modal.onCancel}>Zrušit</button>
              <button className="btn btn-primary" onClick={modal.onConfirm}>Potvrdit</button>
            </div>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div style={{
        background: 'linear-gradient(135deg, #37474F, #263238)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        color: 'white',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <button
          className="btn"
          onClick={() => handleMonthChange(-1)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.4rem 0.75rem',
            fontSize: '0.85rem'
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, textTransform: 'uppercase', color: 'white', fontSize: '1.1rem', letterSpacing: '1px' }}>
          {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          className="btn"
          onClick={() => handleMonthChange(1)}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.4rem 0.75rem',
            fontSize: '0.85rem'
          }}
        >
          →
        </button>
      </div>

      {/* ABSENCE SUMMARY PANEL */}
      <section style={{ marginBottom: '2rem' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #7B1FA2, #512DA8)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: absencePanelOpen ? '12px 12px 0 0' : '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(123, 31, 162, 0.3)'
          }}
          onClick={() => setAbsencePanelOpen(!absencePanelOpen)}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
            🚫 Absence
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {absencesData.length > 0 && (
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px',
                fontSize: '0.8rem'
              }}>
                {absencesData.length}
              </span>
            )}
            <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
              {absencePanelOpen ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {absencePanelOpen && (
          <div style={{
            border: '1px solid #E1BEE7',
            borderTop: 'none',
            borderRadius: '0 0 12px 12px',
            overflow: 'hidden',
            background: 'white'
          }}>
            {absencesData.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9575CD' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                Žádné absence v tomto měsíci
              </div>
            ) : (
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {absencesData.map((absence, index) => {
                  const canDelete = absence.uid === currentUser.uid || userRoles.includes('Admin') || userRoles.includes('VJ');
                  const isMine = absence.uid === currentUser.uid;

                  // Determine absence status
                  const today = new Date();
                  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                  const isPast = absence.endDate < todayISO;
                  const isFuture = absence.startDate > todayISO;
                  const isActive = !isPast && !isFuture;

                  // Style based on status
                  let cardBg, cardBorder, cardOpacity, badgeBg, statusLabel;
                  if (isPast) {
                    cardBg = '#f5f5f5';
                    cardBorder = '1px solid #e0e0e0';
                    cardOpacity = 0.6;
                    badgeBg = 'linear-gradient(135deg, #9E9E9E, #757575)';
                    statusLabel = 'Proběhlo';
                  } else if (isFuture) {
                    cardBg = isMine ? '#E8EAF6' : '#FAFAFA';
                    cardBorder = isMine ? '2px dashed #7986CB' : '2px dashed #BDBDBD';
                    cardOpacity = 1;
                    badgeBg = 'linear-gradient(135deg, #5C6BC0, #3949AB)';
                    statusLabel = 'Naplánováno';
                  } else {
                    cardBg = isMine ? '#F3E5F5' : '#FAFAFA';
                    cardBorder = isMine ? '1px solid #CE93D8' : '1px solid #eee';
                    cardOpacity = 1;
                    badgeBg = 'linear-gradient(135deg, #9C27B0, #7B1FA2)';
                    statusLabel = null;
                  }

                  return (
                    <div
                      key={absence.id || index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 0.75rem',
                        background: cardBg,
                        borderRadius: '8px',
                        border: cardBorder,
                        opacity: cardOpacity,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      {/* Date badge */}
                      <div style={{
                        background: badgeBg,
                        color: 'white',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        minWidth: '55px',
                        textAlign: 'center'
                      }}>
                        {absence.startDate === absence.endDate
                          ? formatDateCZ(absence.startDate)
                          : `${formatDateCZ(absence.startDate)}-${formatDateCZ(absence.endDate)}`}
                      </div>

                      {/* Name & Reason */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isPast ? '#888' : '#333' }}>
                            {absence.userName}
                          </span>
                          {statusLabel && (
                            <span style={{
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              background: isPast ? '#EEEEEE' : '#E8EAF6',
                              color: isPast ? '#757575' : '#3949AB'
                            }}>
                              {statusLabel}
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: isPast ? '#aaa' : '#666',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {absence.reason}
                        </div>
                      </div>

                      {/* Delete button */}
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteAbsence(absence); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#E53935',
                            cursor: 'pointer',
                            fontSize: '1.1rem',
                            padding: '0.3rem',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.2s',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#FFEBEE'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Absence Button */}
            {userData?.approved && (
              <div style={{
                padding: '0.75rem',
                borderTop: '1px solid #F3E5F5',
                background: '#FAFAFA'
              }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setAbsenceModal({ mode: 'add' })}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                    border: 'none',
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  + Přidat mou absenci
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Add Absence Modal */}
      {absenceModal && (
        <AddAbsenceModal
          currentDate={currentDate}
          existingAbsences={absencesData.filter(a => a.uid === currentUser.uid)}
          onSubmit={handleAddAbsence}
          onClose={() => setAbsenceModal(null)}
          showToast={showToast}
        />
      )}

      {/* Add Zaloha Modal */}
      {zalohaModal && (
        <AddZalohaModal
          date={zalohaModal.date}
          onClose={() => setZalohaModal(null)}
          onSubmit={async (config) => {
            // Check if zaloha already exists
            if (enabledZalohaShifts.some(d => d.date === zalohaModal.date)) {
              showToast('warning', 'Záloha/Stáž pro tento den již existuje.');
              return;
            }

            try {
              const docRef = doc(db, 'shifts', currentDocId);
              await setDoc(docRef, {
                days: {
                  [zalohaModal.date]: {
                    zalohaStaz: {
                      config: {
                        ...config,
                        createdAt: new Date().toISOString()
                      }
                    }
                  }
                }
              }, { merge: true });
              logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'ADMIN_ADDED_SHIFT', 'admin',
                `Vytvořil zálohu/stáž pro den ${zalohaModal.date}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()} (${config.timeFrom}-${config.timeTo})`);
              showToast('success', `Záloha/Stáž vytvořena.`);
              setZalohaModal(null);
            } catch (err) {
              console.error("Error adding zaloha shift:", err);
              showToast('error', 'Chyba při vytváření zálohy/stáže.');
            }
          }}
        />
      )}

      {/* ZÁLOHA / STÁŽ SECTION */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1976D2, #0D47A1)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>🛡️ ZÁLOHA / STÁŽ</h3>
          <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {enabledZalohaShifts.length} služeb
          </span>
        </div>

        <div style={{ border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {enabledZalohaShifts.length > 0 && groupWeeks(enabledZalohaShifts).map((week, index) => {
            const firstDay = week[0];
            const lastDay = week[week.length - 1];
            const weekId = `zaloha-week-${index}`;
            const isCollapsed = collapsedWeeks[weekId];
            const weekLabel = `${firstDay.date}. – ${lastDay.date}. ${MONTHS_CZ[currentDate.getMonth()]}`;

            return (
              <div key={weekId} style={{ borderBottom: index < groupWeeks(enabledZalohaShifts).length - 1 ? '1px solid #eee' : 'none' }}>
                <div
                  onClick={() => toggleWeek(weekId)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: '#fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: '#555',
                    fontWeight: 600,
                    userSelect: 'none',
                    borderBottom: !isCollapsed ? '1px dashed #eee' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📅 <span style={{ color: '#333' }}>{weekLabel}</span>
                  </span>
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#888' }}>▼</span>
                </div>

                {!isCollapsed && week.map(day => {
                  const dayTrainings = trainingsData.filter(t => parseInt(t.date.split('-')[2]) === day.date);
                  const dayEvents = eventsData.filter(e => parseInt(e.date.split('-')[2]) === day.date);
                  const hasActivities = dayTrainings.length > 0 || dayEvents.length > 0;
                  const config = shiftsData[day.date]?.zalohaStaz?.config;

                  return (
                    <React.Fragment key={`zaloha-${day.date}`}>
                      {config && (
                        <div style={{ background: '#E3F2FD', padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#1565C0', fontWeight: 600, borderBottom: '1px solid #BBDEFB' }}>
                          ⏰ {config.timeFrom} – {config.timeTo}
                        </div>
                      )}
                      <ShiftRow
                        day={day}
                        sectionData={shiftsData[day.date]?.zalohaStaz || {}}
                        section="zalohaStaz"
                        onSlotClick={handleSlotClick}
                        onZalohaInterestedClick={handleZalohaInterestedClick}
                        currentUser={currentUser}
                        onRemoveZaloha={handleRemoveZaloha}
                        trainings={dayTrainings}
                        events={dayEvents}
                        isAdmin={userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r))}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}

          {/* Add Zaloha Form (Only for Admins) */}
          {userRoles.some(r => ['VD', 'VJ', 'Zástupce VJ', 'Admin'].includes(r)) && (
            <div style={{ padding: '1rem', background: '#E3F2FD', borderTop: '1px solid #eee', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 500, color: '#1565C0' }}>Přidat Záloha / Stáž:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setZalohaModal({ date: parseInt(e.target.value) });
                    e.target.value = "";
                  }
                }}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #90CAF9', minWidth: '180px' }}
              >
                <option value="">-- Vyberte den --</option>
                {days.filter(d => !enabledZalohaShifts.some(e => e.date === d.date)).map(day => (
                  <option key={`opt-z-${day.date}`} value={day.date}>
                    {day.date}. ({day.dayName})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* DAY SHIFTS SECTION */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, #FF9800, #F57C00)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>☀️ DENNÍ SLUŽBY</h3>
          <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {enabledDayShifts.length} služeb
          </span>
        </div>

        <div style={{ border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {enabledDayShifts.length > 0 && groupWeeks(enabledDayShifts).map((week, index) => {
            const firstDay = week[0];
            const lastDay = week[week.length - 1];
            const weekId = `day-week-${index}`;
            const isCollapsed = collapsedWeeks[weekId];
            const weekLabel = `${firstDay.date}. – ${lastDay.date}. ${MONTHS_CZ[currentDate.getMonth()]}`;

            return (
              <div key={weekId} style={{ borderBottom: index < groupWeeks(enabledDayShifts).length - 1 ? '1px solid #eee' : 'none' }}>
                <div
                  onClick={() => toggleWeek(weekId)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: '#fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: '#555',
                    fontWeight: 600,
                    userSelect: 'none',
                    borderBottom: !isCollapsed ? '1px dashed #eee' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📅 <span style={{ color: '#333' }}>{weekLabel}</span>
                  </span>
                  <span style={{
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    color: '#888'
                  }}>▼</span>
                </div>

                {!isCollapsed && week.map(day => {
                  const dayTrainings = trainingsData.filter(t => parseInt(t.date.split('-')[2]) === day.date);
                  const dayEvents = eventsData.filter(e => parseInt(e.date.split('-')[2]) === day.date);
                  const hasActivities = dayTrainings.length > 0 || dayEvents.length > 0;

                  return (
                    <React.Fragment key={`day-${day.date}`}>
                      <ShiftRow
                        day={day}
                        sectionData={shiftsData[day.date]?.dayShift || {}}
                        section="dayShift"
                        onSlotClick={handleSlotClick}
                        currentUser={currentUser}
                        onRemoveDayShift={handleRemoveDayShift}
                        trainings={dayTrainings}
                        events={dayEvents}
                        isAdmin={userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r))}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
          {enabledDayShifts.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
              Zatím nebyly vytvořeny žádné denní služby.
            </div>
          )}

          {/* Add Day Shift Form */}
          <div style={{
            padding: '1rem',
            background: '#FFF8E1',
            borderTop: '1px solid #eee',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <label style={{ fontWeight: 500, color: '#F57C00' }}>Přidat denní službu:</label>
            <select
              value={newDayShiftDate}
              onChange={(e) => setNewDayShiftDate(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #FFCC80',
                minWidth: '180px'
              }}
            >
              <option value="">-- Vyberte den --</option>
              {days.filter(d => !enabledDayShifts.some(e => e.date === d.date)).map(day => (
                <option key={day.date} value={day.date}>
                  {day.date}. ({day.dayName})
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={handleAddDayShift}
              style={{ padding: '0.5rem 1rem' }}
            >
              + Přidat
            </button>
          </div>
        </div>
      </section>

      {/* NIGHT SHIFTS SECTION */}
      <section>
        <div style={{
          background: 'linear-gradient(135deg, #37474F, #263238)',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>🌙 NOČNÍ SLUŽBY</h3>
          <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{days.length} dnů</span>
        </div>

        <div style={{ border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {groupWeeks(days).map((week, index) => {
            const firstDay = week[0];
            const lastDay = week[week.length - 1];
            const weekId = `night-week-${index}`;
            const isCollapsed = collapsedWeeks[weekId];
            const weekLabel = `${firstDay.date}. – ${lastDay.date}. ${MONTHS_CZ[currentDate.getMonth()]}`;

            return (
              <div key={weekId} style={{ borderBottom: index < groupWeeks(days).length - 1 ? '1px solid #eee' : 'none' }}>
                <div
                  onClick={() => toggleWeek(weekId)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: '#fafafa',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: '#555',
                    fontWeight: 600,
                    userSelect: 'none',
                    borderBottom: !isCollapsed ? '1px dashed #eee' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🌙 <span style={{ color: '#333' }}>{weekLabel}</span>
                  </span>
                  <span style={{
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    color: '#888'
                  }}>▼</span>
                </div>

                {!isCollapsed && week.map((day, dIndex) => {
                  const dayTrainings = trainingsData.filter(t => parseInt(t.date.split('-')[2]) === day.date);
                  const dayEvents = eventsData.filter(e => parseInt(e.date.split('-')[2]) === day.date);
                  const hasActivities = dayTrainings.length > 0 || dayEvents.length > 0;

                  return (
                    <React.Fragment key={`night-${day.date}`}>
                      <ShiftRow
                        day={day}
                        sectionData={shiftsData[day.date]?.nightShift || {}}
                        section="nightShift"
                        onSlotClick={handleSlotClick}
                        currentUser={currentUser}
                        trainings={dayTrainings}
                        events={dayEvents}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      {/* Activity Popup (Option B) */}
      {activityPopup && (
        <ActivityPopup
          day={activityPopup.day}
          trainingsData={trainingsData}
          eventsData={eventsData}
          currentUser={currentUser}
          userData={userData}
          onClose={() => setActivityPopup(null)}
          showToast={showToast}
        />
      )}

      {/* Zaloha Assign Modal */}
      {zalohaAssignModal && (() => {
          const { day, section } = zalohaAssignModal;
          const sectionData = shiftsData[day]?.[section] || {};
          const assignedUids = Object.keys(sectionData)
            .filter(k => k !== 'config' && k !== 'interested')
            .map(k => sectionData[k]?.uid)
            .filter(Boolean);
            
          const interestedPool = (sectionData.interested || []).filter(u => !assignedUids.includes(u.uid));

          return (
            <div className="modal-overlay" onClick={() => setZalohaAssignModal(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <div className="modal-header">
                  <h3 className="modal-title">Přiřadit uživatele</h3>
                  <button className="modal-close" onClick={() => setZalohaAssignModal(null)}>✕</button>
                </div>
                <div className="modal-body">
                  <p style={{ marginBottom: '1rem', color: '#555' }}>Vyberte zájemce pro obsazení této pozice:</p>
                  
                  {interestedPool.length === 0 ? (
                    <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', color: '#888' }}>
                      Žádní volní zájemci v tuto chvíli.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {interestedPool.map(user => (
                        <button
                          key={user.uid}
                          onClick={() => handleZalohaAssignUser(user)}
                          style={{
                            padding: '0.75rem',
                            background: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '8px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#1976D2'; e.currentTarget.style.background = '#F5F9FF'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white'; }}
                        >
                          <span style={{ fontWeight: 600, color: '#333' }}>{user.name}</span>
                          <span style={{ fontSize: '1.2rem' }}>+</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
      })()}
    </div>
  );
}

// Activity Popup Component (Option B - Integrated Day Markers)
function ActivityPopup({ day, trainingsData, eventsData, currentUser, userData, onClose, showToast }) {
  const navigate = useNavigate();

  // Compute activities from real-time data (not stale snapshot)
  const activities = [
    ...(trainingsData || [])
      .filter(t => parseInt(t.date?.split('-')[2]) === day.date)
      .map(t => ({ ...t, type: 'training' })),
    ...(eventsData || [])
      .filter(e => parseInt(e.date?.split('-')[2]) === day.date)
      .map(e => ({ ...e, type: 'event' }))
  ];

  const handleJoin = async (activity) => {
    if (!currentUser || !userData) return;

    // Check capacity
    if (activity.maxParticipants && (activity.participants?.length || 0) >= parseInt(activity.maxParticipants)) {
      showToast('error', 'Kapacita je naplněna.');
      return;
    }

    const collectionName = activity.type === 'training' ? 'trainings' : 'events';

    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayUnion({
          uid: currentUser.uid,
          name: `${userData.firstName} ${userData.lastName}`,
          joinedAt: new Date().toISOString()
        })
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akci';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'JOINED_TRAINING' : 'JOINED_EVENT', 'activities',
        `Přihlásil se na ${typeLabel} „${activity.title}“ (${activity.date}) – ze stránky Směn`);
      showToast('success', 'Přihlášeno!');
    } catch (err) {
      console.error('Error joining:', err);
      showToast('error', 'Chyba při přihlašování.');
    }
  };

  const handleLeave = async (activity) => {
    const myParticipation = activity.participants?.find(p => p.uid === currentUser?.uid);
    if (!myParticipation) return;

    const collectionName = activity.type === 'training' ? 'trainings' : 'events';

    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayRemove(myParticipation)
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akce';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'LEFT_TRAINING' : 'LEFT_EVENT', 'activities',
        `Odhlásil se ze ${typeLabel} „${activity.title}“ (${activity.date}) – ze stránky Směn`);
      showToast('success', 'Odhlášeno.');
    } catch (err) {
      console.error('Error leaving:', err);
      showToast('error', 'Chyba při odhlašování.');
    }
  };

  const formatDate = () => {
    const MONTHS = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
    return `${day.date}. ${MONTHS[new Date().getMonth()]}`;
  };

  return (
    <div className="activity-popup-overlay" onClick={onClose}>
      <div className="activity-popup" onClick={e => e.stopPropagation()}>
        <div className="activity-popup__header">
          <span className="activity-popup__date">📅 {formatDate()}</span>
          <button className="activity-popup__close" onClick={onClose}>✕</button>
        </div>

        <div className="activity-popup__content">
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
              Žádné aktivity
            </div>
          ) : (
            activities.map(activity => {
              const isJoined = activity.participants?.some(p => p.uid === currentUser?.uid);
              const isTraining = activity.type === 'training';
              const count = activity.participants?.length || 0;

              return (
                <div
                  key={activity.id}
                  className={`activity-item ${isTraining ? 'activity-item--training' : 'activity-item--event'}`}
                >
                  <div className={`activity-item__type ${isTraining ? 'activity-item__type--training' : 'activity-item__type--event'}`}>
                    {isTraining ? '📚 Školení' : '🚩 Akce'}
                  </div>

                  <div className="activity-item__title">
                    <span>{activity.title}</span>
                    {isJoined && <span className="activity-item__joined-badge">✓ Přihlášen</span>}
                  </div>

                  <div className="activity-item__meta">
                    <span>⏰ {activity.time}{activity.timeEnd ? ` – ${activity.timeEnd}` : ''}</span>
                    {activity.location && <span>📍 {activity.location}</span>}
                  </div>

                  <div className="activity-item__participants">
                    👥 {count}{activity.maxParticipants ? `/${activity.maxParticipants}` : ''} {count === 1 ? 'účastník' : (count >= 2 && count <= 4) ? 'účastníci' : 'účastníků'}
                  </div>

                  <div className="activity-item__actions">
                    {isJoined ? (
                      <button
                        className="activity-item__btn activity-item__btn--leave"
                        onClick={() => handleLeave(activity)}
                      >
                        Odhlásit
                      </button>
                    ) : (activity.maxParticipants && count >= parseInt(activity.maxParticipants)) ? (
                      <button
                        className="activity-item__btn"
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed', background: '#e0e0e0', color: '#757575', borderColor: '#d0d0d0' }}
                      >
                        Plno
                      </button>
                    ) : (
                      <button
                        className="activity-item__btn activity-item__btn--join"
                        onClick={() => handleJoin(activity)}
                      >
                        Přihlásit
                      </button>
                    )}
                    <button
                      className="activity-item__btn activity-item__btn--view"
                      onClick={() => {
                        onClose();
                        navigate(isTraining ? '/skoleni' : '/akce');
                      }}
                    >
                      Detail
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// Inline Activities Component (Option 3 - Expandable Cards)
function InlineActivities({ trainings, events, currentUser, userData, showToast }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false); // Start collapsed as requested

  const activities = [
    ...(trainings || []).map(t => ({ ...t, type: 'training' })),
    ...(events || []).map(e => ({ ...e, type: 'event' }))
  ];

  const handleJoin = async (activity) => {
    if (!currentUser || !userData) return;

    // Check capacity
    if (activity.maxParticipants && (activity.participants?.length || 0) >= parseInt(activity.maxParticipants)) {
      showToast('error', 'Kapacita je naplněna.');
      return;
    }

    const collectionName = activity.type === 'training' ? 'trainings' : 'events';

    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayUnion({
          uid: currentUser.uid,
          name: `${userData.firstName} ${userData.lastName}`,
          joinedAt: new Date().toISOString()
        })
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akci';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'JOINED_TRAINING' : 'JOINED_EVENT', 'activities',
        `Přihlásil se na ${typeLabel} „${activity.title}“ (${activity.date}) – ze stránky Směn`);
      showToast('success', 'Přihlášeno!');
    } catch (err) {
      console.error('Error joining:', err);
      showToast('error', 'Chyba při přihlášování.');
    }
  };

  const handleLeave = async (activity) => {
    const myParticipation = activity.participants?.find(p => p.uid === currentUser?.uid);
    if (!myParticipation) return;
    const collectionName = activity.type === 'training' ? 'trainings' : 'events';

    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayRemove(myParticipation)
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akce';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'LEFT_TRAINING' : 'LEFT_EVENT', 'activities',
        `Odhlásil se ze ${typeLabel} „${activity.title}“ (${activity.date}) – ze stránky Směn`);
      showToast('success', 'Odhlášeno.');
    } catch (err) {
      console.error('Error leaving:', err);
      showToast('error', 'Chyba při odhlašování.');
    }
  };

  const trainingCount = trainings?.length || 0;
  const eventCount = events?.length || 0;

  return (
    <div className="inline-activities">
      <div className="inline-activities__header" onClick={() => setExpanded(!expanded)}>
        <div className="inline-activities__title">
          {trainingCount > 0 && (
            <span className="inline-activities__badge inline-activities__badge--training">
              📚 {trainingCount} školení
            </span>
          )}
          {eventCount > 0 && (
            <span className="inline-activities__badge inline-activities__badge--event">
              🚩 {eventCount} akce
            </span>
          )}
        </div>
        <span className={`inline-activities__toggle ${expanded ? 'inline-activities__toggle--open' : ''}`}>
          ▼
        </span>
      </div>

      {expanded && (
        <div className="inline-activities__content">
          {activities.map(activity => {
            const isJoined = activity.participants?.some(p => p.uid === currentUser?.uid);
            const isTraining = activity.type === 'training';

            return (
              <div
                key={activity.id}
                className={`inline-activity-card ${isTraining ? 'inline-activity-card--training' : 'inline-activity-card--event'}`}
              >
                <div className="inline-activity-card__info">
                  <div className={`inline-activity-card__type ${isTraining ? 'inline-activity-card__type--training' : 'inline-activity-card__type--event'}`}>
                    {isTraining ? 'Školení' : 'Akce'}
                  </div>
                  <div className="inline-activity-card__title">{activity.title}</div>
                  <div className="inline-activity-card__meta">
                    ⏰ {activity.time}{activity.timeEnd ? ` – ${activity.timeEnd}` : ''}
                    {activity.location && ` • 📍 ${activity.location}`}
                  </div>
                </div>

                <div className="inline-activity-card__actions">
                  {isJoined ? (
                    <button
                      className="inline-activity-card__btn inline-activity-card__btn--leave"
                      onClick={() => handleLeave(activity)}
                    >
                      Odhlásit
                    </button>
                  ) : (activity.maxParticipants && (activity.participants?.length || 0) >= parseInt(activity.maxParticipants)) ? (
                    <button
                      className="inline-activity-card__btn"
                      disabled
                      style={{ opacity: 0.6, cursor: 'not-allowed', background: '#e0e0e0', color: '#757575', borderColor: '#d0d0d0' }}
                    >
                      Plno
                    </button>
                  ) : (
                    <button
                      className="inline-activity-card__btn inline-activity-card__btn--join"
                      onClick={() => handleJoin(activity)}
                    >
                      Přihlásit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Single Row Component
// Slot Icons Mapping
const SLOT_ICONS = {
  'velitel': '⭐',
  'strojnik': '🚒',
  'hasic-1': '🧯',
  'hasic-2': '🧯',
  'hasic-3': '🧯',
  'hasic-4': '🧯',
  'hasic1': '🧯',
  'hasic2': '🧯',
  'hasic3': '🧯',
  'hasic4': '🧯',
  'hasic5': '🧯',
};

// Single Row Component
function ShiftRow({ day, sectionData, section, onSlotClick, onZalohaInterestedClick, currentUser, onRemoveDayShift, onRemoveZaloha, trainings, events, onActivityClick, isAdmin }) {
  const navigate = useNavigate();
  // Check if shift is empty (no users assigned)
  const isEmpty = section === 'zalohaStaz'
    ? Object.keys(sectionData || {}).filter(k => k !== 'config' && k !== 'interested').length === 0
    : !sectionData || Object.keys(sectionData).length === 0;
  
  const canRemove = (section === 'dayShift' && onRemoveDayShift && (isEmpty || isAdmin)) || (section === 'zalohaStaz' && onRemoveZaloha && (isEmpty || isAdmin));

  // Dynamic Slot Visibility Logic
  let visibleSlots = [];
  if (section === 'zalohaStaz' && sectionData.config) {
    const { velitelCount = 1, strojnikCount = 1, hasicCount = 2 } = sectionData.config;
    for (let i = 1; i <= velitelCount; i++) visibleSlots.push(i === 1 ? 'velitel' : `velitel${i}`);
    for (let i = 1; i <= strojnikCount; i++) visibleSlots.push(i === 1 ? 'strojnik' : `strojnik${i}`);
    for (let i = 1; i <= hasicCount; i++) visibleSlots.push(`hasic${i}`);
  } else {
    visibleSlots = SLOT_TYPES.filter(type => {
    // Always show core slots
    if (['velitel', 'strojnik', 'hasic1', 'hasic2', 'hasic3'].includes(type)) return true;

    // Check occupancy of previous slots for dynamic ones
    const h1Off = !!sectionData['hasic1'];
    const h2Off = !!sectionData['hasic2'];
    const h3Off = !!sectionData['hasic3'];
    const h4Off = !!sectionData['hasic4'];

    // Show Hasič 4 if 1, 2, AND 3 are full (or if 4 is already taken)
    if (type === 'hasic4') return (h1Off && h2Off && h3Off) || h4Off;

    // Show Hasič 5 if 4 is full (or if 5 is already taken)
    if (type === 'hasic5') return h4Off || !!sectionData['hasic5'];

    return false;
  });
  }

  // Zajemci logic for zalohaStaz
  const assignedUids = Object.keys(sectionData || {})
    .filter(k => k !== 'config' && k !== 'interested')
    .map(k => sectionData[k]?.uid)
    .filter(Boolean);

  const interestedPool = (sectionData?.interested || []).filter(u => !assignedUids.includes(u.uid));
  const isCurrentlyInterested = (sectionData?.interested || []).some(u => u.uid === currentUser?.uid);
  const isAssignedToThis = assignedUids.includes(currentUser?.uid);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      background: 'white',
      margin: '0.35rem 0.25rem', // Reduced margin
      borderRadius: '8px',
      border: day.isToday ? '2px solid #FFD54F' : '1px solid #e0e0e0',
      boxShadow: day.isToday ? '0 4px 12px rgba(255, 193, 7, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)', // Reduced shadow
      transition: 'transform 0.2s, box-shadow 0.2s',
      overflow: 'hidden',
      position: 'relative'
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = day.isToday ? '0 4px 12px rgba(255, 193, 7, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)'; }}
    >
      {/* Date Column */}
      <div style={{
        width: '75px', // Slightly narrower
        minWidth: '75px',
        padding: '0.25rem', // Much smaller padding
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: day.isToday ? 'linear-gradient(135deg, #FFF8E1, #FFECB3)' : (day.isWeekend ? '#fafafa' : 'white'),
        color: day.isToday ? '#FF6F00' : (day.isWeekend ? '#757575' : '#333'),
        position: 'relative'
      }}>
        <div style={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1 }}>{day.date}.</div>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px', opacity: 0.8 }}>
          {day.dayName.slice(0, 3)}
        </div>

        {canRemove && (
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              if (section === 'dayShift') onRemoveDayShift(day.date);
              else if (section === 'zalohaStaz') onRemoveZaloha(day.date);
            }}
            title="Odebrat prázdnou službu"
            style={{
              position: 'absolute',
              top: '2px', // Compact pos
              right: '2px',
              width: '18px', // Smaller button
              height: '18px',
              border: 'none',
              background: 'rgba(239, 83, 80, 0.1)',
              color: '#e53935',
              borderRadius: '50%',
              fontSize: '1rem',
              lineHeight: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 0 1px 0',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e53935'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 83, 80, 0.1)'; e.currentTarget.style.color = '#e53935'; }}
          >
            ×
          </button>
        )}
      </div>

      {/* Slots */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem', // Tighter gap
        padding: '0.35rem', // Tighter padding
        alignItems: 'center'
      }}>
        {visibleSlots.map(slotKey => {
          const assignee = sectionData[slotKey];
          const isSelf = assignee?.uid === currentUser?.uid;

          return (
            <SlotChip
              key={slotKey}
              slotKey={slotKey}
              label={SLOT_LABELS[slotKey]}
              assignee={assignee}
              isSelf={isSelf}
              onClick={() => onSlotClick(day.date, section, slotKey)}
            />
          );
        })}
        
        {/* ZAjemci Pool rendering */}
        {section === 'zalohaStaz' && (
          <div style={{ width: '100%', marginTop: '0.5rem', borderTop: '1px dashed #e0e0e0', paddingTop: '0.5rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                onClick={() => onZalohaInterestedClick(day.date)}
                style={{
                  background: isCurrentlyInterested || isAssignedToThis ? '#FFEBEE' : '#E3F2FD',
                  color: isCurrentlyInterested || isAssignedToThis ? '#D32F2F' : '#1565C0',
                  border: isCurrentlyInterested || isAssignedToThis ? '1px solid #FFCDD2' : '1px solid #BBDEFB',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
              >
                  {isCurrentlyInterested || isAssignedToThis ? '✕ Zrušit zájem' : '✋ Mám zájem'}
              </button>
              
              {interestedPool.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777', marginRight: '0.25rem' }}>Zájemci:</span>
                  {interestedPool.map(u => (
                    <span key={u.uid} style={{
                      background: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem'
                    }}>
                      {u.name}
                    </span>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// Slot Chip Component - Redesigned
function SlotChip({ slotKey, label, assignee, isSelf, onClick }) {
  // Determine styles based on state
  const isUnqualified = assignee && assignee.qualified === false;
  const isOccupied = !!assignee;

  let bg = 'white';
  let border = '1px dashed #ddd';
  let color = '#999';
  let shadow = 'none';

  if (isOccupied) {
    border = '1px solid transparent';
    shadow = '0 1px 2px rgba(0,0,0,0.05)'; // Reduced shadow
    if (isSelf) {
      bg = isUnqualified ? '#FFF3E0' : '#E8F5E9';
      border = isUnqualified ? '1px solid #FFE0B2' : '1px solid #C8E6C9';
      color = isUnqualified ? '#EF6C00' : '#2E7D32';
    } else {
      bg = isUnqualified ? '#FFF8E1' : 'linear-gradient(to bottom, #f5f5f5, #eeeeee)';
      border = isUnqualified ? '1px solid #FFCC80' : '1px solid #e0e0e0';
      color = isUnqualified ? '#F57C00' : '#424242';
    }
  }

  // Icon logic
  const icon = SLOT_ICONS[slotKey] || '👤';

  return (
    <div
      onClick={onClick}
      style={{
        background: bg,
        border: border,
        borderRadius: '6px', // Slightly smaller radius
        padding: '0.3rem 0.5rem', // COMPACT PADDING
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem', // Tighter gap
        transition: 'all 0.2s ease',
        minWidth: '110px', // Smaller min width
        maxWidth: '160px',
        flex: '1 1 auto',
        boxShadow: shadow,
        position: 'relative',
        opacity: isOccupied ? 1 : 0.8
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        if (!isOccupied) e.currentTarget.style.borderColor = '#bbb';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = shadow;
        if (!isOccupied) e.currentTarget.style.borderColor = '#ddd';
      }}
    >
      {/* Icon Circle */}
      <div style={{
        width: '26px', height: '26px', // Smaller Icon
        borderRadius: '50%',
        background: isOccupied ? 'white' : '#f5f5f5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.9rem', // Smaller Emoji
        boxShadow: isOccupied ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
        flexShrink: 0
      }}>
        {isOccupied && assignee.name ? (
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#555' }}>
            {icon}
          </span>
        ) : (
          <span style={{ opacity: 0.5 }}>{icon}</span>
        )}
      </div>

      {/* Text Info */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', lineHeight: 1.1 }}>
        <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: '#888', fontWeight: 600, letterSpacing: '0.5px' }}>
          {SLOT_LABELS[slotKey]}
        </span>
        <span style={{
          fontSize: '0.85rem', // Smaller name
          fontWeight: isOccupied ? 700 : 500,
          color: color,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {isOccupied ? assignee.name : 'Volno'}
        </span>
      </div>

      {/* Add Indicator for empty */}
      {!isOccupied && (
        <div style={{ fontSize: '0.9rem', color: '#ccc', fontWeight: 300 }}>+</div>
      )}
    </div>
  );
}

// Add Absence Modal Component - Mobile Friendly with native date inputs
function AddAbsenceModal({ currentDate, existingAbsences = [], onSubmit, onClose, showToast }) {
  // Default to today's date in ISO format
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(todayISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // Check for overlap with existing absences (now using ISO strings)
  const checkOverlap = (start, end) => {
    for (const absence of existingAbsences) {
      // Check if date ranges overlap (ISO strings compare correctly)
      if (start <= absence.endDate && end >= absence.startDate) {
        return absence;
      }
    }
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate || !reason.trim()) {
      setError('Vyplňte všechna pole.');
      return;
    }

    if (endDate < startDate) {
      setError('Datum "do" musí být po datu "od".');
      return;
    }

    // Check for overlapping absence
    const overlap = checkOverlap(startDate, endDate);
    if (overlap) {
      setError(`Již máte absenci v tomto období (${formatDateCZ(overlap.startDate)}-${formatDateCZ(overlap.endDate)}: ${overlap.reason})`);
      return;
    }

    onSubmit({
      startDate,
      endDate,
      reason: reason.trim()
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: '1rem'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '1.25rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Handle bar */}
        <div style={{
          width: '40px',
          height: '4px',
          background: '#ddd',
          borderRadius: '2px',
          margin: '0 auto 1rem'
        }} />

        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: '#7B1FA2', textAlign: 'center' }}>
          🚫 Přidat absenci
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Date Selection - Side by side with native date inputs */}
          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#7B1FA2', fontSize: '0.85rem' }}>
                Od
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setError('');
                  if (!endDate || e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.5rem',
                  borderRadius: '8px',
                  border: '2px solid #E1BEE7',
                  fontSize: '1rem',
                  background: '#FAFAFA',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              paddingBottom: '0.75rem',
              color: '#999',
              fontWeight: 500
            }}>
              →
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#7B1FA2', fontSize: '0.85rem' }}>
                Do
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); setError(''); }}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.5rem',
                  borderRadius: '8px',
                  border: '2px solid #E1BEE7',
                  fontSize: '1rem',
                  background: '#FAFAFA',
                  boxSizing: 'border-box'
                }}
                required
              />
            </div>
          </div>

          {/* Reason Input */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, color: '#7B1FA2', fontSize: '0.85rem' }}>
              Důvod
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              placeholder="např. Dovolená, Nemoc, Školení..."
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '2px solid #E1BEE7',
                fontSize: '1rem',
                boxSizing: 'border-box',
                background: '#FAFAFA'
              }}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#FFEBEE',
              border: '1px solid #FFCDD2',
              borderRadius: '8px',
              color: '#C62828',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '10px',
                border: '2px solid #E1BEE7',
                background: 'white',
                color: '#7B1FA2',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Zrušit
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '0.85rem',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                color: 'white',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(123, 31, 162, 0.3)'
              }}
            >
              Uložit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddZalohaModal({ date, onClose, onSubmit }) {
  const [timeFrom, setTimeFrom] = useState('07:00');
  const [timeTo, setTimeTo] = useState('19:00');
  const [velitelCount, setVelitelCount] = useState(1);
  const [strojnikCount, setStrojnikCount] = useState(1);
  const [hasicCount, setHasicCount] = useState(2);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      timeFrom,
      timeTo,
      velitelCount,
      strojnikCount,
      hasicCount
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '1.5rem', borderRadius: '12px', background: 'white' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1565C0', textAlign: 'center' }}>
          🛡️ Záloha / Stáž ({date}.)
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Čas OD:</label>
              <input 
                type="time" 
                value={timeFrom} 
                onChange={e => setTimeFrom(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #BBDEFB', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Čas DO:</label>
              <input 
                type="time" 
                value={timeTo} 
                onChange={e => setTimeTo(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #BBDEFB', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Velitel (1-2)</label>
               <input type="number" min="1" max="2" value={velitelCount} onChange={e => setVelitelCount(parseInt(e.target.value)||1)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Strojník (1-2)</label>
               <input type="number" min="1" max="2" value={strojnikCount} onChange={e => setStrojnikCount(parseInt(e.target.value)||1)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Hasič (2-5)</label>
               <input type="number" min="2" max="5" value={hasicCount} onChange={e => setHasicCount(parseInt(e.target.value)||2)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: '2px solid #BBDEFB', background: 'white', color: '#1565C0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>Zrušit</button>
            <button type="submit" style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #1976D2, #1565C0)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)' }}>Vytvořit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
