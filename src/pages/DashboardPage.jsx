import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import WeatherWarnings from '../components/dashboard/WeatherWarnings';

export default function DashboardPage() {
    const { currentUser, userData } = useAuth();
    const navigate = useNavigate();
    const [allShifts, setAllShifts] = useState([]);
    const [upcomingActivities, setUpcomingActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    // New state for statistics
    const [monthlyStats, setMonthlyStats] = useState({
        shiftsWorked: 0,
        hoursWorked: 0,
        eventsAttended: 0,
        trainingsAttended: 0,
        daysAbsent: 0
    });
    const [absences, setAbsences] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [isLinksOpen, setIsLinksOpen] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth(); // 0-indexed

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

                // Check Day Shift
                const dayShift = dayData.dayShift || {};
                const dayUsers = Object.values(dayShift);
                const isDayMsg = dayUsers.some(u => u.uid === currentUser.uid);

                // Check Night Shift
                const nightShift = dayData.nightShift || {};
                const nightUsers = Object.values(nightShift);
                const isNightMsg = nightUsers.some(u => u.uid === currentUser.uid);

                const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

                if (isDayMsg) {
                    const colleagues = dayUsers
                        .filter(u => u.uid !== currentUser.uid)
                        .map(u => u.name || 'Neznámý');
                    monthShifts.push({ date: dateStr, type: 'denní', start: '09:00', end: '18:00', colleagues });
                }
                if (isNightMsg) {
                    const colleagues = nightUsers
                        .filter(u => u.uid !== currentUser.uid)
                        .map(u => u.name || 'Neznámý');
                    monthShifts.push({ date: dateStr, type: 'noční', start: '18:00', end: '05:00', colleagues });
                }
            });

            return monthShifts;
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
                shiftsMap[currentDocId] = processMonthData(currentDocId, docSnap.data());
            } else {
                shiftsMap[currentDocId] = [];
            }
            updateAllShifts();
        });

        // Listen to Next Month
        const unsub2 = onSnapshot(doc(db, 'shifts', nextDocId), (docSnap) => {
            if (docSnap.exists()) {
                shiftsMap[nextDocId] = processMonthData(nextDocId, docSnap.data());
            } else {
                shiftsMap[nextDocId] = [];
            }
            updateAllShifts();
        });

        // 2. Fetch Trainings & Events
        const todayStr = today.toISOString().slice(0, 10);

        const trainingsUnsub = onSnapshot(collection(db, 'trainings'), (snapshot) => {
            const userTrainings = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data(), type: 'training' }))
                .filter(t => t.date >= todayStr)
                .filter(t => t.participants?.some(p => p.uid === currentUser.uid));

            updateActivities('training', userTrainings);
        });

        const eventsUnsub = onSnapshot(collection(db, 'events'), (snapshot) => {
            const userEvents = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data(), type: 'event' }))
                .filter(e => e.date >= todayStr)
                .filter(e => e.participants?.some(p => p.uid === currentUser.uid));

            updateActivities('event', userEvents);
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
            setLoading(false);
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
            const today = new Date();
            const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

            // Get shifts for current month
            const currentMonthShiftsRef = doc(db, 'shifts', currentMonth);
            const statsUnsub = onSnapshot(currentMonthShiftsRef, (docSnap) => {
                let shiftsWorked = 0;
                let hoursWorked = 0;

                if (docSnap.exists()) {
                    const days = docSnap.data().days || {};
                    const currentDay = today.getDate();

                    Object.keys(days).forEach(dayKey => {
                        const dayNum = parseInt(dayKey);
                        // Only count past/today
                        if (dayNum <= currentDay) {
                            const dayData = days[dayKey];
                            const dayShift = dayData.dayShift || {};
                            const nightShift = dayData.nightShift || {};

                            const inDay = Object.values(dayShift).some(u => u.uid === currentUser.uid);
                            const inNight = Object.values(nightShift).some(u => u.uid === currentUser.uid);

                            if (inDay) {
                                shiftsWorked++;
                                const hours = dayData.hours?.[currentUser.uid]?.day || 8;
                                hoursWorked += hours;
                            }
                            if (inNight) {
                                shiftsWorked++;
                                const hours = dayData.hours?.[currentUser.uid]?.night || 11;
                                hoursWorked += hours;
                            }
                        }
                    });
                }

                setMonthlyStats(prev => ({
                    ...prev,
                    shiftsWorked,
                    hoursWorked
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
    }, [currentUser]);

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

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 10) return 'Dobré ráno';
        if (hour < 18) return 'Dobrý den';
        return 'Dobrý večer';
    };

    return (
        <div className="container dashboard-page" style={{ paddingBottom: '5rem' }}>
            {/* Header */}
            <header style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.2rem' }}>
                    {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#2c3e50' }}>
                    {getGreeting()},{' '}
                    <span style={{ color: '#E53935' }}>{userData?.firstName || 'Hasiči'}</span>!
                </h1>
            </header>

            {/* Weather Warnings */}
            <WeatherWarnings />

            {/* Quick Links / Important Links */}
            <section style={{ marginBottom: '2rem' }}>
                <div 
                    className="dashboard-card"
                    style={{ 
                        overflow: 'hidden',
                        padding: 0,
                        border: 'none',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                        background: 'white'
                    }}
                >
                    <div 
                        onClick={() => setIsLinksOpen(!isLinksOpen)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '1rem', 
                            padding: '1.25rem', 
                            background: 'linear-gradient(135deg, #FFB74D, #FFA726)',
                            color: 'white',
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ fontSize: '2rem' }}>🔗</div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.1rem' }}>Důležité odkazy</div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Návody, portály, materiály a disk</div>
                        </div>
                        <div style={{ 
                            marginLeft: 'auto', 
                            fontSize: '1.2rem', 
                            opacity: 0.8,
                            transform: isLinksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                        }}>
                            ▼
                        </div>
                    </div>
                    
                    {isLinksOpen && (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#fdfdfd' }}>
                            <a 
                                href="https://docs.google.com/spreadsheets/d/1qWtU8OSbAX1PB9biEztcqjwtLVIx3KBegE1L52FOWhM/edit?gid=0#gid=0" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                            >
                                <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>📖</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Návody k obsluze</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Kompletní dokumentace k technice</div>
                                </div>
                            </a>

                            <a 
                                href="https://www.hasici-vzdelavani.cz/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                            >
                                <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🎓</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Učební materiály</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Portál hasičského vzdělávání</div>
                                </div>
                            </a>

                            <a 
                                href="https://jsdh.izscr.cz/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                            >
                                <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🌐</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Portál JSDH</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Informační systém pro hasiče</div>
                                </div>
                            </a>

                            <a 
                                href="https://udalosti.firebrno.cz/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                            >
                                <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🚒</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Fire Brno</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Přehled událostí HZS JMK</div>
                                </div>
                            </a>

                            <a 
                                href="https://drive.google.com/drive/folders/1CCvV1OuTlbsjLtfQSzU6WpZynDLRTqqt?usp=drive_link" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                            >
                                <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>📁</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>Google Disk</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Fotky a sdílené dokumenty</div>
                                </div>
                            </a>
                        </div>
                    )}
                </div>
            </section>

            {/* Monthly Statistics Cards */}
            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>📊 Tento měsíc</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                    <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚒</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FF9800' }}>{monthlyStats.shiftsWorked}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Služby</div>
                    </div>
                    <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>⏱️</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FF9800' }}>{monthlyStats.hoursWorked}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hodin</div>
                    </div>
                    <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚩</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E53935' }}>{monthlyStats.eventsAttended}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Akce</div>
                    </div>
                    <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>📚</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#9C27B0' }}>{monthlyStats.trainingsAttended}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Školení</div>
                    </div>
                    <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚫</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#757575' }}>{monthlyStats.daysAbsent}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dní nepřítomen</div>
                    </div>
                </div>
            </section>

            {/* Next Shift Section */}
            <section style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🚒 Moje nejbližší služba
                    </h2>
                </div>

                {allShifts.length > 0 ? (
                    (() => {
                        const shift = allShifts[0];
                        return (
                            <div key={shift.date + shift.type} className="dashboard-card highlight" style={{ padding: '1.5rem', borderLeft: '4px solid #E53935' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E53935', marginBottom: '0.25rem', lineHeight: 1.2 }}>
                                            {formatDate(shift.date)}
                                        </div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1.4rem' }}>{shift.type === 'denní' ? '☀️' : '🌙'}</span>
                                            {shift.type === 'denní' ? 'Denní služba' : 'Noční služba'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#333' }}>
                                            {shift.start}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                            do {shift.end}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid #ffcdd2', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '0.5px' }}>
                                            Kolegové
                                        </div>
                                        <div style={{ fontWeight: 600, color: '#333', fontSize: '0.9rem' }}>
                                            {shift.colleagues && shift.colleagues.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                                    {shift.colleagues.map((name, i) => (
                                                        <span key={i}>{name}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span style={{ color: '#888', fontStyle: 'italic' }}>Žádní další kolegové</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '0.5px' }}>
                                            Role
                                        </div>
                                        <div style={{ fontWeight: 600, color: '#333' }}>
                                            {userData?.role || 'Hasič'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="dashboard-card" style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
                        Žádné nadcházející služby.
                        <div style={{ marginTop: '0.5rem' }}>
                            <Link to="/shifts" className="btn btn-primary btn-sm">Naplánovat službu</Link>
                        </div>
                    </div>
                )}
            </section>

            {/* Upcoming Activities */}
            <section style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Moje aktivity</h2>
                </div>

                {upcomingActivities.length > 0 ? (
                    <div className="activities-list">
                        {upcomingActivities.map(activity => (
                            <div key={activity.id} className={`activity-card ${activity.type}`}>
                                <div className="activity-icon">
                                    {activity.type === 'training' ? '📚' : '🚩'}
                                </div>
                                <div className="activity-details">
                                    <div className="activity-title">{activity.title}</div>
                                    <div className="activity-meta">
                                        <span>📅 {formatDate(activity.date)}</span>
                                        <span>⏰ {activity.time}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dashboard-card" style={{ textAlign: 'center', color: '#888', padding: '1.5rem' }}>
                        Zatím nemáte žádné naplánované aktivity.
                    </div>
                )}
            </section>

            {/* My Absences Panel */}
            <section style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2 style={{ fontSize: '1.1rem', margin: 0 }}>🚫 Moje absence</h2>
                    <Link to="/shifts" className="btn btn-sm" style={{ padding: '0.4rem 0.8rem' }}>
                        Spravovat
                    </Link>
                </div>

                {absences.filter(a => a.endDate >= new Date().toISOString().slice(0, 10)).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {absences
                            .filter(a => a.endDate >= new Date().toISOString().slice(0, 10))
                            .slice(0, 3)
                            .map((absence, idx) => {
                                const startDate = new Date(absence.startDate);
                                const endDate = new Date(absence.endDate);
                                const daysUntil = Math.ceil((startDate - new Date()) / (1000 * 60 * 60 * 24));
                                const isOngoing = startDate <= new Date() && endDate >= new Date();

                                return (
                                    <div key={idx} className="dashboard-card" style={{ padding: '1rem', borderLeft: `4px solid ${isOngoing ? '#F57C00' : '#757575'}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, color: '#333', marginBottom: '0.25rem' }}>
                                                    {absence.reason}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                    {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {isOngoing ? (
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F57C00', background: '#FFF3E0', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                                        PROBÍHÁ
                                                    </span>
                                                ) : daysUntil > 0 ? (
                                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                                        Za {daysUntil} {daysUntil === 1 ? 'den' : daysUntil <= 4 ? 'dny' : 'dní'}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="dashboard-card" style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
                        Žádné nadcházející absence.
                    </div>
                )}
            </section>


        </div>
    );
}
