import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

const DAYS_CZ = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

// Default shift hours
const DEFAULT_NIGHT_HOURS = 11; // 18:00 - 05:00
const DEFAULT_DAY_HOURS = 8;   // ~9:00 - 17:00

export default function StatisticsPage() {
  const { currentUser, userData } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shiftsData, setShiftsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null); // { day, uid }
  const [editValue, setEditValue] = useState('');

  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'Velitel', 'VD'].includes(r));

  const getMonthDocId = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentDocId = getMonthDocId(currentDate);

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

  const handleMonthChange = (offset) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  // Get all days in month
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 1; i <= daysCount; i++) {
      const d = new Date(year, month, i);
      result.push({
        date: i,
        dayName: DAYS_CZ[d.getDay()],
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      });
    }
    return result;
  };

  const days = getDaysInMonth();

  // Collect all unique users from shifts this month
  const getAllUsers = () => {
    const users = new Map();
    Object.values(shiftsData).forEach(dayData => {
      ['dayShift', 'nightShift'].forEach(shiftType => {
        const shift = dayData[shiftType] || {};
        Object.values(shift).forEach(user => {
          if (user && user.uid) {
            users.set(user.uid, user.name);
          }
        });
      });
    });
    return Array.from(users, ([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
  };

  const users = getAllUsers();

  // Get split hours for a user on a specific day
  const getSplitHoursForUser = (day, uid) => {
    try {
      const dayData = shiftsData[day] || {};
      
      // Check for explicit overrides
      const h = dayData.hours ? dayData.hours[uid] : null;
      let explicitDay = undefined;
      let explicitNight = undefined;

      if (h) {
          if (typeof h.day === 'number') explicitDay = h.day;
          if (typeof h.night === 'number') explicitNight = h.night;
          
          // Legacy format support
          if (h.hours !== undefined) {
             // Treat 'hours' as total, splits undefined
             // This is tricky, assume total override? 
             // Ideally we migrate, but for now let's just use it as 'explicitDay' fallback if typically day?
             // Or ignoring legacy specific split logic for simplicity and assume clean data from now on.
             // Let's assume new data structure is dominant. 
          }
      }

      // Check existence in shifts
      const nightShift = dayData.nightShift || {};
      const hasNightShift = Object.values(nightShift).some(u => u && u.uid === uid);

      const dayShift = dayData.dayShift || {};
      const hasDayShift = Object.values(dayShift).some(u => u && u.uid === uid);

      // Calculate final hours
      // If explicit is set (even 0), use it. If undefined, use default based on shift presence.
      const dayHours = explicitDay !== undefined ? explicitDay : (hasDayShift ? DEFAULT_DAY_HOURS : 0);
      const nightHours = explicitNight !== undefined ? explicitNight : (hasNightShift ? DEFAULT_NIGHT_HOURS : 0);
      
      return { 
          day: dayHours, 
          night: nightHours, 
          total: dayHours + nightHours, 
          isExplicit: !!h // Flag that some override exists
      };

    } catch (err) {
      console.error("Error calculating split hours:", err);
      return { day: 0, night: 0, total: 0, isExplicit: false };
    }
  };

  // Helper for total only (backward compat)
  const getHoursForUser = (day, uid) => {
    return getSplitHoursForUser(day, uid).total;
  };

  // Get shift description for a day
  const getShiftDescription = (day) => {
    const dayData = shiftsData[day] || {};
    const parts = [];
    
    if (dayData.nightShift && Object.keys(dayData.nightShift).length > 0) {
      const crew = Object.values(dayData.nightShift).map(u => u?.name?.split(' ')[0]).filter(Boolean).join(', ');
      if (crew) parts.push(`Noční: ${crew}`);
    }
    if (dayData.dayShift && Object.keys(dayData.dayShift).length > 0) {
      const crew = Object.values(dayData.dayShift).map(u => u?.name?.split(' ')[0]).filter(Boolean).join(', ');
      if (crew) parts.push(`Denní: ${crew}`);
    }
    
    return parts.join(' | ') || '-';
  };

  // Check if date is in future (relative to today)
  const isDateInFuture = (day) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const checkDate = new Date(year, month, day);
    checkDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    return checkDate > today;
  };

  // Calculate totals - ONLY PAST/TODAY
  const getTotalHoursForUser = (uid) => {
    return days.reduce((sum, day) => {
      if (isDateInFuture(day.date)) return sum;
      return sum + getHoursForUser(day.date, uid);
    }, 0);
  };
  
  const getSplitTotalHoursForUser = (uid) => {
    return days.reduce((acc, day) => {
      if (isDateInFuture(day.date)) return acc;
      const split = getSplitHoursForUser(day.date, uid);
      return { day: acc.day + split.day, night: acc.night + split.night, total: acc.total + split.total };
    }, { day: 0, night: 0, total: 0 });
  };

  const getTotalHoursForDay = (day) => {
    // For single day, we just show what it is (even if future, for planning view)
    // But if we want accurate 'Stats' strictly, maybe we should return 0?
    // User req: "Statistics should only contain days before..." 
    // Usually table rows are "Data", totals are "Statistics". 
    // I entered this thinking I'd filter aggregated totals but keep row data visible.
    // If I filter this, the column "Hodiny" would be 0 for future days? 
    // Let's keep this as raw day total for now, but ensure Grand Total sums rely on user totals which ARE filtered.
    return users.reduce((sum, user) => sum + getHoursForUser(day, user.uid), 0);
  };

  const getGrandTotal = () => {
    // Sums up user totals (which are already filtered)
    return users.reduce((sum, user) => sum + getTotalHoursForUser(user.uid), 0);
  };
  
  const getGrandSplitTotal = () => {
    return users.reduce((acc, user) => {
      const split = getSplitTotalHoursForUser(user.uid);
      return { day: acc.day + split.day, night: acc.night + split.night, total: acc.total + split.total };
    }, { day: 0, night: 0, total: 0 });
  };

  // Handle hour editing - supports partial updates
  const handleHourEdit = async (day, uid, type, value) => {
    try {
      const current = getSplitHoursForUser(day, uid);
      
      const update = {
        day: current.day,
        night: current.night
      };
      
      if (type === 'day') {
        update.day = parseInt(value) || 0;
      } else if (type === 'night') {
        update.night = parseInt(value) || 0;
      }
      
      // If passing just number (legacy call), assume direct total (should not happen with new modal)
      if (typeof type === 'number') {
         // Fallback legacy behavior
         update.day = 0;
         update.night = 0;
         // Actually better to not support this or treat as total override if possible.
         // But for now, let's stick to split logic.
      }

      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, {
        days: {
          [day]: {
            hours: {
              [uid]: update
            }
          }
        }
      }, { merge: true });
    } catch (err) {
      console.error("Error updating hours:", err);
    }
  };

  // Edit Modal Component
  const EditHoursModal = ({ day, onClose }) => {
    const dayData = shiftsData[day] || {};
    
    // Get unique users and their shifts
    const usersMap = new Map();
    
    try {
      // 1. Add users from active shifts
      ['dayShift', 'nightShift'].forEach(shiftType => {
        const shift = dayData[shiftType] || {};
        Object.keys(shift).forEach(slot => {
          const user = shift[slot];
          if (user && user.uid) {
            if (!usersMap.has(user.uid)) {
              usersMap.set(user.uid, { ...user, shifts: [shiftType] });
            } else {
              const existing = usersMap.get(user.uid);
              if (!existing.shifts.includes(shiftType)) {
                existing.shifts.push(shiftType);
              }
            }
          }
        });
      });

      // 2. Add users who have explicit hours set (Ghost Hours)
      if (dayData.hours) {
          Object.keys(dayData.hours).forEach(uid => {
             if (!usersMap.has(uid)) {
                 // Fetch name from full user list if possible, or fallback
                 const userFromList = users.find(u => u.uid === uid);
                 const name = userFromList ? userFromList.name : 'Neznámý uživatel';
                 usersMap.set(uid, { uid, name, shifts: [] }); // Empty shifts array = ghost
             }
          });
      }

    } catch (err) {
      console.error("Error processing modal users:", err);
    }

    const uniqueUsers = Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }} onClick={onClose}>
        <div style={{
          background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '600px'
        }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 1rem 0' }}>Upravit hodiny - {day}. {MONTHS_CZ[currentDate.getMonth()]}</h3>
          
          {uniqueUsers.length === 0 ? (
            <p>Žádné směny v tento den.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
              {uniqueUsers.map(user => {
                const split = getSplitHoursForUser(day, user.uid);
                const hasDay = user.shifts.includes('dayShift');
                const hasNight = user.shifts.includes('nightShift');

                return (
                  <div key={user.uid} style={{ padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>{user.name}</div>
                    
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {/* Night Control */}
                      <div style={{ flex: 1, minWidth: '140px', opacity: hasNight ? 1 : 0.6 }}>
                        <div style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          🌙 Noční sm. {(!hasNight && split.night === 0) && '(neobsazeno)'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            disabled={split.night <= 0}
                            onClick={() => handleHourEdit(day, user.uid, 'night', Math.max(0, split.night - 1))}
                          >-</button>
                          <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.1rem' }}>{split.night}h</span>
                          <button 
                             className="btn btn-secondary btn-sm"
                             disabled={!hasNight} // Prevent increasing if not in shift
                             title={!hasNight ? "Nelze přidat hodiny bez směny" : ""}
                             onClick={() => handleHourEdit(day, user.uid, 'night', split.night + 1)}
                          >+</button>
                        </div>
                      </div>

                      {/* Day Control */}
                      <div style={{ flex: 1, minWidth: '140px', opacity: hasDay ? 1 : 0.6 }}>
                         <div style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ☀️ Denní sm. {(!hasDay && split.day === 0) && '(neobsazeno)'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            disabled={split.day <= 0}
                            onClick={() => handleHourEdit(day, user.uid, 'day', Math.max(0, split.day - 1))}
                          >-</button>
                          <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.1rem' }}>{split.day}h</span>
                          <button 
                             className="btn btn-secondary btn-sm"
                             disabled={!hasDay} // Prevent increasing if not in shift
                             title={!hasDay ? "Nelze přidat hodiny bez směny" : ""}
                             onClick={() => handleHourEdit(day, user.uid, 'day', split.day + 1)}
                          >+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={onClose}>Hotovo</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mt-4 flex-center" style={{ minHeight: '300px' }}>
        <p>Načítám statistiky...</p>
      </div>
    );
  }

  const maxUserHours = Math.max(...users.map(u => getTotalHoursForUser(u.uid)), 1);

  return (
    <div className="container mt-4" style={{ maxWidth: '1200px', paddingBottom: '3rem' }}>
      
      {/* 1. Month Navigation Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #2c3e50, #455a64)', 
        borderRadius: '12px', 
        padding: '1.5rem', 
        color: 'white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button 
          className="btn" 
          onClick={() => handleMonthChange(-1)}
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          ← Předchozí
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.5rem', letterSpacing: '1px' }}>
            {MONTHS_CZ[currentDate.getMonth()]} <span style={{ opacity: 0.7 }}>{currentDate.getFullYear()}</span>
          </h2>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Přehled služeb a hodin
          </div>
        </div>
        <button 
          className="btn" 
          onClick={() => handleMonthChange(1)}
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          Další →
        </button>
      </div>

      {/* 2. KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <StatCard 
          icon="⏱️"
          value={getGrandTotal().toString()}
          label="Celkem hodin"
          sublabel="Tento měsíc"
          color="#D32F2F"
          bg="rgba(211, 47, 47, 0.08)"
        />
        <StatCard 
          icon="👥"
          value={users.filter(u => getTotalHoursForUser(u.uid) > 0).length.toString()}
          label="Aktivních členů"
          sublabel="S odpracovanými hodinami"
          color="#1976D2"
          bg="rgba(25, 118, 210, 0.08)"
        />
        <StatCard 
          icon="📊"
          value={(users.filter(u => getTotalHoursForUser(u.uid) > 0).length > 0 ? Math.round(getGrandTotal() / users.filter(u => getTotalHoursForUser(u.uid) > 0).length) : 0).toString()}
          label="Průměr na člena"
          sublabel="Průměrný počet hodin"
          color="#388E3C"
          bg="rgba(56, 142, 60, 0.08)"
        />
        <StatCard 
          icon="📅"
          value={days.filter(d => getTotalHoursForDay(d.date) > 0).length.toString()}
          label="Odsloužených dnů"
          sublabel="Dny s alespoň 1 službou"
          color="#F57C00"
          bg="rgba(245, 124, 0, 0.08)"
        />
      </div>

      {/* 3. Detailed Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* LEADERBOARD */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
          <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>🏆 Top 5 Hasičů</h3>
          </div>
          <div style={{ padding: '0.5rem 1rem' }}>
            {users
              .filter(user => getTotalHoursForUser(user.uid) > 0)
              .sort((a, b) => getTotalHoursForUser(b.uid) - getTotalHoursForUser(a.uid))
              .slice(0, 5)
              .map((user, i) => {
                const hours = getTotalHoursForUser(user.uid);
                const pct = (hours / (maxUserHours || 1)) * 100;
                const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
                return (
                  <div key={user.uid} style={{ 
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0', 
                    borderBottom: i < 4 ? '1px dashed #eee' : 'none' 
                  }}>
                    <div style={{ 
                      width: '36px', height: '36px', 
                      borderRadius: '50%', background: i < 3 ? '#FFF8E1' : '#f5f5f5', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', fontWeight: 700,
                      color: i < 3 ? '#FFC107' : '#999'
                    }}>
                      {i < 3 ? medals[i] : i + 1}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{user.name}</div>
                      <div style={{ width: '100%', height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? '#D32F2F' : (i === 1 ? '#F57C00' : '#1976D2'), borderRadius: '3px' }} />
                      </div>
                    </div>
                    
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333' }}>{hours}h</div>
                  </div>
                );
              })}
              {users.every(u => getTotalHoursForUser(u.uid) === 0) && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Zatím nejsou žádná data</div>
              )}
          </div>
        </div>

        {/* MEMBER LIST */}
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
           <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>👥 Přehled členů</h3>
          </div>
          <div style={{ 
            padding: '1rem', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '1rem',
            maxHeight: '500px',
            overflowY: 'auto'
          }}>
            {users
              .filter(user => getTotalHoursForUser(user.uid) > 0)
              .sort((a, b) => getTotalHoursForUser(b.uid) - getTotalHoursForUser(a.uid))
              .map(user => {
                const split = getSplitTotalHoursForUser(user.uid);
                const isMe = user.uid === currentUser?.uid;
                const hours = getTotalHoursForUser(user.uid);
                
                return (
                  <div key={user.uid} style={{ 
                    padding: '1rem', borderRadius: '10px', 
                    border: isMe ? '2px solid #81C784' : '1px solid #e0e0e0',
                    background: isMe ? '#F1F8E9' : 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600, color: '#333' }}>{isMe && '⭐ '}{user.name}</span>
                      <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#333' }}>{hours}h</span>
                    </div>
                    
                    {/* Tiny breakdown */}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {split.day > 0 && (
                        <span style={{ 
                          fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', 
                          background: '#FFF3E0', color: '#E65100', fontWeight: 600 
                        }}>
                          ☀️ {split.day}
                        </span>
                      )}
                      {split.night > 0 && (
                        <span style={{ 
                          fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', 
                          background: '#E8EAF6', color: '#3949AB', fontWeight: 600 
                        }}>
                          🌙 {split.night}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* 4. Full Data Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>📅 Denní záznamy</h3>
            <span style={{ fontSize: '0.85rem', color: '#777' }}>Detailní rozpis hodin</span>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#555', fontWeight: 600 }}>Datum</th>
                <th style={{ padding: '1rem', textAlign: 'left', color: '#555', fontWeight: 600 }}>Složení směny</th>
                <th style={{ padding: '1rem', textAlign: 'center', color: '#555', fontWeight: 600 }}>Celkem hodin</th>
                {isAdmin && <th style={{ padding: '1rem', textAlign: 'center', color: '#555', fontWeight: 600 }}>Akce</th>}
              </tr>
            </thead>
            <tbody>
              {days.map(day => {
                const inFuture = isDateInFuture(day.date);
                const totalHours = !inFuture ? getTotalHoursForDay(day.date) : 0;
                const desc = !inFuture ? getShiftDescription(day.date) : '';
                const hasShift = desc !== '-' && desc !== '';
                
                return (
                  <tr 
                    key={day.date} 
                    style={{ 
                      background: day.isWeekend ? '#fafafa' : 'white',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, opacity: inFuture ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: '25px', textAlign: 'center', marginRight: '4px', fontWeight: 700, color: day.isWeekend ? '#e53935' : '#333' }}>
                        {day.date}.
                      </span> 
                      <span style={{ textTransform: 'capitalize', color: '#777' }}>{day.dayName}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {inFuture ? (
                        <span style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>Budoucí datum</span>
                      ) : (
                        desc !== '-' ? <span style={{ color: '#333' }}>{desc}</span> : <span style={{ color: '#ccc' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {totalHours > 0 ? (
                        <span style={{ fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem' }}>
                          {totalHours}h
                        </span>
                      ) : '-'}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {hasShift && (
                          <button 
                            onClick={() => setEditingCell(day.date)}
                            style={{
                              background: 'white', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontSize: '0.9rem'
                            }}
                            title="Upravit hodiny"
                          >
                            ✏️
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#37474F', color: 'white' }}>
                <td style={{ padding: '1rem', fontWeight: 700 }} colSpan={2}>
                  MĚSÍČNÍ SOUČET
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{getGrandTotal()}h</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                      (☀️ {getGrandSplitTotal().day} + 🌙 {getGrandSplitTotal().night})
                    </div>
                </td>
                {isAdmin && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editingCell && (
        <EditHoursModal day={editingCell} onClose={() => setEditingCell(null)} />
      )}
    </div>
  );
}

// Helper Card
function StatCard({ icon, value, label, sublabel, color, bg }) {
  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
      <div style={{ 
        width: '60px', height: '60px', borderRadius: '50%', background: bg, color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#333', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#555', marginTop: '4px' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: '#999' }}>{sublabel}</div>
      </div>
    </div>
  );
}
