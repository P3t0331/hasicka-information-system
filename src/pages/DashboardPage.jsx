import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';

export default function DashboardPage() {
    const { currentUser, userData } = useAuth();
    const navigate = useNavigate();
    const [allShifts, setAllShifts] = useState([]);
    const [upcomingActivities, setUpcomingActivities] = useState([]);
    const [loading, setLoading] = useState(true);

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

        return () => {
            unsub1();
            unsub2();
            trainingsUnsub();
            eventsUnsub();
        };
    }, [currentUser]);

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

            {/* Quick Actions Grid */}
            <section style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Rychlá navigace</h2>
                <div className="dashboard-grid">
                    <Link to="/shifts" className="action-card">
                        <span style={{ fontSize: '1.5rem' }}>📅</span>
                        <span>Služby</span>
                    </Link>
                    <Link to="/skoleni" className="action-card">
                        <span style={{ fontSize: '1.5rem' }}>📚</span>
                        <span>Školení</span>
                    </Link>
                    <Link to="/akce" className="action-card">
                        <span style={{ fontSize: '1.5rem' }}>🚩</span>
                        <span>Akce</span>
                    </Link>
                    <Link to="/profile" className="action-card">
                        <span style={{ fontSize: '1.5rem' }}>👤</span>
                        <span>Profil</span>
                    </Link>
                </div>
            </section>
        </div>
    );
}
