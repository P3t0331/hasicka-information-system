import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import StatCard from '../components/statistics/StatCard';
import ActivitiesTab from '../components/statistics/ActivitiesTab';
import AbsencesTab from '../components/statistics/AbsencesTab';
import ShiftsTab from '../components/statistics/ShiftsTab';

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

  // New state for tabs and additional data
  const [activeTab, setActiveTab] = useState('shifts'); // 'shifts' | 'activities' | 'absences'
  const [eventsData, setEventsData] = useState([]);
  const [trainingsData, setTrainingsData] = useState([]);
  const [absencesData, setAbsencesData] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // All users who participated in anything

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

  // Fetch events, trainings, and absences for current month
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Fetch Events
    const eventsUnsub = onSnapshot(collection(db, 'events'), (snapshot) => {
      const monthEvents = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(e => e.date >= monthStart && e.date <= monthEnd);
      setEventsData(monthEvents);
    });

    // Fetch Trainings
    const trainingsUnsub = onSnapshot(collection(db, 'trainings'), (snapshot) => {
      const monthTrainings = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(t => t.date >= monthStart && t.date <= monthEnd);
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

    return () => {
      eventsUnsub();
      trainingsUnsub();
      absencesUnsub();
    };
  }, [currentDocId, currentDate]);

  const handleMonthChange = (offset) => {
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

      {/* 1. Month Navigation Header */}
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
      </div>

      {activeTab === 'shifts' && (
        <ShiftsTab
          shiftsData={shiftsData}
          currentDate={currentDate}
          currentDocId={currentDocId}
          isAdmin={isAdmin}
          currentUser={currentUser}
        />
      )}

      {/* Activities Tab */}
      {activeTab === 'activities' && (
        <ActivitiesTab
          eventsData={eventsData}
          trainingsData={trainingsData}
          currentDate={currentDate}
        />
      )}
      {/* Absences Tab */}
      {activeTab === 'absences' && (
        <AbsencesTab
          absencesData={absencesData}
          currentDate={currentDate}
        />
      )}

    </div>
  );
}
