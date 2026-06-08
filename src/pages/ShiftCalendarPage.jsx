import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useShiftCalendar from '../hooks/useShiftCalendar';
import { MONTHS_CZ } from '../components/shifts/constants';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { logAction } from '../utils/logger';
import { generateICS, downloadICS, shiftSlotToICSEvent } from '../utils/icsExport';

// Subcomponents
import AbsencePanel from '../components/shifts/AbsencePanel';
import ShiftRow from '../components/shifts/ShiftRow';
import InlineActivities from '../components/shifts/InlineActivities';

// Modals
import AddAbsenceModal from '../components/shifts/modals/AddAbsenceModal';
import AddZalohaModal from '../components/shifts/modals/AddZalohaModal';
import ActivityPopup from '../components/shifts/modals/ActivityPopup';
import ZalohaAssignModal from '../components/shifts/modals/ZalohaAssignModal';
import RetroAssignModal from '../components/shifts/modals/RetroAssignModal';
import JoinShiftModal from '../components/shifts/modals/JoinShiftModal';

export default function ShiftCalendarPage() {
  const { currentUser, userData } = useAuth();
  
  const {
    currentDate,
    shiftsData,
    loading,
    newDayShiftDate,
    setNewDayShiftDate,
    zalohaModal,
    setZalohaModal,
    modal,
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
    showToast,
  } = useShiftCalendar(currentUser, userData);

  const [retroMode, setRetroMode] = useState(false);
  const [retroAssignModal, setRetroAssignModal] = useState(null);
  const [absenceTargetUser, setAbsenceTargetUser] = useState(null);
  const [absencePickerOpen, setAbsencePickerOpen] = useState(false);
  const [activityPickerOpen, setActivityPickerOpen] = useState(null);

  const handleRetroActivityAdd = async (user) => {
    if (!activityPickerOpen) return;
    const activity = activityPickerOpen;
    const collectionName = activity.type === 'training' ? 'trainings' : 'events';
    
    if (activity.maxParticipants && (activity.participants?.length || 0) >= parseInt(activity.maxParticipants)) {
       showToast('error', 'Kapacita je naplněna.');
       return;
    }
    
    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayUnion({
          uid: user.uid,
          name: `${user.firstName} ${user.lastName}`,
          joinedAt: new Date().toISOString()
        })
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akci';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'ADMIN_ADDED_TRAINING' : 'ADMIN_ADDED_EVENT', 'admin',
        `Admin přidal člena ${user.firstName} ${user.lastName} na ${typeLabel} „${activity.title}“ (${activity.date})`);
      showToast('success', `Uživatel přidán na ${typeLabel}.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Chyba při přidávání.');
    }
    setActivityPickerOpen(null);
  };

  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD', 'Přístup do Administrace'].includes(r));
  const isStrictAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'VD', 'Přístup do Administrace'].includes(r));
  const [joinShiftModal, setJoinShiftModal] = useState(null); // { day, section, slotKey }

  const handleShiftSlotClick = useCallback((day, section, slotKey) => {
    if (retroMode && isStrictAdmin) {
      const assignee = (shiftsData[day]?.[section] || {})[slotKey];
      if (!assignee) {
        setRetroAssignModal({ day, section, slotKey });
        return;
      }
    }

    // Show join params modal when user is joining an empty day/night slot
    const assignee = (shiftsData[day]?.[section] || {})[slotKey];
    if (!assignee && (section === 'dayShift' || section === 'nightShift')) {
      setJoinShiftModal({ day, section, slotKey });
      return;
    }

    handleSlotClick(day, section, slotKey);
  }, [retroMode, isStrictAdmin, shiftsData, handleSlotClick]);

  const handleExportShifts = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const events = [];

    Object.entries(shiftsData).forEach(([dayStr, dayData]) => {
      const day = parseInt(dayStr, 10);
      const sections = ['nightShift', 'dayShift', 'zalohaStaz'];
      sections.forEach(section => {
        const sectionData = dayData[section];
        if (!sectionData) return;
        const zalohaConfig = section === 'zalohaStaz' ? sectionData.config : undefined;
        Object.entries(sectionData).forEach(([slotKey, slotData]) => {
          if (slotKey === 'config' || slotKey === 'interested') return;
          if (slotData && slotData.uid === currentUser.uid) {
            events.push(shiftSlotToICSEvent(year, month, day, section, slotKey, slotData, zalohaConfig));
          }
        });
      });
    });

    if (events.length === 0) {
      showToast('info', 'V tomto měsíci nemáte žádné služby k exportu.');
      return;
    }

    const pad = n => String(n).padStart(2, '0');
    downloadICS(generateICS(events), `sluzby-${year}-${pad(month)}.ics`);
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
        <h2 style={{ margin: 0, textTransform: 'uppercase', color: 'white', fontSize: '1.1rem', letterSpacing: '1px', flex: 1, textAlign: 'center' }}>
          {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
      </div>

      {/* Export + optional retro row */}
      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={handleExportShifts}
          title="Exportovat mé služby do kalendáře (.ics)"
          style={{
            background: 'white', border: '1px solid #e0e0e0', borderRadius: '8px',
            padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem',
            color: '#555', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem',
            transition: 'all 0.2s'
          }}
        >
          📅 Export do kalendáře
        </button>
        {isStrictAdmin && (
          <button
            onClick={() => setRetroMode(r => !r)}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              border: retroMode ? '1px solid #FFB300' : '1px solid #e0e0e0',
              background: retroMode ? '#FFF8E1' : 'white',
              color: retroMode ? '#E65100' : '#666',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {retroMode ? '⏱ Admin mód: ZAP' : '⏱ Admin mód: VYP'}
          </button>
        )}
      </div>

      {/* Retro Mode Banner */}
      {retroMode && (
        <div style={{
          background: '#FFF8E1', border: '1px solid #FFB300', borderRadius: '8px',
          padding: '0.65rem 1rem', marginBottom: '1rem',
          fontSize: '0.85rem', color: '#E65100', fontWeight: 500
        }}>
          ⚠️ Admin mód je aktivní – kliknutím na prázdný slot přiřadíte libovolného člena.
        </div>
      )}

      {/* ABSENCE SUMMARY PANEL */}
      <AbsencePanel
        absencesData={absencesData}
        currentUser={currentUser}
        userRoles={userRoles}
        handleDeleteAbsence={handleDeleteAbsence}
        setAbsenceModal={setAbsenceModal}
        userData={userData}
        absencePanelOpen={absencePanelOpen}
        setAbsencePanelOpen={setAbsencePanelOpen}
        retroMode={retroMode}
        onAddAbsenceForOther={() => setAbsencePickerOpen(true)}
      />

      {/* Add Absence Modal */}
      {absenceModal && (
        <AddAbsenceModal
          existingAbsences={absencesData.filter(a => a.uid === (absenceTargetUser?.uid || currentUser?.uid))}
          targetUser={absenceTargetUser}
          onSubmit={(data) => handleAddAbsence({ ...data, targetUser: absenceTargetUser })}
          onClose={() => { setAbsenceModal(null); setAbsenceTargetUser(null); }}
        />
      )}

      {/* Add Zaloha Modal */}
      {zalohaModal && (
        <AddZalohaModal
          date={zalohaModal.date}
          onClose={() => setZalohaModal(null)}
          onSubmit={(config) => handleAddZaloha(config)}
        />
      )}

      {/* ZÁLOHA / STÁŽ SECTION */}
      <section style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => setZalohaSectionOpen(!zalohaSectionOpen)}
          style={{
            background: 'linear-gradient(135deg, #1976D2, #0D47A1)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: zalohaSectionOpen ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>🛡️ ZÁLOHA / STÁŽ</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {enabledZalohaShifts.length} služeb
            </span>
            <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
              {zalohaSectionOpen ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {zalohaSectionOpen && (
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
                        sectionData={shiftsData[day.date]?.zalohaStaz}
                        section="zalohaStaz"
                        onSlotClick={handleShiftSlotClick}
                        onZalohaInterestedClick={handleZalohaInterestedClick}
                        currentUser={currentUser}
                        onRemoveZaloha={handleRemoveZaloha}
                        isAdmin={isAdmin}
                        retroMode={retroMode}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
                          retroMode={retroMode}
                          onRetroAddParticipant={setActivityPickerOpen}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}

          {/* Add Zaloha Form (Only for Admins) */}
          {isAdmin && (
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
        )}
      </section>

      {/* DAY SHIFTS SECTION */}
      <section style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => setDaySectionOpen(!daySectionOpen)}
          style={{
            background: 'linear-gradient(135deg, #FF9800, #F57C00)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: daySectionOpen ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>☀️ DENNÍ SLUŽBY</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {enabledDayShifts.length} služeb
            </span>
            <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
              {daySectionOpen ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {daySectionOpen && (
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
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#888' }}>▼</span>
                </div>

                {!isCollapsed && week.map(day => {
                  const dayTrainings = trainingsData.filter(t => parseInt(t.date.split('-')[2]) === day.date);
                  const dayEvents = eventsData.filter(e => parseInt(e.date.split('-')[2]) === day.date);
                  const hasActivities = dayTrainings.length > 0 || dayEvents.length > 0;

                  return (
                    <React.Fragment key={`day-${day.date}`}>
                      <ShiftRow
                        day={day}
                        sectionData={shiftsData[day.date]?.dayShift}
                        section="dayShift"
                        onSlotClick={handleShiftSlotClick}
                        currentUser={currentUser}
                        onRemoveDayShift={handleRemoveDayShift}
                        isAdmin={isAdmin}
                        retroMode={retroMode}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
                          retroMode={retroMode}
                          onRetroAddParticipant={setActivityPickerOpen}
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
          {isAdmin && (
            <div style={{ padding: '1rem', background: '#FFF8E1', borderTop: '1px solid #eee', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 500, color: '#F57C00' }}>Přidat denní službu:</label>
              <select
                value={newDayShiftDate}
                onChange={(e) => setNewDayShiftDate(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #FFCC80', minWidth: '180px' }}
              >
                <option value="">-- Vyberte den --</option>
                {days.filter(d => !enabledDayShifts.some(e => e.date === d.date)).map(day => (
                  <option key={day.date} value={day.date}>
                    {day.date}. ({day.dayName})
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={handleAddDayShift} style={{ padding: '0.5rem 1rem' }}>
                + Přidat
              </button>
            </div>
          )}
        </div>
        )}
      </section>

      {/* NIGHT SHIFTS SECTION */}
      <section>
        <div
          onClick={() => setNightSectionOpen(!nightSectionOpen)}
          style={{
            background: 'linear-gradient(135deg, #37474F, #263238)',
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: nightSectionOpen ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>🌙 NOČNÍ SLUŽBY</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{days.length} dnů</span>
            <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
              {nightSectionOpen ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {nightSectionOpen && (
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
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#888' }}>▼</span>
                </div>

                {!isCollapsed && week.map(day => {
                  const dayTrainings = trainingsData.filter(t => parseInt(t.date.split('-')[2]) === day.date);
                  const dayEvents = eventsData.filter(e => parseInt(e.date.split('-')[2]) === day.date);
                  const hasActivities = dayTrainings.length > 0 || dayEvents.length > 0;

                  return (
                    <React.Fragment key={`night-${day.date}`}>
                      <ShiftRow
                        day={day}
                        sectionData={shiftsData[day.date]?.nightShift}
                        section="nightShift"
                        onSlotClick={handleShiftSlotClick}
                        currentUser={currentUser}
                        isAdmin={isAdmin}
                        retroMode={retroMode}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
                          retroMode={retroMode}
                          onRetroAddParticipant={setActivityPickerOpen}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
        )}
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
      {zalohaAssignModal && (
        <ZalohaAssignModal
          shiftsData={shiftsData}
          zalohaAssignModal={zalohaAssignModal}
          onAssign={handleZalohaAssignUser}
          onClose={() => setZalohaAssignModal(null)}
        />
      )}

      {/* Join Shift Modal */}
      {joinShiftModal && (
        <JoinShiftModal
          section={joinShiftModal.section}
          onConfirm={(params) => {
            handleSlotClick(joinShiftModal.day, joinShiftModal.section, joinShiftModal.slotKey, params);
            setJoinShiftModal(null);
          }}
          onClose={() => setJoinShiftModal(null)}
        />
      )}

      {/* Retro Assign Modal */}
      {retroAssignModal && (
        <RetroAssignModal
          modal={retroAssignModal}
          onAssign={(user) => {
            handleRetroAssign(retroAssignModal.day, retroAssignModal.section, retroAssignModal.slotKey, user);
            setRetroAssignModal(null);
          }}
          onClose={() => setRetroAssignModal(null)}
        />
      )}

      {/* Absence user picker (admin mode) */}
      {absencePickerOpen && (
        <RetroAssignModal
          modal={{}}
          title="Vybrat člena pro absenci"
          onAssign={(user) => {
            setAbsenceTargetUser(user);
            setAbsencePickerOpen(false);
            setAbsenceModal({ mode: 'add' });
          }}
          onClose={() => setAbsencePickerOpen(false)}
        />
      )}

      {/* Activity user picker (admin mode) */}
      {activityPickerOpen && (
        <RetroAssignModal
          modal={{}}
          title={`Přidat člena na ${activityPickerOpen.type === 'training' ? 'školení' : 'akci'}`}
          onAssign={handleRetroActivityAdd}
          onClose={() => setActivityPickerOpen(null)}
        />
      )}
    </div>
  );
}
