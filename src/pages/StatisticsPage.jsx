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
      let dayHours = 0;
      let nightHours = 0;
      
      // Check explicit hours
      if (dayData && dayData.hours && dayData.hours[uid]) {
        const h = dayData.hours[uid];
        // Handle both old format (h.hours number or object) and new format (h.day/h.night)
        if (h && (typeof h.day === 'number' || typeof h.night === 'number')) {
           dayHours = h.day || 0;
           nightHours = h.night || 0;
           return { day: dayHours, night: nightHours, total: dayHours + nightHours, isExplicit: true };
        } else if (h && (h.hours !== undefined)) {
           // Old format - legacy support
           return { day: 0, night: 0, total: parseInt(h.hours) || 0, isExplicit: true };
        } else if (typeof h === 'number') {
           // Very old format just in case
           return { day: 0, night: 0, total: h, isExplicit: true };
        }
      }
      
      // Calculate default
      const nightShift = dayData.nightShift || {};
      if (Object.values(nightShift).some(u => u && u.uid === uid)) {
        nightHours += DEFAULT_NIGHT_HOURS;
      }
      
      const dayShift = dayData.dayShift || {};
      if (Object.values(dayShift).some(u => u && u.uid === uid)) {
        dayHours += DEFAULT_DAY_HOURS;
      }
      
      return { day: dayHours, night: nightHours, total: dayHours + nightHours, isExplicit: false };
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
    } catch (err) {
      console.error("Error processing modal users:", err);
    }

    const uniqueUsers = Array.from(usersMap.values());

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
                            // Enable edit if assigned OR if explicit hours exist > 0 to allow correction
                            disabled={!hasNight && split.night === 0}
                            onClick={() => handleHourEdit(day, user.uid, 'night', Math.max(0, split.night - 1))}
                          >-</button>
                          <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.1rem' }}>{split.night}h</span>
                          <button 
                             className="btn btn-secondary btn-sm"
                             disabled={!hasNight && split.night === 0}
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
                            disabled={!hasDay && split.day === 0}
                            onClick={() => handleHourEdit(day, user.uid, 'day', Math.max(0, split.day - 1))}
                          >-</button>
                          <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.1rem' }}>{split.day}h</span>
                          <button 
                             className="btn btn-secondary btn-sm"
                             disabled={!hasDay && split.day === 0}
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
    <div className="container mt-4" style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={() => handleMonthChange(-1)}>← Předchozí</button>
        <h2 style={{ margin: 0, textTransform: 'uppercase' }}>📊 Statistiky - {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        <button className="btn btn-secondary" onClick={() => handleMonthChange(1)}>Další →</button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, #D32F2F, #B71C1C)', color: 'white' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{getGrandTotal()}</div>
          <div style={{ opacity: 0.9 }}>Celkem hodin</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, #1976D2, #0D47A1)', color: 'white' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{users.filter(u => getTotalHoursForUser(u.uid) > 0).length}</div>
          <div style={{ opacity: 0.9 }}>Aktivních členů (s hodinami)</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, #388E3C, #1B5E20)', color: 'white' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{users.filter(u => getTotalHoursForUser(u.uid) > 0).length > 0 ? Math.round(getGrandTotal() / users.filter(u => getTotalHoursForUser(u.uid) > 0).length) : 0}</div>
          <div style={{ opacity: 0.9 }}>Průměr na člena</div>
        </div>
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', background: 'linear-gradient(135deg, #F57C00, #E65100)', color: 'white' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{days.filter(d => getTotalHoursForDay(d.date) > 0).length}</div>
          <div style={{ opacity: 0.9 }}>Dnů se službou (uplynulé)</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Per-person breakdown (moved from bottom) */}
        <div className="card" style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>👤 Hodiny podle člena (jen odsloužené)</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
            {users
              .filter(user => getTotalHoursForUser(user.uid) > 0)
              .sort((a, b) => getTotalHoursForUser(b.uid) - getTotalHoursForUser(a.uid))
              .map(user => {
              const split = getSplitTotalHoursForUser(user.uid);
              const isMe = user.uid === currentUser?.uid;
              return (
                <div 
                  key={user.uid}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: isMe ? 'linear-gradient(135deg, #C8E6C9, #A5D6A7)' : '#f5f5f5',
                    border: isMe ? '2px solid #4CAF50' : '1px solid #e0e0e0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontWeight: isMe ? 700 : 500 }}>{isMe && '⭐ '}{user.name}</span>
                     <span style={{ fontWeight: 700, color: split.total > 0 ? '#1B5E20' : '#999', fontSize: '1.1rem' }}>{split.total}h</span>
                  </div>
                  {(split.day > 0 || split.night > 0) && (
                     <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {split.day > 0 && <span>☀️ {split.day}h</span>}
                        {split.night > 0 && <span>🌙 {split.night}h</span>}
                     </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Leaderboard */}
        <div className="card" style={{ padding: '1rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>🥇 Nejvíce odslouženo</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users
              .filter(user => getTotalHoursForUser(user.uid) > 0)
              .sort((a, b) => getTotalHoursForUser(b.uid) - getTotalHoursForUser(a.uid))
              .slice(0, 5)
              .map((user, i) => {
                const hours = getTotalHoursForUser(user.uid);
                const pct = (hours / (maxUserHours || 1)) * 100;
                const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
                return (
                  <div key={user.uid} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '24px', textAlign: 'center' }}>{medals[i]}</span>
                    <span style={{ flex: 1, fontWeight: 500 }}>{user.name}</span>
                    <div style={{ width: '100px', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#D32F2F', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontWeight: 700, minWidth: '40px', textAlign: 'right' }}>{hours}h</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Full Table */}
      <div className="card" style={{ padding: '1rem', overflowX: 'auto' }}>
        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>📋 Detailní přehled</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#D32F2F', color: 'white' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left', position: 'sticky', left: 0, background: '#D32F2F' }}>Den</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Popis směny</th>
              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Hodiny</th>
              {isAdmin && <th style={{ padding: '0.5rem', textAlign: 'center', width: '50px' }}>Akce</th>}
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
                    background: day.isWeekend ? '#FFF3E0' : (hasShift ? '#E8F5E9' : 'white'),
                    borderBottom: '1px solid #eee',
                    opacity: inFuture ? 0.5 : 1
                  }}
                >
                  <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                    {day.date}. {day.dayName}
                  </td>
                  <td style={{ padding: '0.5rem', color: hasShift ? '#333' : '#999', fontStyle: inFuture ? 'italic' : 'normal' }}>
                    {inFuture ? 'Budoucí datum' : desc}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: totalHours > 0 ? '#1B5E20' : '#999' }}>
                    {totalHours > 0 ? `${totalHours}h` : '-'}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      {hasShift && (
                        <button 
                          onClick={() => setEditingCell(day.date)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.6
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
            <tr style={{ background: '#263238', color: 'white', fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: '0.75rem' }}>
                CELKEM za {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}
              </td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.1rem' }}>{getGrandTotal()}h</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 400 }}>
                    (☀️ {getGrandSplitTotal().day}h + 🌙 {getGrandSplitTotal().night}h)
                  </span>
                </div>
              </td>
              {isAdmin && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>



      {/* Edit Modal */}
      {editingCell && (
        <EditHoursModal 
          day={editingCell} 
          onClose={() => setEditingCell(null)} 
        />
      )}
    </div>
  );
}
