import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { getZalohaKindLabel } from '../components/shifts/constants';
import { getSplitHoursForUser } from '../utils/shiftHours';

export default function useDashboardData() {
    const { currentUser, userData, sessionLastAppVisit, updateSessionVisitTime } = useAuth();
    const [allShifts, setAllShifts] = useState([]);
    const [upcomingActivities, setUpcomingActivities] = useState([]);

    // New state for statistics
    const [monthlyStats, setMonthlyStats] = useState({
        shiftsWorked: 0,
        hoursWorked: 0,
        eventsAttended: 0,
        trainingsAttended: 0,
        daysAbsent: 0,
        zalohaHoursWorked: 0
    });
    const [absences, setAbsences] = useState([]);
    
    // For the new Záloha/Stáž notification banner
    const [newZalohaShifts, setNewZalohaShifts] = useState([]);
    const [newActivities, setNewActivities] = useState([]);

    useEffect(() => {
        if (!currentUser) return;

        const today = new Date();

        // Calculate doc IDs for current and next month
        const getDocId = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const currentDocId = getDocId(today);

        const nextMonthDate = new Date(today);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const nextDocId = getDocId(nextMonthDate);

        // We need to listen to multiple documents. 
        // We'll use a map to store shifts from each month to handle updates cleanly.
        let shiftsMap = {
            [currentDocId]: [],
            [nextDocId]: []
        };
        let rawDocs = {
            [currentDocId]: null,
            [nextDocId]: null
        };

        const processMonthData = (docId, data) => {
            const [yearStr, monthStr] = docId.split('-');
            const year = parseInt(yearStr);
            const monthIndex = parseInt(monthStr) - 1;
            const daysMap = data?.days || {};

            const monthShifts = [];

            Object.keys(daysMap).forEach(dayKey => {
                const dayNum = parseInt(dayKey);
                const shiftDate = new Date(year, monthIndex, dayNum);

                // Filter out past dates (if in current month)
                // We keep today's shifts
                const todayResetted = new Date();
                todayResetted.setHours(0, 0, 0, 0);
                if (shiftDate < todayResetted) return;

                const dayData = daysMap[dayKey];

                const slotToRole = (slotKey) => {
                    if (slotKey.startsWith('velitel')) return 'Velitel';
                    if (slotKey.startsWith('strojnik')) return 'Strojník';
                    return 'Hasič';
                };

                // Check Day Shift
                const dayShift = dayData.dayShift || {};
                const dayEntries = Object.entries(dayShift);
                const dayEntry = dayEntries.find(([, u]) => u.uid === currentUser.uid);

                // Check Night Shift
                const nightShift = dayData.nightShift || {};
                const nightEntries = Object.entries(nightShift);
                const nightEntry = nightEntries.find(([, u]) => u.uid === currentUser.uid);

                const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

                if (dayEntry) {
                    const [slotKey] = dayEntry;
                    const colleagues = dayEntries
                        .filter(([, u]) => u.uid !== currentUser.uid)
                        .map(([, u]) => u.name || 'Neznámý');
                    monthShifts.push({ date: dateStr, type: 'denní', start: '09:00', end: '18:00', colleagues, role: slotToRole(slotKey) });
                }
                if (nightEntry) {
                    const [slotKey] = nightEntry;
                    const colleagues = nightEntries
                        .filter(([, u]) => u.uid !== currentUser.uid)
                        .map(([, u]) => u.name || 'Neznámý');
                    monthShifts.push({ date: dateStr, type: 'noční', start: '18:00', end: '05:00', colleagues, role: slotToRole(slotKey) });
                }

                // Check Zaloha/Staz
                const zalohaShift = dayData.zalohaStaz || {};
                const zalohaUsers = Object.values(zalohaShift).filter(v => v.uid); // exclude config
                const isZalohaMsg = zalohaUsers.some(u => u.uid === currentUser.uid);
                if (isZalohaMsg) {
                    const colleagues = zalohaUsers
                        .filter(u => u.uid !== currentUser.uid)
                        .map(u => u.name || 'Neznámý');
                    monthShifts.push({ date: dateStr, type: getZalohaKindLabel(zalohaShift.config).toLowerCase(), start: zalohaShift.config?.timeFrom || '07:00', end: zalohaShift.config?.timeTo || '19:00', colleagues });
                }
            });

            return monthShifts;
        };

        const checkNewZalohaShifts = () => {
            if (!sessionLastAppVisit) return;
            const todayResetted = new Date();
            todayResetted.setHours(0, 0, 0, 0);
            const newShifts = [];

            // Helper to scan a map
            const scanMap = (docId, data) => {
                const [yearStr, monthStr] = docId.split('-');
                const year = parseInt(yearStr);
                const monthIndex = parseInt(monthStr) - 1;
                const daysMap = data?.days || {};

                Object.keys(daysMap).forEach(dayKey => {
                    const dayNum = parseInt(dayKey);
                    const shiftDate = new Date(year, monthIndex, dayNum);
                    if (shiftDate < todayResetted) return;

                    const zalohaShift = daysMap[dayKey].zalohaStaz;
                    if (zalohaShift && zalohaShift.config?.createdAt) {
                        if (zalohaShift.config.createdAt > sessionLastAppVisit) {
                            newShifts.push({
                                date: `${dayNum}. ${monthStr}.`,
                                timeFrom: zalohaShift.config.timeFrom,
                                timeTo: zalohaShift.config.timeTo,
                                kindLabel: getZalohaKindLabel(zalohaShift.config)
                            });
                        }
                    }
                });
            };

            // We need to scan raw data, so we'll store raw data in a map as well
            if (rawDocs[currentDocId]) scanMap(currentDocId, rawDocs[currentDocId]);
            if (rawDocs[nextDocId]) scanMap(nextDocId, rawDocs[nextDocId]);

            setNewZalohaShifts(newShifts);
        };

        const updateAllShifts = () => {
            const merged = [
                ...shiftsMap[currentDocId],
                ...shiftsMap[nextDocId]
            ];

            // Sort by date
            merged.sort((a, b) => {
                return a.date.localeCompare(b.date);
            });

            setAllShifts(merged);
        };

        // Listen to Current Month
        const unsub1 = onSnapshot(doc(db, 'shifts', currentDocId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                rawDocs[currentDocId] = data;
                shiftsMap[currentDocId] = processMonthData(currentDocId, data);
            } else {
                rawDocs[currentDocId] = null;
                shiftsMap[currentDocId] = [];
            }
            updateAllShifts();
            checkNewZalohaShifts();
        });

        // Listen to Next Month
        const unsub2 = onSnapshot(doc(db, 'shifts', nextDocId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                rawDocs[nextDocId] = data;
                shiftsMap[nextDocId] = processMonthData(nextDocId, data);
            } else {
                rawDocs[nextDocId] = null;
                shiftsMap[nextDocId] = [];
            }
            updateAllShifts();
            checkNewZalohaShifts();
        });

        // 2. Fetch Trainings & Events
        const todayStr = today.toISOString().slice(0, 10);

        let allTrainingsRaw = [];
        let allEventsRaw = [];

        const checkNewActivities = () => {
            if (!sessionLastAppVisit) return;
            const newTrainings = allTrainingsRaw.filter(t => t.createdAt && t.createdAt > sessionLastAppVisit);
            const newEvents = allEventsRaw.filter(e => e.createdAt && e.createdAt > sessionLastAppVisit);
            const mergedNew = [...newTrainings, ...newEvents].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setNewActivities(mergedNew);
        };

        const trainingsUnsub = onSnapshot(collection(db, 'trainings'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'training' }));
            allTrainingsRaw = list;

            const userTrainings = list
                .filter(t => t.date >= todayStr)
                .filter(t => t.participants?.some(p => p.uid === currentUser.uid));

            updateActivities('training', userTrainings);
            checkNewActivities();
        });

        const eventsUnsub = onSnapshot(collection(db, 'events'), (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'event' }));
            allEventsRaw = list;

            const userEvents = list
                .filter(e => e.date >= todayStr)
                .filter(e => e.participants?.some(p => p.uid === currentUser.uid));

            updateActivities('event', userEvents);
            checkNewActivities();
        });

        let knownTrainings = [];
        let knownEvents = [];

        const updateActivities = (type, items) => {
            if (type === 'training') knownTrainings = items;
            if (type === 'event') knownEvents = items;

            const merged = [...knownTrainings, ...knownEvents].sort((a, b) => {
                const dateDiff = a.date.localeCompare(b.date);
                if (dateDiff !== 0) return dateDiff;
                return (a.time || '').localeCompare(b.time || '');
            });

            setUpcomingActivities(merged.slice(0, 5)); // Show top 5
        };

        // 3. Load absences for current user
        const absencesUnsub = onSnapshot(doc(db, 'absences', 'global'), (docSnap) => {
            if (docSnap.exists()) {
                const allAbsences = docSnap.data().items || [];
                const userAbsences = allAbsences
                    .filter(a => a.uid === currentUser.uid)
                    .sort((a, b) => b.startDate.localeCompare(a.startDate));
                setAbsences(userAbsences);
            }
        });

        // 4. Calculate monthly statistics for shifts
        const calculateStats = () => {
            const statsUnsub = onSnapshot(doc(db, 'shifts', currentDocId), (docSnap) => {
                let shiftsWorked = 0;
                let hoursWorked = 0;
                let zalohaHoursWorked = 0;

                if (docSnap.exists()) {
                    const days = docSnap.data().days || {};
                    const currentDay = today.getDate();

                    Object.keys(days).forEach(dayKey => {
                        const dayNum = parseInt(dayKey);
                        // Only count past/today
                        if (dayNum <= currentDay) {
                            const dayData = days[dayKey];
                            const split = getSplitHoursForUser(dayData, currentUser.uid);

                            if (split.hasDayShift) shiftsWorked++;
                            if (split.hasNightShift) shiftsWorked++;
                            hoursWorked += split.shiftTotal;
                            zalohaHoursWorked += split.zaloha;
                        }
                    });
                }

                setMonthlyStats(prev => ({
                    ...prev,
                    shiftsWorked,
                    hoursWorked,
                    zalohaHoursWorked
                }));
            });

            return statsUnsub;
        };

        const statsUnsub = calculateStats();

        return () => {
            unsub1();
            unsub2();
            trainingsUnsub();
            eventsUnsub();
            absencesUnsub();
            if (statsUnsub) statsUnsub();
        };
    }, [currentUser, sessionLastAppVisit]);

    // Separate effect to calculate events, trainings, and absences (depends on absences state)
    useEffect(() => {
        if (!currentUser) return;

        const today = new Date();
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = `${currentMonth}-01`;
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthEnd = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;
        const todayStr = today.toISOString().slice(0, 10);

        // Get events for current month
        const eventsUnsub = onSnapshot(collection(db, 'events'), (snapshot) => {
            const eventsAttended = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.date >= monthStart &&
                        data.date <= monthEnd &&
                        data.date <= todayStr &&
                        data.participants?.some(p => p.uid === currentUser.uid);
                }).length;

            setMonthlyStats(prev => ({ ...prev, eventsAttended }));
        });

        // Get trainings for current month
        const trainingsUnsub = onSnapshot(collection(db, 'trainings'), (snapshot) => {
            const trainingsAttended = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return data.date >= monthStart &&
                        data.date <= monthEnd &&
                        data.date <= todayStr &&
                        data.participants?.some(p => p.uid === currentUser.uid);
                }).length;

            setMonthlyStats(prev => ({ ...prev, trainingsAttended }));
        });

        // Calculate days absent this month (based on absences state)
        // Only count absences that have already started (not future absences)
        const daysAbsent = absences.filter(a =>
            a.endDate >= monthStart &&
            a.startDate <= monthEnd &&
            a.startDate <= todayStr  // Only count if absence has started
        ).reduce((total, absence) => {
            const start = new Date(Math.max(new Date(absence.startDate), new Date(monthStart)));
            const end = new Date(Math.min(new Date(absence.endDate), new Date(monthEnd), today));
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            return total + Math.max(0, days); // Ensure no negative days
        }, 0);

        setMonthlyStats(prev => ({ ...prev, daysAbsent }));

        return () => {
            eventsUnsub();
            trainingsUnsub();
        };
    }, [currentUser, absences]);

    return {
        currentUser,
        userData,
        allShifts,
        upcomingActivities,
        monthlyStats,
        absences,
        newZalohaShifts,
        newActivities,
        updateSessionVisitTime
    };
}
