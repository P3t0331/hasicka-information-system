import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import {
  doc,
  setDoc,
  onSnapshot,
  deleteField,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  runTransaction
} from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { getEffectiveRoles } from '../utils/roles';
import { sendPushNotification } from '../utils/pushNotification';
import {
  DAYS_CZ,
  MONTHS_CZ,
  SLOT_TYPES,
  getSlotBaseType,
  getSlotLabel,
  getZalohaSlots,
  getZalohaAssignedSlots,
  getZalohaKindForms
} from '../components/shifts/constants';
import { useToast } from '../contexts/ToastContext';

export default function useShiftCalendar(currentUser, userData) {
  const { addToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shiftsData, setShiftsData] = useState({});
  const [loading, setLoading] = useState(true);

  // For adding new day shifts
  const [newDayShiftDate, setNewDayShiftDate] = useState('');

  // For adding new Zaloha/Staz
  const [zalohaModal, setZalohaModal] = useState(null);

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
    daysArray.forEach((day) => {
      if (currentWeek.length > 0) {
        const prev = currentWeek[currentWeek.length - 1];
        // Days until the Sunday that closes prev's calendar week
        const daysUntilSunday = prev.dayOfWeek === 0 ? 0 : 7 - prev.dayOfWeek;
        // If this day is beyond that Sunday, start a new week group
        if (prev.date + daysUntilSunday < day.date) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
      currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return weeks;
  };

  const toggleWeek = (weekId) => {
    setCollapsedWeeks(prev => ({ ...prev, [weekId]: !prev[weekId] }));
  };

  // Auto-collapse weeks that are fully in the past when month changes or data loads
  useEffect(() => {
    if (loading) return;
    const today = new Date();
    const todayDate = today.getDate();
    const isCurrentMonth =
      today.getFullYear() === currentDate.getFullYear() &&
      today.getMonth() === currentDate.getMonth();

    if (!isCurrentMonth) {
      setCollapsedWeeks({});
      return;
    }

    const enabledZ = days.filter(d => shiftsData[d.date]?.zalohaStaz);
    const enabledD = days.filter(d => shiftsData[d.date]?.dayShiftEnabled || (shiftsData[d.date]?.dayShift && Object.keys(shiftsData[d.date]?.dayShift || {}).length > 0));

    const collapsed = {};
    groupWeeks(enabledZ).forEach(week => {
      if (week[week.length - 1].date < todayDate)
        collapsed[`zaloha-week-${week[0].date}`] = true;
    });
    groupWeeks(enabledD).forEach(week => {
      if (week[week.length - 1].date < todayDate)
        collapsed[`day-week-${week[0].date}`] = true;
    });
    groupWeeks(days).forEach(week => {
      if (week[week.length - 1].date < todayDate)
        collapsed[`night-week-${week[0].date}`] = true;
    });
    setCollapsedWeeks(collapsed);
  }, [currentDate.getFullYear(), currentDate.getMonth(), loading]);

  const showToast = (type, message) => addToast(type, message);

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
  const userRoles = getEffectiveRoles(userData ? (userData.roles || [userData.role || 'Hasič']) : []);

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

    // Phase 1: Read local state only for UI — confirmations and validation.
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

    // Determine intended action and get user confirmation before touching the database.
    let actionType; // 'join' | 'leave' | 'move' | 'kick' | 'zaloha-remove'

    if (section === 'zalohaStaz') {
      const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD', 'Přístup do Administrace'].includes(r));
      if (!isAdmin) {
        showToast('error', `Na pozice u ${getZalohaKindForms(sectionData.config).genitive} může přiřazovat pouze velitel. Použijte tlačítko "Mám zájem".`);
        return;
      }
      if (currentAssignee) {
        const confirmed = await showConfirm('Uvolnit pozici', `Chcete odebrat uživatele ${currentAssignee.name} z této pozice? (Zůstane v seznamu zájemců)`);
        if (!confirmed) return;
        actionType = 'zaloha-remove';
      } else {
        setZalohaAssignModal({ day, slotKey, section });
        return;
      }
    } else {
      if (currentAssignee && currentAssignee.uid === currentUser.uid) {
        const confirmed = await showConfirm('Zrušit službu', 'Opravdu chcete zrušit svou službu?');
        if (!confirmed) return;
        actionType = 'leave';
      } else if (currentAssignee) {
        const currentUserIsQualified = isQualifiedFor(slotKey);
        const existingIsUnqualified = currentAssignee.qualified === false;

        if (slotKey === 'velitel' && currentUserIsQualified && existingIsUnqualified) {
          const hasicSlots = ['hasic1', 'hasic2', 'hasic3'];
          const freeHasicSlot = hasicSlots.find(s => !sectionData[s]);
          if (freeHasicSlot) {
            const confirmed = await showConfirm(
              'Převzít místo',
              `Převzít pozici Velitele od ${currentAssignee.name}? Bude přesunut na Hasiče.`
            );
            if (!confirmed) return;
            actionType = 'move';
          } else {
            showToast('error', 'Nelze převzít místo - všechny pozice Hasič jsou obsazené.');
            return;
          }
        } else if (userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r))) {
          const confirmed = await showConfirm('Odebrat uživatele', `Chcete odebrat uživatele ${currentAssignee.name}?`);
          if (!confirmed) return;
          actionType = 'kick';
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
        actionType = 'join';
      }
    }

    // Phase 2: Execute atomically. The transaction reads fresh server data, so stale
    // local cache can never overwrite a concurrent write from another user.
    const docRef = doc(db, 'shifts', currentDocId);

    // Mirrors the original cleanupHours logic but uses fresh server data and returns
    // a flat field-path update object instead of mutating a local copy.
    const computeHoursCleanup = (freshDayData, targetUid, targetSection) => {
      const otherSection = targetSection === 'dayShift' ? 'nightShift' : 'dayShift';
      const inOther = Object.values(freshDayData[otherSection] || {}).some(
        u => u && typeof u === 'object' && u.uid === targetUid
      );
      if (!inOther) {
        return { [`days.${day}.hours.${targetUid}`]: deleteField() };
      }
      const sectionKey = targetSection === 'dayShift' ? 'day' : 'night';
      return { [`days.${day}.hours.${targetUid}.${sectionKey}`]: deleteField() };
    };

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);

        if (!docSnap.exists()) {
          if (actionType !== 'join') {
            throw Object.assign(new Error('DOC_NOT_FOUND'), { appError: true });
          }
          transaction.set(docRef, { days: { [day]: { [section]: { [slotKey]: userCompact } } } });
          return;
        }

        const freshDayData = docSnap.data().days?.[day] || {};
        const freshSection = freshDayData[section] || {};
        const freshSlot = freshSection[slotKey];
        const update = {};

        if (actionType === 'join') {
          // Conflict: slot was taken by someone else while user had stale data.
          if (freshSlot && freshSlot.uid !== currentUser.uid) {
            throw Object.assign(new Error('SLOT_TAKEN'), { appError: true });
          }
          update[`days.${day}.${section}.${slotKey}`] = userCompact;
          Object.assign(update, computeHoursCleanup(freshDayData, currentUser.uid, section));

        } else if (actionType === 'leave') {
          update[`days.${day}.${section}.${slotKey}`] = deleteField();
          Object.assign(update, computeHoursCleanup(freshDayData, currentUser.uid, section));

        } else if (actionType === 'move') {
          if (!freshSlot) throw Object.assign(new Error('NO_VELITEL'), { appError: true });
          const hasicSlots = ['hasic1', 'hasic2', 'hasic3'];
          // Re-check free hasic slot on fresh server data — may differ from local state.
          const freshFreeHasicSlot = hasicSlots.find(s => !freshSection[s]);
          if (!freshFreeHasicSlot) throw Object.assign(new Error('NO_FREE_HASIC_SLOT'), { appError: true });
          update[`days.${day}.${section}.${freshFreeHasicSlot}`] = { ...freshSlot, qualified: true };
          update[`days.${day}.${section}.${slotKey}`] = userCompact;
          Object.assign(update, computeHoursCleanup(freshDayData, currentUser.uid, section));

        } else if (actionType === 'kick') {
          const kickedUid = freshSlot?.uid;
          update[`days.${day}.${section}.${slotKey}`] = deleteField();
          if (kickedUid) Object.assign(update, computeHoursCleanup(freshDayData, kickedUid, section));

        } else if (actionType === 'zaloha-remove') {
          update[`days.${day}.${section}.${slotKey}`] = deleteField();
        }

        transaction.update(docRef, update);
      });

      // Phase 3: Post-transaction side-effects (logging is fire-and-forget, safe outside transaction).
      // A Záloha/Stáž is named by its kind ("Záloha"), day/night shifts by their adjective.
      const zalohaKind = section === 'zalohaStaz' ? getZalohaKindForms(sectionData.config) : null;
      const shiftNom = zalohaKind ? zalohaKind.label : (section === 'dayShift' ? 'denní služba' : 'noční služba');
      const shiftAcc = zalohaKind ? zalohaKind.accusative : (section === 'dayShift' ? 'denní službu' : 'noční službu');
      const shiftGen = zalohaKind ? `ze ${zalohaKind.genitive}` : (section === 'dayShift' ? 'z denní služby' : 'z noční služby');
      const dateLabel = `${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

      if (actionType === 'zaloha-remove') {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'ADMIN_REMOVED_USER_FROM_STAZ', 'shifts',
          `Odebral uživatele z pozice ${slotKey} – ${shiftNom} ${dateLabel}`);
      } else if (actionType === 'leave') {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'LEFT_SHIFT', 'shifts',
          `Odhlásil se ${shiftGen} ${dateLabel} (${slotKey})`);
      } else if (actionType === 'kick' || actionType === 'move') {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'REMOVED_USER_FROM_SHIFT', 'shifts',
          `Odebral ${currentAssignee.name} z pozice ${slotKey} – ${shiftNom} ${dateLabel}`);
      } else if (actionType === 'join') {
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'JOINED_SHIFT', 'shifts',
          `Přihlásil se na ${shiftAcc} ${dateLabel} – pozice: ${slotKey}`);
      }

      showToast('success', 'Služba uložena.');
    } catch (err) {
      if (err.appError) {
        if (err.message === 'SLOT_TAKEN') {
          showToast('error', 'Toto místo bylo mezitím obsazeno. Zkuste to znovu.');
        } else if (err.message === 'NO_FREE_HASIC_SLOT') {
          showToast('error', 'Všechny pozice Hasič jsou nyní obsazené. Nelze přesunout Velitele.');
        } else if (err.message === 'NO_VELITEL') {
          showToast('error', 'Pozice Velitele je nyní prázdná.');
        } else if (err.message === 'DOC_NOT_FOUND') {
          showToast('error', 'Tento měsíc zatím nemá vytvořené směny. Kontaktujte správce.');
        } else {
          showToast('error', 'Chyba: ' + err.message);
        }
      } else {
        console.error("Error updating shift:", err);
        showToast('error', 'Chyba při ukládání služby.');
      }
    }
  };

  const handleZalohaInterestedClick = async (day) => {
    if (!userData || !userData.approved) return;

    const dayData = shiftsData[day] || {};
    const sectionData = dayData.zalohaStaz || { interested: [] };
    const interested = sectionData.interested || [];
    const isInterested = interested.some(u => u.uid === currentUser.uid);

    const docRef = doc(db, 'shifts', currentDocId);
    const dateLabel = `${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    const kind = getZalohaKindForms(sectionData.config);

    if (isInterested) {
      const confirmed = await showConfirm('Zrušit zájem', `Opravdu chcete zrušit svůj zájem o tuto ${kind.accusative}? Budete odebráni i z případné přiřazené pozice.`);
      if (!confirmed) return;

      try {
        // Transaction needed: removing interest also clears any assigned slots.
        await runTransaction(db, async (transaction) => {
          const docSnap = await transaction.get(docRef);
          if (!docSnap.exists()) throw new Error('Dokument neexistuje.');

          const freshZalohaStaz = docSnap.data().days?.[day]?.zalohaStaz || {};
          const freshInterested = freshZalohaStaz.interested || [];
          const update = {
            [`days.${day}.zalohaStaz.interested`]: freshInterested.filter(u => u.uid !== currentUser.uid),
          };
          const slots = Object.keys(freshZalohaStaz).filter(k => k !== 'config' && k !== 'interested');
          for (const s of slots) {
            if (freshZalohaStaz[s]?.uid === currentUser.uid) {
              update[`days.${day}.zalohaStaz.${s}`] = deleteField();
            }
          }
          transaction.update(docRef, update);
        });

        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'CANCELLED_INTEREST_IN_STAZ', 'shifts',
          `Zrušil zájem o ${kind.accusative} dne ${dateLabel}`);
        showToast('success', 'Zájem zrušen.');
      } catch (err) {
        console.error("Error updating interested:", err);
        showToast('error', 'Chyba při ukládání.');
      }
    } else {
      // arrayUnion atomically appends without a read — safe for concurrent clicks from different users.
      const newInterestEntry = {
        uid: currentUser.uid,
        name: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''}`,
        qualifiedVelitel: isQualifiedFor('velitel'),
        qualifiedStrojnik: isQualifiedFor('strojnik')
      };
      try {
        await updateDoc(docRef, {
          [`days.${day}.zalohaStaz.interested`]: arrayUnion(newInterestEntry),
        });
        logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
          'INTERESTED_IN_STAZ', 'shifts',
          `Projevil zájem o ${kind.accusative} dne ${dateLabel}`);
        sendPushNotification({
          title: `✋ Nový zájemce o ${kind.accusative}`,
          body: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''} · ${dateLabel}`,
          url: '/shifts',
          tag: 'staz-zajem',
          category: 'sluzby',
          targetRoles: ['Admin', 'VJ', 'Zástupce VJ'],
        });
        showToast('success', 'Přidáni do seznamu zájemců.');
      } catch (err) {
        console.error("Error updating interested:", err);
        showToast('error', 'Chyba při ukládání.');
      }
    }
  };

  const handleZalohaAssignUser = async (targetUser) => {
    if (!zalohaAssignModal) return;

    const { day, slotKey, section } = zalohaAssignModal;

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

    const docRef = doc(db, 'shifts', currentDocId);
    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error('Dokument neexistuje.');

        const freshZalohaStaz = docSnap.data().days?.[day]?.[section] || {};
        const update = {};

        // Remove user from any other slot they're already in (uses fresh server data).
        const slots = Object.keys(freshZalohaStaz).filter(k => k !== 'config' && k !== 'interested');
        for (const s of slots) {
          if (freshZalohaStaz[s]?.uid === targetUser.uid) {
            update[`days.${day}.${section}.${s}`] = deleteField();
          }
        }
        update[`days.${day}.${section}.${slotKey}`] = {
          uid: targetUser.uid,
          name: targetUser.name,
          qualified,
        };

        transaction.update(docRef, update);
      });

      const dateLabel = `${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      const kind = getZalohaKindForms(shiftsData[day]?.[section]?.config);
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_ASSIGNED_USER_TO_STAZ', 'shifts',
        `Přiřadil ${targetUser.name} na pozici ${slotKey} – ${kind.label} ${dateLabel}`);
      sendPushNotification({
        title: `📋 Přiřazen na ${kind.accusative}`,
        body: `Pozice: ${slotKey} · ${dateLabel}`,
        url: '/shifts',
        tag: 'staz-assign',
        category: 'sluzby',
        targetUserId: targetUser.uid,
      });
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
    const kind = getZalohaKindForms(currentShift.config);

    const takenSlots = Object.keys(currentShift).filter(k => k !== 'config' && k !== 'interested');
    let warningMsg = `Opravdu chcete zrušit ${kind.accusative} pro ${date}. ${MONTHS_CZ[currentDate.getMonth()]}?`;
    if (takenSlots.length > 0) {
      warningMsg = `POZOR: Tato ${kind.label.toLowerCase()} má obsazené pozice! Opravdu chcete směnu ZRUŠIT a odebrat lidi?`;
    }

    const confirmed = await showConfirm(`Odebrat ${kind.accusative}`, warningMsg);
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
        `Zrušil ${kind.accusative} pro den ${date}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`);
      showToast('success', `${kind.label} odebrána.`);
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
    const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'Přístup do Administrace'].includes(r));
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
      const kind = getZalohaKindForms(config);
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_ADDED_SHIFT', 'admin',
        `Vytvořil ${kind.accusative} pro den ${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()} (${config.timeFrom}-${config.timeTo})`);
      sendPushNotification({
        title: `🚑 Nová ${kind.label.toLowerCase()}`,
        body: [
          `${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
          config.timeFrom && config.timeTo ? `${config.timeFrom}–${config.timeTo}` : null,
        ].filter(Boolean).join(' · '),
        url: '/shifts',
        tag: 'staz',
        category: 'sluzby',
      });
      showToast('success', `${kind.label} vytvořena.`);
      setZalohaModal(null);
    } catch (err) {
      console.error("Error adding zaloha shift:", err);
      showToast('error', 'Chyba při vytváření zálohy/stáže.');
    }
  };



  const handleEditZaloha = async (config) => {
    if (!zalohaModal) return;
    const dateNum = zalohaModal.date;
    const existing = shiftsData[dateNum]?.zalohaStaz;
    if (!existing) {
      showToast('error', 'Záloha/Stáž pro tento den neexistuje.');
      return;
    }

    const oldConfig = existing.config || {};
    const keptSlots = getZalohaSlots(config);

    // Describe what actually changed — an edit with no changes is not worth a write.
    const changes = [];
    const oldKind = getZalohaKindForms(oldConfig);
    const newKind = getZalohaKindForms(config);
    const kindChanged = oldKind.value !== newKind.value;
    if (kindChanged) changes.push(`typ ${oldKind.label} → ${newKind.label}`);
    if ((oldConfig.timeFrom || '') !== config.timeFrom || (oldConfig.timeTo || '') !== config.timeTo) {
      changes.push(`čas ${oldConfig.timeFrom || '?'}–${oldConfig.timeTo || '?'} → ${config.timeFrom}–${config.timeTo}`);
    }
    const countLabels = { velitelCount: 'Velitel', strojnikCount: 'Strojník', hasicCount: 'Hasič' };
    const countDefaults = { velitelCount: 1, strojnikCount: 1, hasicCount: 2 };
    Object.keys(countLabels).forEach(key => {
      const before = oldConfig[key] ?? countDefaults[key];
      if (before !== config[key]) changes.push(`${countLabels[key]} ${before} → ${config[key]}`);
    });
    const timeChanged = (oldConfig.timeFrom || '') !== config.timeFrom || (oldConfig.timeTo || '') !== config.timeTo;

    if (changes.length === 0) {
      showToast('info', 'Žádné změny k uložení.');
      setZalohaModal(null);
      return;
    }

    // Confirm dropping people out of positions that the new config no longer has.
    const droppedSlots = getZalohaAssignedSlots(existing).filter(([slotKey]) => !keptSlots.includes(slotKey));
    if (droppedSlots.length > 0) {
      const names = droppedSlots.map(([slotKey, assignee]) => `${getSlotLabel(slotKey)} – ${assignee.name}`).join(', ');
      const confirmed = await showConfirm(
        'Snížení počtu pozic',
        `Z pozic budou odebráni: ${names}. Zůstanou v seznamu zájemců. Pokračovat?`
      );
      if (!confirmed) return;
    }
    const confirmedDroppedKeys = droppedSlots.map(([slotKey]) => slotKey);

    const docRef = doc(db, 'shifts', currentDocId);
    const dateLabel = `${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    let dropped = [];
    let keptAssignees = [];

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) throw new Error('Dokument neexistuje.');

        const fresh = docSnap.data().days?.[dateNum]?.zalohaStaz;
        if (!fresh) throw Object.assign(new Error('NO_ZALOHA'), { appError: true });

        const freshAssigned = getZalohaAssignedSlots(fresh);
        dropped = freshAssigned.filter(([slotKey]) => !keptSlots.includes(slotKey));
        keptAssignees = freshAssigned.filter(([slotKey]) => keptSlots.includes(slotKey));

        // Someone was assigned to a disappearing slot after the confirmation dialog —
        // don't silently remove a person the admin never saw.
        if (dropped.some(([slotKey]) => !confirmedDroppedKeys.includes(slotKey))) {
          throw Object.assign(new Error('ASSIGNEES_CHANGED'), { appError: true });
        }

        const update = {
          [`days.${dateNum}.zalohaStaz.config`]: {
            ...(fresh.config || {}),
            ...config,
            // createdAt drives the "new shift" dashboard badge — an edit must not reset it.
            createdAt: fresh.config?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: `${userData.firstName} ${userData.lastName}`
          }
        };
        dropped.forEach(([slotKey]) => {
          update[`days.${dateNum}.zalohaStaz.${slotKey}`] = deleteField();
        });

        transaction.update(docRef, update);
      });

      const logDetail = [
        `Upravil ${oldKind.accusative} pro den ${dateLabel}: ${changes.join(', ')}`,
        dropped.length > 0
          ? `odebráni z pozic: ${dropped.map(([slotKey, a]) => `${getSlotLabel(slotKey)} – ${a.name}`).join(', ')}`
          : null
      ].filter(Boolean).join('; ');
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'ADMIN_UPDATED_SHIFT', 'admin', logDetail);

      dropped.forEach(([slotKey, assignee]) => {
        sendPushNotification({
          title: `⚠️ Odebrán ze ${newKind.genitive}`,
          body: `${getSlotLabel(slotKey)} · ${dateLabel} – počet pozic byl snížen`,
          url: '/shifts',
          tag: 'staz-edit',
          category: 'sluzby',
          targetUserId: assignee.uid,
        });
      });
      if (timeChanged || kindChanged) {
        keptAssignees.forEach(([, assignee]) => {
          sendPushNotification({
            title: kindChanged && !timeChanged
              ? `🔄 Změna typu služby na ${newKind.label.toLowerCase()}`
              : `🕒 Změna času ${newKind.genitive}`,
            body: [
              dateLabel,
              kindChanged ? `nově ${newKind.label.toLowerCase()}` : null,
              timeChanged ? `nově ${config.timeFrom}–${config.timeTo}` : null,
            ].filter(Boolean).join(' · '),
            url: '/shifts',
            tag: 'staz-edit',
            category: 'sluzby',
            targetUserId: assignee.uid,
          });
        });
      }

      showToast('success', `${newKind.label} upravena.`);
      setZalohaModal(null);
    } catch (err) {
      if (err.appError) {
        if (err.message === 'NO_ZALOHA') {
          showToast('error', 'Záloha/Stáž pro tento den již neexistuje.');
        } else if (err.message === 'ASSIGNEES_CHANGED') {
          showToast('error', 'Obsazení pozic se mezitím změnilo. Otevřete úpravu znovu.');
        } else {
          showToast('error', 'Chyba: ' + err.message);
        }
      } else {
        console.error("Error editing zaloha shift:", err);
        showToast('error', 'Chyba při úpravě zálohy/stáže.');
      }
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
      if (section === 'zalohaStaz') {
        sendPushNotification({
          title: `📋 Přiřazen na ${getZalohaKindForms(shiftsData[day]?.zalohaStaz?.config).accusative}`,
          body: `Pozice: ${slotKey} · ${day}. ${MONTHS_CZ[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
          url: '/shifts',
          tag: 'staz-assign',
          category: 'sluzby',
          targetUserId: targetUser.uid,
        });
      }
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
    handleEditZaloha,
    handleRetroAssign,
    showToast,
  };
}
