import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  doc,
  setDoc,
  onSnapshot,
  deleteField,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection
} from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { DAYS_CZ, MONTHS_CZ, SLOT_TYPES, getSlotBaseType } from '../components/shifts/constants';

export default function useShiftCalendar(currentUser, userData) {
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

  // Absence state
  const [absencesData, setAbsencesData] = useState([]); // Array of { id, uid, userName, startDate, endDate, reason }
  const [absenceModal, setAbsenceModal] = useState(null); // { mode: 'add'|'edit', absence?: object }
  const [absencePanelOpen, setAbsencePanelOpen] = useState(false);

  // Trainings state
  const [trainingsData, setTrainingsData] = useState([]);

  // Events state
  const [eventsData, setEventsData] = useState([]);

  // Activity popup state (for Option B - indicator dots)
  const [activityPopup, setActivityPopup] = useState(null); // { day } - only stores the day, activities derived from live data
  const [collapsedWeeks, setCollapsedWeeks] = useState({}); // { 'd-0': true, 'n-1': false }
  const [zalohaAssignModal, setZalohaAssignModal] = useState(null); // { day, slotKey, section }

  const [zalohaSectionOpen, setZalohaSectionOpen] = useState(false);
  const [daySectionOpen, setDaySectionOpen] = useState(false);
  const [nightSectionOpen, setNightSectionOpen] = useState(true);
  const sectionsInitialized = useRef(false);

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

  // 1. Subscribe to Shifts
  useEffect(() => {
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

  // 2. Subscribe to Absences (global collection) and filter for current month view
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

  // 3. Subscribe to Trainings
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'trainings'), (snapshot) => {
      const allTrainings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${year}-${month}`;

      const currentMonthTrainings = allTrainings.filter(t => t.date && t.date.startsWith(monthPrefix));
      setTrainingsData(currentMonthTrainings);
    });
    return unsubscribe;
  }, [currentDate]);

  // 4. Subscribe to Events
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthPrefix = `${year}-${month}`;

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

  const enabledDayShifts = days.filter(day => {
    const dayData = shiftsData[day.date];
    return dayData && (dayData.dayShiftEnabled || (dayData.dayShift && Object.keys(dayData.dayShift).length > 0));
  });

  const enabledZalohaShifts = days.filter(day => {
    const dayData = shiftsData[day.date];
    return dayData && dayData.zalohaStaz;
  });

  useEffect(() => {
    if (!loading && !sectionsInitialized.current) {
      sectionsInitialized.current = true;
      if (enabledDayShifts.length > 0) setDaySectionOpen(true);
      if (enabledZalohaShifts.length > 0) setZalohaSectionOpen(true);
    }
  }, [loading, enabledDayShifts.length, enabledZalohaShifts.length]);

  const handleMonthChange = (offset) => {
    setLoading(true);
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
    setNewDayShiftDate('');
    sectionsInitialized.current = false;
    setDaySectionOpen(false);
    setZalohaSectionOpen(false);
  };

  const isQualifiedFor = (slotType) => {
    const base = getSlotBaseType(slotType);
    if (base === 'velitel') return userRoles.some(r => ['VD', 'VJ', 'Zástupce VJ', 'Admin'].includes(r));
    if (base === 'strojnik') return userRoles.some(r => ['Strojník', 'Admin'].includes(r));
    return true; // Everyone is qualified for Hasič
  };

  const handleSlotClick = async (day, section, slotKey, joinParams = {}) => {
    if (!userData || !userData.approved) return;

    const dayData = shiftsData[day] || { dayShift: {}, nightShift: {} };
    const sectionData = dayData[section] || {};
    const currentAssignee = sectionData[slotKey];

    const userCompact = {
      uid: currentUser.uid,
      name: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''}`,
      qualified: isQualifiedFor(slotKey),
      ...(joinParams.fromHome ? { fromHome: true } : {}),
      ...(joinParams.timeFrom ? { timeFrom: joinParams.timeFrom, timeTo: joinParams.timeTo } : {})
    };

    let newData = { ...dayData };
    if (!newData[section]) newData[section] = {};

    const cleanupHours = (targetUid) => {
      if (!newData.hours) newData.hours = {};

      const checkPresence = (shiftType) => {
        const slots = newData[shiftType] || {};
        return Object.values(slots).some(u => u && u.uid === targetUid);
      };

      const inDay = checkPresence('dayShift');
      const inNight = checkPresence('nightShift');

      const wipeDay = (section === 'dayShift') || !inDay;
      const wipeNight = (section === 'nightShift') || !inNight;

      if (wipeDay && wipeNight) {
        newData.hours[targetUid] = deleteField();
      } else {
        const patch = {};
        if (wipeDay) patch.day = deleteField();
        if (wipeNight) patch.night = deleteField();
        newData.hours[targetUid] = patch;
      }
    };

    if (section === 'zalohaStaz') {
      const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r));
      
      if (!isAdmin) {
        showToast('error', 'Na pozice u Stáže/Zálohy může přiřazovat pouze velitel. Použijte tlačítko "Mám zájem".');
        return;
      }

      if (currentAssignee) {
        const confirmed = await showConfirm('Uvolnit pozici', `Chcete odebrat uživatele ${currentAssignee.name} z této pozice? (Zůstane v seznamu zájemců)`);
        if (!confirmed) return;
        newData[section] = { ...newData[section], [slotKey]: deleteField() };
      } else {
        setZalohaAssignModal({ day, slotKey, section });
        return;
      }
    } else {
      if (currentAssignee && currentAssignee.uid === currentUser.uid) {
        const confirmed = await showConfirm('Zrušit službu', 'Opravdu chcete zrušit svou službu?');
        if (!confirmed) return;
        newData[section] = { ...newData[section], [slotKey]: deleteField() };
        cleanupHours(currentUser.uid);
      } else if (currentAssignee) {
        const currentUserIsQualified = isQualifiedFor(slotKey);
        const existingIsUnqualified = currentAssignee.qualified === false;

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
      } else {
        const existingUserSlot = SLOT_TYPES.find(s => sectionData[s]?.uid === currentUser.uid);
        if (existingUserSlot) {
          showToast('warning', `Již máte službu na této směně (${existingUserSlot}). Nejprve se odhlaste.`);
          return;
        }

        if (getSlotBaseType(slotKey) === 'strojnik' && !isQualifiedFor(slotKey)) {
          showToast('error', 'Pro pozici Strojník musíte mít příslušnou kvalifikaci.');
          return;
        }

        if (getSlotBaseType(slotKey) === 'velitel' && !isQualifiedFor(slotKey)) {
          const proceed = await showConfirm(
            '⚠️ Chybí kvalifikace',
            'Nemáte kvalifikaci pro Velitele. Budete označeni žlutě a kvalifikovaný VD vás může nahradit. Pokračovat?'
          );
          if (!proceed) return;
          userCompact.qualified = false;
        }

        newData[section][slotKey] = userCompact;
        cleanupHours(currentUser.uid);
      }
    }

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, { days: { [day]: newData } }, { merge: true });

      const shiftLabel = section === 'dayShift' ? 'denní' : section === 'nightShift' ? 'noční' : 'záloha/stáž';
      const slotLabel = slotKey;
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
      const confirmed = await showConfirm('Zrušit zájem', 'Opravdu chcete zrušit svůj zájem o tuto Stáž/Zálohu? Budete odebráni i z případné přiřazené pozice.');
      if (!confirmed) return;
      newInterested = interested.filter(u => u.uid !== currentUser.uid);
      
      const slots = Object.keys(newData.zalohaStaz).filter(k => k !== 'config' && k !== 'interested');
      for (const s of slots) {
        if (newData.zalohaStaz[s] && newData.zalohaStaz[s].uid === currentUser.uid) {
          newData.zalohaStaz[s] = deleteField();
        }
      }
    } else {
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
      
      const dateLabel = `${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      if (isInterested) {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'CANCELLED_INTEREST_IN_STAZ', 'shifts',
          `Zrušil zájem o stáž/zálohu dne ${dateLabel}`);
      } else {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'INTERESTED_IN_STAZ', 'shifts',
          `Projevil zájem o stáž/zálohu dne ${dateLabel}`);
      }
      
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
        `Přiřadil ${targetUser.name} na pozici ${slotKey} – stáž ${dateLabel}`);
          
      showToast('success', 'Uživatel přiřazen na pozici.');
      setZalohaAssignModal(null);
    } catch (err) {
      console.error("Error updating shift:", err);
      showToast('error', 'Chyba při ukládání služby.');
    }
  };

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

  const handleAddAbsence = async (absenceData) => {
    if (!userData || !userData.approved) return;

    const targetUser = absenceData.targetUser;
    const uid = targetUser?.uid || currentUser.uid;
    const userName = targetUser?.compactName || `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''}`;

    const newAbsence = {
      id: `${uid}-${Date.now()}`,
      uid,
      userName,
      startDate: absenceData.startDate,
      endDate: absenceData.endDate,
      reason: absenceData.reason
    };

    try {
      const absenceDocRef = doc(db, 'absences', 'global');
      await setDoc(absenceDocRef, {
        items: arrayUnion(newAbsence)
      }, { merge: true });
      const detail = targetUser
        ? `Přidal absenci za ${userName}: "${absenceData.reason}" (${absenceData.startDate} – ${absenceData.endDate})`
        : `Přidal absenci: "${absenceData.reason}" (${absenceData.startDate} – ${absenceData.endDate})`;
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADDED_ABSENCE', 'shifts', detail);
      showToast('success', 'Absence uložena.');
      setAbsenceModal(null);
    } catch (err) {
      console.error("Error adding absence:", err);
      showToast('error', 'Chyba při ukládání absence.');
    }
  };

  const handleDeleteAbsence = async (absence) => {
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

  const handleAddZaloha = async (config) => {
    if (!zalohaModal) return;
    const dateNum = zalohaModal.date;

    if (enabledZalohaShifts.some(d => d.date === dateNum)) {
      showToast('warning', 'Záloha/Stáž pro tento den již existuje.');
      return;
    }

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, {
        days: {
          [dateNum]: {
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
        `Vytvořil zálohu/stáž pro den ${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()} (${config.timeFrom}-${config.timeTo})`);
      fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '🚑 Nová záloha / stáž',
          body: [
            `${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
            config.timeFrom && config.timeTo ? `${config.timeFrom}–${config.timeTo}` : null,
          ].filter(Boolean).join(' · '),
          url: '/shifts',
          tag: 'staz',
        }),
      });
      showToast('success', `Záloha/Stáž vytvořena.`);
      setZalohaModal(null);
    } catch (err) {
      console.error("Error adding zaloha shift:", err);
      showToast('error', 'Chyba při vytváření zálohy/stáže.');
    }
  };

  const handleRetroAssign = async (day, section, slotKey, targetUser) => {
    try {
      const docRef = doc(db, 'shifts', currentDocId);
      const dayData = shiftsData[day] || {};
      let newData = { ...dayData };
      if (!newData[section]) newData[section] = {};

      const base = getSlotBaseType(slotKey);
      const qualified = base === 'velitel'
        ? targetUser.roles.some(r => ['VD', 'VJ', 'Zástupce VJ', 'Admin'].includes(r))
        : base === 'strojnik'
          ? targetUser.roles.some(r => ['Strojník', 'Admin'].includes(r))
          : true;

      newData[section] = {
        ...newData[section],
        [slotKey]: {
          uid: targetUser.uid,
          name: targetUser.compactName,
          qualified,
          ...(targetUser.fromHome ? { fromHome: true } : {}),
          ...(targetUser.timeFrom ? { timeFrom: targetUser.timeFrom, timeTo: targetUser.timeTo } : {}),
        }
      };

      await setDoc(docRef, { days: { [day]: newData } }, { merge: true });
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_BACKDATED_SHIFT', 'admin',
        `Zpětně přiřazen ${targetUser.compactName} na pozici ${slotKey} (${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()})`);
      showToast('success', `${targetUser.compactName} přiřazen na ${slotKey}.`);
    } catch (err) {
      console.error("Error in retro assign:", err);
      showToast('error', 'Chyba při zpětném přiřazení.');
    }
  };

  return {
    currentDate,
    shiftsData,
    loading,
    newDayShiftDate,
    setNewDayShiftDate,
    zalohaModal,
    setZalohaModal,
    toast,
    setToast,
    modal,
    setModal,
    absencesData,
    absenceModal,
    setAbsenceModal,
    absencePanelOpen,
    setAbsencePanelOpen,
    trainingsData,
    eventsData,
    activityPopup,
    setActivityPopup,
    collapsedWeeks,
    toggleWeek,
    zalohaAssignModal,
    setZalohaAssignModal,
    days,
    groupWeeks,
    enabledDayShifts,
    enabledZalohaShifts,
    userRoles,
    currentDocId,
    zalohaSectionOpen,
    setZalohaSectionOpen,
    daySectionOpen,
    setDaySectionOpen,
    nightSectionOpen,
    setNightSectionOpen,

    // Actions
    handleMonthChange,
    handleSlotClick,
    handleZalohaInterestedClick,
    handleZalohaAssignUser,
    handleRemoveDayShift,
    handleRemoveZaloha,
    handleAddDayShift,
    handleAddAbsence,
    handleDeleteAbsence,
    handleAddZaloha,
    handleRetroAssign,
    showToast
  };
}
