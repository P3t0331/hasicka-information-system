import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import useShiftCalendar from '../hooks/useShiftCalendar';
import { MONTHS_CZ } from '../components/shifts/constants';

// Subcomponents
import AbsencePanel from '../components/shifts/AbsencePanel';
import ShiftRow from '../components/shifts/ShiftRow';
import InlineActivities from '../components/shifts/InlineActivities';

// Modals
import AddAbsenceModal from '../components/shifts/modals/AddAbsenceModal';
import AddZalohaModal from '../components/shifts/modals/AddZalohaModal';
import ActivityPopup from '../components/shifts/modals/ActivityPopup';
import ZalohaAssignModal from '../components/shifts/modals/ZalohaAssignModal';

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
    toast,
    setToast,
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
    showToast
  } = useShiftCalendar(currentUser, userData);

  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'VD'].includes(r));

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
          border: `1px solid ${toast.type === 'error' ? '#EF9A9A' :
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
      <div style={{
        background: 'linear-gradient(135deg, #37474F, #263238)',
        borderRadius: '10px',
        padding: '0.75rem 1rem',
        color: 'white',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
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
        <h2 style={{ margin: 0, textTransform: 'uppercase', color: 'white', fontSize: '1.1rem', letterSpacing: '1px' }}>
          {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
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
      />

      {/* Add Absence Modal */}
      {absenceModal && (
        <AddAbsenceModal
          existingAbsences={absencesData.filter(a => a.uid === currentUser?.uid)}
          onSubmit={handleAddAbsence}
          onClose={() => setAbsenceModal(null)}
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
                        sectionData={shiftsData[day.date]?.zalohaStaz || {}}
                        section="zalohaStaz"
                        onSlotClick={handleSlotClick}
                        onZalohaInterestedClick={handleZalohaInterestedClick}
                        currentUser={currentUser}
                        onRemoveZaloha={handleRemoveZaloha}
                        isAdmin={isAdmin}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
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
                        sectionData={shiftsData[day.date]?.dayShift || {}}
                        section="dayShift"
                        onSlotClick={handleSlotClick}
                        currentUser={currentUser}
                        onRemoveDayShift={handleRemoveDayShift}
                        isAdmin={isAdmin}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
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
                        sectionData={shiftsData[day.date]?.nightShift || {}}
                        section="nightShift"
                        onSlotClick={handleSlotClick}
                        currentUser={currentUser}
                        isAdmin={isAdmin}
                      />
                      {hasActivities && (
                        <InlineActivities
                          trainings={dayTrainings}
                          events={dayEvents}
                          currentUser={currentUser}
                          userData={userData}
                          showToast={showToast}
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
    </div>
  );
}
