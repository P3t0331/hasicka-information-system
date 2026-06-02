import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import StatCard from '../components/statistics/StatCard';
import ActivitiesTab from '../components/statistics/ActivitiesTab';
import AbsencesTab from '../components/statistics/AbsencesTab';
import ShiftsTab from '../components/statistics/ShiftsTab';
import LogStatsTab from '../components/statistics/LogStatsTab';
import YearTab from '../components/statistics/YearTab';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../components/PullToRefreshIndicator';

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
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    return new Promise(resolve => {
      setRefreshKey(k => k + 1);
      setTimeout(resolve, 1200);
    });
  }, []);

  // New state for tabs and additional data
  const [activeTab, setActiveTab] = useState('shifts'); // 'shifts' | 'activities' | 'absences' | 'maintenance' | 'cleaning' | 'year'
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [eventsData, setEventsData] = useState([]);
  const [trainingsData, setTrainingsData] = useState([]);
  const [absencesData, setAbsencesData] = useState([]);
  const [maintenanceMonth, setMaintenanceMonth] = useState([]);
  const [cleaningMonth, setCleaningMonth] = useState([]);

  const { isRefreshing, pullProgress } = usePullToRefresh(refresh);

  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
  const isAdmin = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'Velitel', 'VD'].includes(r));

  const getMonthDocId = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const currentDocId = getMonthDocId(currentDate);

  useEffect(() => {
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
  }, [currentDocId, refreshKey]);

  // Fetch events, trainings, and absences for current month
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Fetch Events
    const eventsUnsub = onSnapshot(collection(db, 'events'), (snapshot) => {
      const monthEvents = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.date >= monthStart && e.date <= monthEnd && e.date <= todayStr);
      setEventsData(monthEvents);
    });

    // Fetch Trainings
    const trainingsUnsub = onSnapshot(collection(db, 'trainings'), (snapshot) => {
      const monthTrainings = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => t.date >= monthStart && t.date <= monthEnd && t.date <= todayStr);
      setTrainingsData(monthTrainings);
    });

    // Fetch Absences
    const absencesUnsub = onSnapshot(doc(db, 'absences', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const allAbsences = docSnap.data().items || [];
        const monthAbsences = allAbsences.filter(a =>
          a.endDate >= monthStart && a.startDate <= monthEnd
        );
        setAbsencesData(monthAbsences);
      }
    });

    // Fetch Maintenance logs
    const maintenanceUnsub = onSnapshot(collection(db, 'maintenanceLogs'), (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMaintenanceMonth(all.filter(e => e.date >= monthStart && e.date <= monthEnd));
    });

    // Fetch Cleaning logs
    const cleaningUnsub = onSnapshot(collection(db, 'cleaningLogs'), (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCleaningMonth(all.filter(e => e.date >= monthStart && e.date <= monthEnd));
    });

    return () => {
      eventsUnsub();
      trainingsUnsub();
      absencesUnsub();
      maintenanceUnsub();
      cleaningUnsub();
    };
  }, [currentDocId, currentDate, refreshKey]);

  const handleMonthChange = (offset) => {
    setLoading(true);
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <div className="container mt-4 flex-center" style={{ minHeight: '300px' }}>
        <p>Načítám statistiky...</p>
      </div>
    );
  }

  return (
    <div className="container mt-4" style={{ maxWidth: '1200px', paddingBottom: '3rem' }}>
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullProgress={pullProgress} />

      {/* 1. Navigation Header */}
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
        {activeTab === 'year' ? (
          <>
            <button
              className="btn"
              onClick={() => setActiveYear(y => y - 1)}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            >
              ←
            </button>
            <h2 style={{ margin: 0, color: 'white', fontSize: '1.1rem', letterSpacing: '1px' }}>
              {activeYear}
            </h2>
            <button
              className="btn"
              onClick={() => setActiveYear(y => y + 1)}
              disabled={activeYear >= new Date().getFullYear()}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem 0.75rem', fontSize: '0.85rem', opacity: activeYear >= new Date().getFullYear() ? 0.4 : 1 }}
            >
              →
            </button>
          </>
        ) : (
          <>
            <button
              className="btn"
              onClick={() => handleMonthChange(-1)}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            >
              ←
            </button>
            <h2 style={{ margin: 0, textTransform: 'uppercase', color: 'white', fontSize: '1.1rem', letterSpacing: '1px' }}>
              {MONTHS_CZ[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              className="btn"
              onClick={() => handleMonthChange(1)}
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
            >
              →
            </button>
          </>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '2px solid #e0e0e0',
        overflowX: 'auto',
        paddingBottom: '0.5rem'
      }}>
        <button
          onClick={() => setActiveTab('shifts')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'shifts' ? '#FF9800' : 'transparent',
            color: activeTab === 'shifts' ? 'white' : '#666',
            fontWeight: activeTab === 'shifts' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          🚒 Služby
        </button>
        <button
          onClick={() => setActiveTab('activities')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'activities' ? '#E53935' : 'transparent',
            color: activeTab === 'activities' ? 'white' : '#666',
            fontWeight: activeTab === 'activities' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          📊 Aktivity
        </button>
        <button
          onClick={() => setActiveTab('absences')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'absences' ? '#757575' : 'transparent',
            color: activeTab === 'absences' ? 'white' : '#666',
            fontWeight: activeTab === 'absences' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          🚫 Nepřítomnost
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'maintenance' ? '#FF6F00' : 'transparent',
            color: activeTab === 'maintenance' ? 'white' : '#666',
            fontWeight: activeTab === 'maintenance' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          🔧 Údržba
        </button>
        <button
          onClick={() => setActiveTab('cleaning')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'cleaning' ? '#00838F' : 'transparent',
            color: activeTab === 'cleaning' ? 'white' : '#666',
            fontWeight: activeTab === 'cleaning' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          🧹 Úklid
        </button>
        <button
          onClick={() => setActiveTab('year')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'year' ? '#37474F' : 'transparent',
            color: activeTab === 'year' ? 'white' : '#666',
            fontWeight: activeTab === 'year' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          📅 Roční přehled
        </button>
      </div>

      {activeTab === 'shifts' && (
        <ShiftsTab
          shiftsData={shiftsData}
          currentDate={currentDate}
          currentDocId={currentDocId}
          isAdmin={isAdmin}
          currentUser={currentUser}
          userData={userData}
        />
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <ActivitiesTab
          eventsData={eventsData}
          trainingsData={trainingsData}
        />
      )}
      {/* Absences Tab */}
      {activeTab === 'absences' && (
        <AbsencesTab
          absencesData={absencesData}
          currentDate={currentDate}
        />
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <LogStatsTab
          entries={maintenanceMonth}
          currentDate={currentDate}
          accent={{ from: '#FF6F00', to: '#E65100' }}
          emoji="🔧"
          label="údržby"
        />
      )}

      {/* Cleaning Tab */}
      {activeTab === 'cleaning' && (
        <LogStatsTab
          entries={cleaningMonth}
          currentDate={currentDate}
          accent={{ from: '#00838F', to: '#006064' }}
          emoji="🧹"
          label="úklidu"
        />
      )}

      {/* Year Tab */}
      {activeTab === 'year' && <YearTab year={activeYear} />}

    </div>
  );
}
