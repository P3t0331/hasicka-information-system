import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const DEFAULT_NIGHT_HOURS = 11;
const DEFAULT_DAY_HOURS = 8;
export default function ProfilePage() {
  const { currentUser, userData, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Normalize roles to array
  const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];

  // Statistics State
  const [monthlyHours, setMonthlyHours] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    const date = new Date();
    const currentDocId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const docRef = doc(db, 'shifts', currentDocId);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data().days || {};
        let total = 0;
        
        Object.entries(data).forEach(([dayStr, dayData]) => {
          // Check date - exclude future
          const [year, month] = currentDocId.split('-').map(Number);
          const shiftDate = new Date(year, month - 1, Number(dayStr));
          shiftDate.setHours(0, 0, 0, 0);
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          if (shiftDate > today) return;

          // Check explicit hours first
          if (dayData.hours && dayData.hours[currentUser.uid]) {
            const h = dayData.hours[currentUser.uid];
            // Handle both old format (h.hours number or object) and new format (h.day/h.night)
            // Use loose check for robustness or strict check
            if (h && (typeof h.day === 'number' || typeof h.night === 'number')) {
               total += (h.day || 0) + (h.night || 0);
            } else if (h && h.hours !== undefined) {
               total += (Number(h.hours) || 0);
            }
          } else {
            // Calculate default
            let dayTotal = 0;
            if (dayData.dayShift && Object.values(dayData.dayShift).some(u => u?.uid === currentUser.uid)) {
              dayTotal += DEFAULT_DAY_HOURS;
            }
            if (dayData.nightShift && Object.values(dayData.nightShift).some(u => u?.uid === currentUser.uid)) {
              dayTotal += DEFAULT_NIGHT_HOURS;
            }
            total += dayTotal;
          }
        });
        setMonthlyHours(total);
      } else {
        setMonthlyHours(0);
      }
    });

    return unsubscribe;
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && userData) {
      setEditForm({
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        address: userData.address
      });
    }
  }, [currentUser, userData]);

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
       console.error("Failed to log out", error);
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        address: editForm.address
      });
      setIsEditing(false);
      window.location.reload(); 
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  }

  if (loading) return <div>Načítání...</div>;

  if (!userData) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center' }}>
        <div className="card">
          <h2 style={{color: 'var(--primary-red)'}}>Chyba profilu</h2>
          <p className="mt-2">Váš uživatelský profil nebyl nalezen. Kontaktujte administrátora.</p>
          <button className="btn btn-secondary mt-2" onClick={handleLogout}>Odhlásit se</button>
        </div>
      </div>
    );
  }

  if (!userData.approved) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center' }}>
        <div className="card">
          <h2 style={{color: 'var(--primary-red)'}}>Čekání na schválení</h2>
          <p className="mt-2">Váš účet musí být schválen správcem systému (VJ).</p>
          <button className="btn btn-secondary mt-2" onClick={handleLogout}>Odhlásit se</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Můj Profil</h2>
          {!isEditing && <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Upravit Profil</button>}
        </div>

        {/* Stats Widget */}
        <div style={{ 
          background: 'linear-gradient(135deg, #FF6F00, #EF6C00)', 
          borderRadius: '8px', 
          padding: '1rem', 
          color: 'white',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 2px 4px rgba(239, 108, 0, 0.2)'
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Moje hodiny tento měsíc</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{monthlyHours}h</div>
          </div>
          <Link to="/statistiky" className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
            Zobrazit detail →
          </Link>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdateProfile}>
              <div className="input-group">
              <label className="input-label">Jméno</label>
              <input className="input-field" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Příjmení</label>
              <input className="input-field" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Telefon</label>
              <input className="input-field" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
            </div>
            <div className="input-group">
              <label className="input-label">Bydliště</label>
              <input className="input-field" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-success" style={{background: '#2e7d32', color: 'white'}} type="submit">Uložit</button>
              <button className="btn btn-secondary" type="button" onClick={() => setIsEditing(false)}>Zrušit</button>
            </div>
          </form>
        ) : (
          <div>
            <ProfileDetail label="Jméno" value={`${userData.firstName} ${userData.lastName}`} />
            <ProfileDetail label="Funkce (Role)" value={userRoles.join(', ')} highlight />
            {userData.certifications && userData.certifications.length > 0 && (
                <ProfileDetail label="Kvalifikace" value={userData.certifications.join(', ')} />
            )}
            <ProfileDetail label="Email" value={userData.email} />
            <ProfileDetail label="Telefon" value={userData.phone} />
            <ProfileDetail label="Bydliště" value={userData.address} />
            <div className="mt-2">
              <span className="badge badge-approved">Účet aktivní</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileDetail({ label, value, highlight }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: highlight ? 'bold' : 'normal', color: highlight ? 'var(--primary-red)' : 'inherit' }}>{value}</span>
    </div>
  );
}
