import { useEffect, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, query, where, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logAction } from '../utils/logger';
import { pluralize } from '../utils/pluralize';
import {
  monthDocIdsBetween, availabilityDocId, normalizeSlots, slotsEqual, buildLogDetail, planWeekCopy,
} from '../../shared/availability.js';

// Načte vše, co potřebuje výpočet posádky pro rozsah dní: záznamy dostupnosti,
// absence, denní služby z měsíčních dokumentů `shifts` a schválené členy.
export function useAvailabilityData(startISO, endISO) {
  const [availabilityDocs, setAvailabilityDocs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [members, setMembers] = useState([]);
  const [dayShiftsByDate, setDayShiftsByDate] = useState({});
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);

  useEffect(() => {
    const availabilityQuery = query(
      collection(db, 'availability'),
      where('date', '>=', startISO),
      where('date', '<=', endISO),
    );
    const unsubAvailability = onSnapshot(availabilityQuery, (snap) => {
      setAvailabilityDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAvailabilityLoaded(true);
    }, (err) => {
      console.error('Error loading availability:', err);
      setAvailabilityLoaded(true);
    });

    const unsubAbsences = onSnapshot(doc(db, 'absences', 'global'), (snap) => {
      setAbsences(snap.exists() ? (snap.data().items || []) : []);
    });

    const unsubMembers = onSnapshot(query(collection(db, 'users'), where('approved', '==', true)), (snap) => {
      setMembers(snap.docs.map(d => ({ ...d.data(), uid: d.id })));
      setMembersLoaded(true);
    }, (err) => {
      console.error('Error loading members:', err);
      setMembersLoaded(true);
    });

    const unsubShifts = monthDocIdsBetween(startISO, endISO).map(monthId =>
      onSnapshot(doc(db, 'shifts', monthId), (snap) => {
        const days = snap.exists() ? (snap.data().days || {}) : {};
        setDayShiftsByDate(prev => {
          const next = Object.fromEntries(Object.entries(prev).filter(([iso]) => !iso.startsWith(monthId)));
          Object.entries(days).forEach(([dayKey, dayData]) => {
            if (dayData?.dayShift) next[`${monthId}-${String(dayKey).padStart(2, '0')}`] = dayData.dayShift;
          });
          return next;
        });
      }),
    );

    return () => {
      unsubAvailability();
      unsubAbsences();
      unsubMembers();
      unsubShifts.forEach(unsub => unsub());
    };
  }, [startISO, endISO]);

  return {
    loading: !(availabilityLoaded && membersLoaded),
    availabilityDocs,
    absences,
    members,
    dayShiftsByDate,
  };
}

// Zápisy vlastní dostupnosti. Firestore promítne zápis do onSnapshot okamžitě
// a při odmítnutí ho sám vrátí, UI proto nepotřebuje vlastní optimistický stav.
export function useAvailabilityActions() {
  const { currentUser, userData } = useAuth();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);

  const uid = currentUser?.uid;
  const userName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim();
  const rememberedTravel = userData?.preferences?.availabilityTravelMin ?? null;

  const rememberTravel = useCallback(async (travelMin) => {
    if (rememberedTravel === travelMin) return;
    try {
      await updateDoc(doc(db, 'users', uid), { 'preferences.availabilityTravelMin': travelMin });
    } catch (err) {
      console.warn('Failed to remember travel time:', err);
    }
  }, [uid, rememberedTravel]);

  const saveDay = useCallback(async (date, slots, previousSlots) => {
    const normalized = normalizeSlots(slots);
    setBusy(true);
    try {
      await setDoc(doc(db, 'availability', availabilityDocId(date, uid)), {
        uid,
        date,
        slots: normalized,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving availability:', err);
      addToast('error', 'Chyba při ukládání dostupnosti');
      setBusy(false);
      return false;
    }
    setBusy(false);

    if (previousSlots?.length) {
      if (!slotsEqual(previousSlots, normalized)) {
        logAction(db, uid, userName, 'AVAILABILITY_UPDATED', 'availability',
          buildLogDetail('updated', { date, slots: normalized, previousSlots: normalizeSlots(previousSlots) }));
      }
    } else {
      logAction(db, uid, userName, 'AVAILABILITY_ADDED', 'availability',
        buildLogDetail('added', { date, slots: normalized }));
    }
    rememberTravel(normalized[normalized.length - 1].travelMin);
    return true;
  }, [uid, userName, addToast, rememberTravel]);

  const removeDay = useCallback(async (date, previousSlots) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'availability', availabilityDocId(date, uid)));
    } catch (err) {
      console.error('Error removing availability:', err);
      addToast('error', 'Chyba při ukládání dostupnosti');
      setBusy(false);
      return false;
    }
    setBusy(false);
    logAction(db, uid, userName, 'AVAILABILITY_REMOVED', 'availability',
      buildLogDetail('removed', { date, previousSlots: normalizeSlots(previousSlots || []) }));
    return true;
  }, [uid, userName, addToast]);

  const copyWeek = useCallback(async ({ todayISO, availabilityDocs, absences }) => {
    const plan = planWeekCopy({ uid, todayISO, availabilityDocs, absences });
    if (plan.length === 0) {
      addToast('info', 'Není co kopírovat');
      return;
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      plan.forEach(({ date, slots }) => {
        batch.set(doc(db, 'availability', availabilityDocId(date, uid)), {
          uid, date, slots, updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error copying availability:', err);
      addToast('error', 'Chyba při ukládání dostupnosti');
      setBusy(false);
      return;
    }
    setBusy(false);
    const n = plan.length;
    addToast('success', `Zkopírováno na ${n} ${pluralize(n, 'den', 'dny', 'dní')}`);
    logAction(db, uid, userName, 'AVAILABILITY_COPIED_WEEK', 'availability',
      buildLogDetail('copied', { dates: plan.map(p => p.date) }));
  }, [uid, userName, addToast]);

  return { busy, saveDay, removeDay, copyWeek, rememberedTravel };
}
