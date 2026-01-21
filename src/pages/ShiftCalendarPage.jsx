import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, deleteField } from 'firebase/firestore';

const DAYS_CZ = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

// Slot types configuration
const SLOT_TYPES = ['velitel', 'strojnik', 'hasic1', 'hasic2', 'hasic3'];
const SLOT_LABELS = {
  velitel: '⭐ Velitel',
  strojnik: '🚒 Strojník',
  hasic1: '🧑‍🚒 Hasič 1',
  hasic2: '🧑‍🚒 Hasič 2',
  hasic3: '🧑‍🚒 Hasič 3',
};

export default function ShiftCalendarPage() {
  const { currentUser, userData } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shiftsData, setShiftsData] = useState({});
  const [loading, setLoading] = useState(true);
  
  // For adding new day shifts
  const [newDayShiftDate, setNewDayShiftDate] = useState('');
  
  // Toast notification state
  const [toast, setToast] = useState(null); // { type: 'error'|'warning'|'success'|'info', message: string }
  
  // Modal state for confirmations
  const [modal, setModal] = useState(null); // { title, message, onConfirm, onCancel }
  
  // Vehicle assignment modal
  const [vehicleModal, setVehicleModal] = useState(null); // { day, section, vehicleId, currentAssignees }

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
    if (slotType === 'velitel') return userRoles.some(r => ['VD', 'VJ', 'Zástupce VJ', 'Admin'].includes(r));
    if (slotType === 'strojnik') return userRoles.some(r => ['Strojník', 'Admin'].includes(r));
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
      } else if (userRoles.includes('Admin') || userRoles.includes('VJ')) {
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
        showToast('warning', `Již máte službu na této směně (${SLOT_LABELS[existingUserSlot]}). Nejprve se odhlaste.`);
        return;
      }

      // Strojník is STRICT - must be qualified
      if (slotKey === 'strojnik' && !isQualifiedFor(slotKey)) {
        showToast('error', 'Pro pozici Strojník musíte mít kvalifikaci Strojník.');
        return;
      }

      // Velitel can have unqualified (yellow) with warning
      if (slotKey === 'velitel' && !isQualifiedFor(slotKey)) {
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

    try {
      const docRef = doc(db, 'shifts', currentDocId);
      await setDoc(docRef, { days: { [day]: newData } }, { merge: true });
      showToast('success', 'Služba uložena.');
    } catch (err) {
      console.error("Error updating shift:", err);
      showToast('error', 'Chyba při ukládání služby.');
    }
  };

  // Get only days that have dayShift enabled (have dayShift object with any keys or explicitly enabled)
  const enabledDayShifts = days.filter(day => {
    const dayData = shiftsData[day.date];
    return dayData && (dayData.dayShiftEnabled || (dayData.dayShift && Object.keys(dayData.dayShift).length > 0));
  });

  // Remove an empty day shift
  const handleRemoveDayShift = async (date) => {
    // Double check it's empty
    const dayData = shiftsData[date] || {};
    const currentShift = dayData.dayShift || {};
    if (Object.keys(currentShift).length > 0) {
      showToast('error', 'Nelze odebrat denní službu, která má přiřazené lidi.');
      return;
    }

    const confirmed = await showConfirm('Odebrat denní službu', `Opravdu chcete zrušit denní službu pro ${date}. ${MONTHS_CZ[currentDate.getMonth()]}?`);
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
      showToast('success', 'Denní služba odebrána.');
    } catch (err) {
      console.error("Error removing day shift:", err);
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
      showToast('success', `Denní služba pro ${dateNum}. ${MONTHS_CZ[currentDate.getMonth()]} vytvořena.`);
      setNewDayShiftDate('');
    } catch (err) {
      console.error("Error adding day shift:", err);
      showToast('error', 'Chyba při vytváření denní služby.');
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
          border: `1px solid ${
            toast.type === 'error' ? '#EF9A9A' :
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={() => handleMonthChange(-1)}>← Předchozí</button>
        <h2 style={{ margin: 0, textTransform: 'uppercase' }}>{MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        <button className="btn btn-secondary" onClick={() => handleMonthChange(1)}>Další →</button>
      </div>

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
          <h3 style={{ margin: 0, fontSize: '1rem' }}>☀️ DENNÍ SLUŽBY (od 9:00)</h3>
          <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            {enabledDayShifts.length} služeb
          </span>
        </div>
        
        <div style={{ border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {enabledDayShifts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
              Zatím nebyly vytvořeny žádné denní služby.
            </div>
          ) : (
            enabledDayShifts.map(day => (
              <React.Fragment key={`day-${day.date}`}>
                <ShiftRow 
                  day={day}
                  sectionData={shiftsData[day.date]?.dayShift || {}}
                  section="dayShift"
                  onSlotClick={handleSlotClick}
                  currentUser={currentUser}
                  onRemoveDayShift={handleRemoveDayShift}
                />
                {day.dayOfWeek === 0 && (
                   <div style={{ position: 'relative', margin: '1.25rem 0', textAlign: 'center' }}>
                     <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderBottom: '1px dashed #e0e0e0', zIndex: 0 }} />
                     <span style={{ position: 'relative', zIndex: 1, background: '#fff', padding: '0 0.75rem', color: '#bbb', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                       Konec týdne
                     </span>
                   </div>
                )}
              </React.Fragment>
            ))
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
          <h3 style={{ margin: 0, fontSize: '1rem' }}>🌙 NOČNÍ SLUŽBY (od 18:00)</h3>
          <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{days.length} dnů</span>
        </div>
        
        <div style={{ border: '1px solid #eee', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {days.map((day, index) => (
            <React.Fragment key={`night-${day.date}`}>
              <ShiftRow 
                day={day}
                sectionData={shiftsData[day.date]?.nightShift || {}}
                section="nightShift"
                onSlotClick={handleSlotClick}
                currentUser={currentUser}
              />
              {day.dayOfWeek === 0 && index !== days.length - 1 && (
                   <div style={{ position: 'relative', margin: '1.25rem 0', textAlign: 'center' }}>
                     <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderBottom: '1px dashed #e0e0e0', zIndex: 0 }} />
                     <span style={{ position: 'relative', zIndex: 1, background: '#fff', padding: '0 0.75rem', color: '#bbb', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                       Konec týdne
                     </span>
                   </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}

// Single Row Component
function ShiftRow({ day, sectionData, section, onSlotClick, currentUser, onRemoveDayShift }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // Check if shift is empty (no users assigned)
  const isEmpty = !sectionData || Object.keys(sectionData).length === 0;
  const canRemove = section === 'dayShift' && onRemoveDayShift && isEmpty;

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'stretch',
      background: day.isToday ? '#FFFDE7' : (day.isWeekend ? '#f9f9f9' : 'white'),
      margin: isMobile ? '0.25rem' : '0.5rem',
      borderRadius: isMobile ? '6px' : '8px',
      border: day.isToday ? '2px solid #FFC107' : (day.isWeekend ? '1px solid #FFCC80' : '1px solid #e0e0e0'),
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* Date Column */}
      <div style={{ 
        width: isMobile ? '50px' : '80px', 
        minWidth: isMobile ? '50px' : '80px',
        padding: isMobile ? '0.4rem' : '0.75rem',
        borderRight: '1px solid #eee',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: isMobile ? 'center' : 'flex-start',
        background: day.isToday ? '#FFC107' : (day.isWeekend ? '#FFF3E0' : 'transparent'),
        color: day.isToday ? '#000' : (day.isWeekend ? '#E65100' : 'inherit'),
        borderRadius: isMobile ? '5px 0 0 5px' : '7px 0 0 7px',
        position: 'relative'
      }}>
        <div style={{ fontWeight: 700, fontSize: isMobile ? '1rem' : '1.1rem' }}>{day.date}.</div>
        <div style={{ fontSize: isMobile ? '0.6rem' : '0.75rem', textTransform: 'capitalize', opacity: 0.8 }}>
          {isMobile ? day.dayName.slice(0, 2) : day.dayName}
        </div>
        
        {canRemove && (
            <button
                onClick={(e) => { e.stopPropagation(); onRemoveDayShift(day.date); }}
                title="Odebrat prázdnou službu"
                style={{
                    position: 'absolute',
                    top: isMobile ? '2px' : '4px',
                    right: isMobile ? '2px' : '4px',
                    width: isMobile ? '18px' : '22px',
                    height: isMobile ? '18px' : '22px',
                    border: 'none',
                    background: 'rgba(255, 235, 238, 0.9)', // Light red background
                    color: '#c62828',
                    borderRadius: '50%',
                    fontSize: isMobile ? '1.1rem' : '1.3rem',
                    lineHeight: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 0 2px 0', // Slight optical adjustment for 'x'
                    zIndex: 2,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ffcdd2'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 235, 238, 0.9)'; e.currentTarget.style.transform = 'scale(1)'; }}
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
        gap: isMobile ? '0.25rem' : '0.5rem',
        padding: isMobile ? '0.25rem' : '0.5rem'
      }}>
        {SLOT_TYPES.map(slotKey => {
          const assignee = sectionData[slotKey];
          const isSelf = assignee?.uid === currentUser?.uid;
          
          return (
            <SlotChip 
              key={slotKey}
              label={SLOT_LABELS[slotKey]}
              assignee={assignee}
              isSelf={isSelf}
              onClick={() => onSlotClick(day.date, section, slotKey)}
              compact={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}
// Slot Chip Component
function SlotChip({ label, assignee, isSelf, onClick, compact = false }) {
  let bgColor = '#f5f5f5';
  let textColor = '#666';
  let borderColor = '#e0e0e0';
  
  const isUnqualified = assignee && assignee.qualified === false;

  if (isSelf) {
    if (isUnqualified) {
      bgColor = '#FFF3E0';
      textColor = '#E65100';
      borderColor = '#FFB74D';
    } else {
      bgColor = '#C8E6C9';
      textColor = '#1B5E20';
      borderColor = '#81C784';
    }
  } else if (assignee) {
    if (isUnqualified) {
      bgColor = '#FFF8E1';
      textColor = '#F57C00';
      borderColor = '#FFCC80';
    } else {
      bgColor = '#FFCDD2';
      textColor = '#B71C1C';
      borderColor = '#EF9A9A';
    }
  }

  return (
    <div 
      onClick={onClick}
      style={{
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: compact ? '4px' : '6px',
        padding: compact ? '0.2rem 0.35rem' : '0.4rem 0.6rem',
        fontSize: compact ? '0.7rem' : '0.8rem',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '0.15rem' : '0.25rem',
        transition: 'transform 0.1s, box-shadow 0.1s',
        minWidth: compact ? '70px' : '100px'
      }}
      onMouseEnter={(e) => { if (!compact) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; }}}
      onMouseLeave={(e) => { if (!compact) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}}
    >
      <span style={{ fontSize: compact ? '0.7rem' : '0.9rem' }}>{label.split(' ')[0]}</span>
      <span style={{ 
        fontWeight: 600, 
        color: textColor, 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap',
        maxWidth: compact ? '45px' : 'none'
      }}>
        {assignee ? (compact ? assignee.name.split(' ')[0] : assignee.name) : (compact ? '-' : <span style={{ color: '#999', fontStyle: 'italic' }}>Volno</span>)}
      </span>
    </div>
  );
}
