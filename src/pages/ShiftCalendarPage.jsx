import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import useShiftCalendar from '../hooks/useShiftCalendar';
import { MONTHS_CZ, getZalohaKind, getZalohaKindForms } from '../components/shifts/constants';
import { joinActivityTx } from '../utils/activityParticipants';
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
    handleEditZaloha,
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

    try {
      await joinActivityTx(db, collectionName, activity.id, {
        uid: user.uid,
        name: `${user.firstName} ${user.lastName}`,
        joinedAt: new Date().toISOString()
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akci';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'ADMIN_ADDED_TRAINING' : 'ADMIN_ADDED_EVENT', 'admin',
        `Admin přidal člena ${user.firstName} ${user.lastName} na ${typeLabel} „${activity.title}“ (${activity.date})`);
      showToast('success', `Uživatel přidán na ${typeLabel}.`);
    } catch (err) {
      if (err.code === 'ALREADY_JOINED') {
        showToast('warning', 'Uživatel je již přihlášen.');
      } else if (err.code === 'FULL') {
        showToast('error', 'Kapacita je naplněna.');
      } else {
        console.error(err);
        showToast('error', 'Chyba při přidávání.');
      }
    }
    setActivityPickerOpen(null);
  };

  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD', 'Přístup do Administrace'].includes(r));
  const isStrictAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'VD', 'Přístup do Administrace'].includes(r));
  const [joinShiftModal, setJoinShiftModal] = useState(null); // { day, section, slotKey }

  const _today = new Date();
  const _isCurrentMonth = _today.getFullYear() === currentDate.getFullYear() && _today.getMonth() === currentDate.getMonth();
  const _isPastMonth = currentDate.getFullYear() < _today.getFullYear() || (currentDate.getFullYear() === _today.getFullYear() && currentDate.getMonth() < _today.getMonth());
  const _todayDate = _today.getDate();
  const isZalohaDayPast = (dayDate) => _isPastMonth || (_isCurrentMonth && dayDate < _todayDate);
  const [showPastZaloha, setShowPastZaloha] = useState(false);
  const pastZalohaCount = enabledZalohaShifts.filter(d => isZalohaDayPast(d.date)).length;

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
            background: 'var(--surface)',
            borderRadius: '12px',
            padding: '1.5rem',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>{modal.title}</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{modal.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={modal.onCancel}>Zrušit</button>
              <button className="btn btn-primary" onClick={modal.onConfirm}>Potvrdit</button>
            </div>
          </div>
        </div>
      )}

      {/* Month Navigation */}
      <div style={{
        background: 'linear-gradient(135deg, var(--table-header-dark), var(--shift-night))',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        color: 'var(--text-on-dark)',
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
            color: 'var(--text-on-dark)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '0.4rem 0.75rem',
            fontSize: '0.85rem'
          }}
        >
          ←
        </button>
        <h2 style={{ margin: 0, textTransform: 'uppercase', color: 'var(--text-on-dark)', fontSize: '1.1rem', letterSpacing: '1px', flex: 1, textAlign: 'center' }}>
          {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className="btn"
            onClick={() => handleMonthChange(1)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--text-on-dark)',
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
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
            padding: '0.4rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem',
            color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem',
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
              border: retroMode ? '1px solid var(--warning-strong)' : '1px solid var(--border)',
              background: retroMode ? 'var(--warning-bg-soft)' : 'var(--surface)',
              color: retroMode ? 'var(--warning-dark)' : 'var(--text-steel)',
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
          background: 'var(--warning-bg-soft)', border: '1px solid var(--warning-strong)', borderRadius: '8px',
          padding: '0.65rem 1rem', marginBottom: '1rem',
          fontSize: '0.85rem', color: 'var(--warning-dark)', fontWeight: 500
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
          mode={zalohaModal.mode || 'add'}
          initialConfig={zalohaModal.config}
          sectionData={shiftsData[zalohaModal.date]?.zalohaStaz}
          onClose={() => setZalohaModal(null)}
          onSubmit={(config) => zalohaModal.mode === 'edit' ? handleEditZaloha(config) : handleAddZaloha(config)}
        />
      )}

      {/* ZÁLOHA / STÁŽ SECTION */}
      <section style={{ marginBottom: '2rem' }}>
        <div
          onClick={() => setZalohaSectionOpen(!zalohaSectionOpen)}
          style={{
            background: 'linear-gradient(135deg, var(--info), var(--info-dark))',
            color: 'var(--text-on-dark)',
            padding: '0.75rem 1rem',
            borderRadius: zalohaSectionOpen ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-on-dark)' }}>🛡️ ZÁLOHA / STÁŽ</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {pastZalohaCount > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setShowPastZaloha(v => !v); }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'var(--text-on-dark)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
              >
                {showPastZaloha ? 'Skrýt proběhlé' : `${pastZalohaCount} proběhlé`}
              </button>
            )}
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              {showPastZaloha ? enabledZalohaShifts.length : enabledZalohaShifts.length - pastZalohaCount} služeb
            </span>
            <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
              {zalohaSectionOpen ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {zalohaSectionOpen && (
          <div style={{ border: '1px solid var(--surface-hover)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {(() => {
            const displayedZalohaShifts = showPastZaloha ? enabledZalohaShifts : enabledZalohaShifts.filter(d => !isZalohaDayPast(d.date));
            return displayedZalohaShifts.length > 0 && groupWeeks(displayedZalohaShifts).map((week, index) => {
            const firstDay = week[0];
            const lastDay = week[week.length - 1];
            const weekId = `zaloha-week-${firstDay.date}`;
            const isCollapsed = collapsedWeeks[weekId];
            const weekLabel = `${firstDay.date}. – ${lastDay.date}. ${MONTHS_CZ[currentDate.getMonth()]}`;

            return (
              <div key={weekId} style={{ borderBottom: '1px solid var(--surface-hover)' }}>
                <div
                  onClick={() => toggleWeek(weekId)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: 'var(--surface-sunken)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    userSelect: 'none',
                    borderBottom: !isCollapsed ? '1px dashed var(--surface-hover)' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-sunken)'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📅 <span style={{ color: 'var(--text-charcoal)' }}>{weekLabel}</span>
                  </span>
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>▼</span>
                </div>

                {!isCollapsed && week.map(day => {
                  const dayTrainings = trainingsData.filter(t => parseInt(t.date.split('-')[2]) === day.date);
                  const dayEvents = eventsData.filter(e => parseInt(e.date.split('-')[2]) === day.date);
                  const hasActivities = dayTrainings.length > 0 || dayEvents.length > 0;
                  const config = shiftsData[day.date]?.zalohaStaz?.config;

                  return (
                    <React.Fragment key={`zaloha-${day.date}`}>
                      {(config || isAdmin) && (
                        <div style={{ background: 'var(--info-bg)', padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--info-text)', fontWeight: 600, borderBottom: '1px solid var(--info-border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              background: getZalohaKind(config) === 'staz' ? 'var(--accent-purple-bg)' : 'var(--success-bg)',
                              color: getZalohaKind(config) === 'staz' ? 'var(--accent-purple-deep)' : 'var(--success-text)',
                              border: `1px solid ${getZalohaKind(config) === 'staz' ? 'var(--accent-purple-medium-border)' : 'var(--success-border-strong)'}`,
                              padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.72rem',
                              textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                              {getZalohaKindForms(config).icon} {getZalohaKindForms(config).label}
                            </span>
                            <span>
                              ⏰ {config?.timeFrom && config?.timeTo ? `${config.timeFrom} – ${config.timeTo}` : 'Čas neuveden'}
                            </span>
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => setZalohaModal({ date: day.date, mode: 'edit', config: config || {} })}
                              title="Upravit čas a počet pozic"
                              style={{
                                background: 'var(--surface)', border: '1px solid var(--info-border)', color: 'var(--info-text)',
                                padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem',
                                fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              ✏️ Upravit
                            </button>
                          )}
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
                        isPast={isZalohaDayPast(day.date)}
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
            });
          })()}

          {/* Add Zaloha Form (Only for Admins) */}
          {isAdmin && (
            <div style={{ padding: '1rem', background: 'var(--info-bg)', borderTop: '1px solid var(--surface-hover)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 500, color: 'var(--info-text)' }}>Přidat Záloha / Stáž:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setZalohaModal({ date: parseInt(e.target.value), mode: 'add' });
                    e.target.value = "";
                  }
                }}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--info-border)', minWidth: '180px' }}
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
            background: 'linear-gradient(135deg, var(--warning-bright), var(--warning))',
            color: 'var(--text-on-dark)',
            padding: '0.75rem 1rem',
            borderRadius: daySectionOpen ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-on-dark)' }}>☀️ DENNÍ SLUŽBY</h3>
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
          <div style={{ border: '1px solid var(--surface-hover)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {enabledDayShifts.length > 0 && groupWeeks(enabledDayShifts).map((week, index) => {
            const firstDay = week[0];
            const lastDay = week[week.length - 1];
            const weekId = `day-week-${firstDay.date}`;
            const isCollapsed = collapsedWeeks[weekId];
            const weekLabel = `${firstDay.date}. – ${lastDay.date}. ${MONTHS_CZ[currentDate.getMonth()]}`;

            return (
              <div key={weekId} style={{ borderBottom: index < groupWeeks(enabledDayShifts).length - 1 ? '1px solid var(--surface-hover)' : 'none' }}>
                <div
                  onClick={() => toggleWeek(weekId)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: 'var(--surface-sunken)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    userSelect: 'none',
                    borderBottom: !isCollapsed ? '1px dashed var(--surface-hover)' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-sunken)'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📅 <span style={{ color: 'var(--text-charcoal)' }}>{weekLabel}</span>
                  </span>
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>▼</span>
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
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Zatím nebyly vytvořeny žádné denní služby.
            </div>
          )}

          {/* Add Day Shift Form */}
          {isAdmin && (
            <div style={{ padding: '1rem', background: 'var(--warning-bg-soft)', borderTop: '1px solid var(--surface-hover)', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 500, color: 'var(--warning)' }}>Přidat denní službu:</label>
              <select
                value={newDayShiftDate}
                onChange={(e) => setNewDayShiftDate(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--warning-border)', minWidth: '180px' }}
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
            background: 'linear-gradient(135deg, var(--table-header-dark), var(--shift-night))',
            color: 'var(--text-on-dark)',
            padding: '0.75rem 1rem',
            borderRadius: nightSectionOpen ? '8px 8px 0 0' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-on-dark)' }}>🌙 NOČNÍ SLUŽBY</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{days.length} dnů</span>
            <span style={{ fontSize: '0.8rem', transition: 'transform 0.2s' }}>
              {nightSectionOpen ? '▲' : '▼'}
            </span>
          </div>
        </div>

        {nightSectionOpen && (
          <div style={{ border: '1px solid var(--surface-hover)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
          {groupWeeks(days).map((week, index) => {
            const firstDay = week[0];
            const lastDay = week[week.length - 1];
            const weekId = `night-week-${firstDay.date}`;
            const isCollapsed = collapsedWeeks[weekId];
            const weekLabel = `${firstDay.date}. – ${lastDay.date}. ${MONTHS_CZ[currentDate.getMonth()]}`;

            return (
              <div key={weekId} style={{ borderBottom: index < groupWeeks(days).length - 1 ? '1px solid var(--surface-hover)' : 'none' }}>
                <div
                  onClick={() => toggleWeek(weekId)}
                  style={{
                    padding: '0.6rem 1rem',
                    background: 'var(--surface-sunken)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    userSelect: 'none',
                    borderBottom: !isCollapsed ? '1px dashed var(--surface-hover)' : 'none'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-sunken)'}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🌙 <span style={{ color: 'var(--text-charcoal)' }}>{weekLabel}</span>
                  </span>
                  <span style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)' }}>▼</span>
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
