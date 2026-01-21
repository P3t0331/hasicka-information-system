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
    <div className="container mt-4" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '2rem' }}>
      
      {/* 1. HERO HEADER */}
      <div style={{ 
        background: 'linear-gradient(135deg, #263238 0%, #37474F 100%)', 
        borderRadius: 'var(--radius)', 
        padding: '2.5rem 2rem', 
        color: 'white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        marginBottom: '2rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2rem',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Decorative Element */}
        <div style={{
           position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px',
           background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
           borderRadius: '50%', pointerEvents: 'none'
        }} />

        {/* Avatar Circle */}
        <div style={{ 
          width: '100px', height: '100px', 
          background: 'linear-gradient(135deg, var(--primary-red), var(--primary-red-dark))',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2.5rem', fontWeight: 700,
          color: 'white',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          border: '4px solid rgba(255,255,255,0.1)'
        }}>
          {userData.firstName?.[0]}{userData.lastName?.[0]}
        </div>

        {/* User Info */}
        <div style={{ flex: 1, minWidth: '200px' }}>
           <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'white' }}>
             {userData.firstName} {userData.lastName}
           </h1>
           <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
             {userRoles.map(role => (
               <span key={role} style={{ 
                 background: 'rgba(255,255,255,0.15)', 
                 padding: '0.25rem 0.75rem', 
                 borderRadius: '50px', 
                 fontSize: '0.85rem', fontWeight: 600, 
                 border: '1px solid rgba(255,255,255,0.2)'
               }}>
                 {role}
               </span>
             ))}
             {userData.approved && (
               <span style={{ 
                 background: 'rgba(76, 175, 80, 0.2)', 
                 color: '#81C784',
                 padding: '0.25rem 0.75rem', 
                 borderRadius: '50px', 
                 fontSize: '0.85rem', fontWeight: 600, 
                 border: '1px solid rgba(76, 175, 80, 0.3)'
               }}>
                 ✓ Aktivní účet
               </span>
             )}
           </div>
        </div>

        {/* Stats Widget (Floating) */}
        <div style={{
           background: 'rgba(255, 255, 255, 0.1)',
           backdropFilter: 'blur(10px)',
           padding: '1.5rem',
           borderRadius: '12px',
           minWidth: '200px',
           border: '1px solid rgba(255,255,255,0.1)',
           textAlign: 'center'
        }}>
           <div style={{ fontSize: '0.9rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>
             Tento Měsíc
           </div>
           <div style={{ fontSize: '3rem', fontWeight: 700, lineHeight: 1, margin: '0.5rem 0' }}>
             {monthlyHours}
           </div>
           <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>odpracovaných hodin</div>
        </div>
      </div>

      {/* 2. MAIN GRID CONTENT */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
        gap: '1.5rem' 
      }}>
        
        {/* Left Col: Personal Info */}
        <div className="card" style={{ height: 'fit-content' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
             <h3 style={{ fontSize: '1.25rem', color: '#333' }}>👤 Osobní Údaje</h3>
             {!isEditing && (
               <button 
                 className="btn btn-secondary" 
                 onClick={() => setIsEditing(true)}
                 style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
               >
                 Upravit
               </button>
             )}
           </div>

           {isEditing ? (
             <form onSubmit={handleUpdateProfile}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                 <div className="input-group">
                   <label className="input-label">Jméno</label>
                   <input className="input-field" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} required />
                 </div>
                 <div className="input-group">
                   <label className="input-label">Příjmení</label>
                   <input className="input-field" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} required />
                 </div>
               </div>
               <div className="input-group">
                 <label className="input-label">Telefon</label>
                 <input className="input-field" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
               </div>
               <div className="input-group">
                 <label className="input-label">Adresa Bydliště</label>
                 <input className="input-field" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
               </div>
               <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                 <button className="btn btn-success" style={{background: '#2e7d32', color: 'white', flex: 1}} type="submit">Uložit změny</button>
                 <button className="btn btn-secondary" style={{flex: 1}} type="button" onClick={() => setIsEditing(false)}>Zrušit</button>
               </div>
             </form>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
               <ProfileItem label="Email (Přihlášení)" value={userData.email} icon="✉️" />
               <ProfileItem label="Telefon" value={userData.phone || 'Neuvedeno'} icon="📱" />
               <ProfileItem label="Adresa" value={userData.address || 'Neuvedeno'} icon="🏠" />
             </div>
           )}
        </div>

        {/* Right Col: Certifications & System Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
           
           {/* Certifications Card */}
           <div className="card">
             <h3 style={{ fontSize: '1.25rem', color: '#333', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
               🎓 Kvalifikace a Oprávnění
             </h3>
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
               {userData.certifications && userData.certifications.length > 0 ? (
                 userData.certifications.map(cert => (
                   <span key={cert} style={{
                     background: '#FFF3E0', color: '#E65100',
                     padding: '0.5rem 1rem', borderRadius: '8px',
                     fontWeight: 600, border: '1px solid #ffe0b2',
                     display: 'flex', alignItems: 'center', gap: '0.5rem'
                   }}>
                     Verified • {cert}
                   </span>
                 ))
               ) : (
                 <p style={{ color: '#888', fontStyle: 'italic' }}>Žádné speciální kvalifikace.</p>
               )}
             </div>
           </div>

           {/* Quick Actions / System */}
           <div className="card" style={{ background: '#fafafa' }}>
             <h3 style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem', textTransform: 'uppercase' }}>
               Systémové akce
             </h3>
             <div style={{ display: 'flex', gap: '1rem' }}>
               <Link to="/statistiky" className="btn btn-secondary" style={{ flex: 1 }}>
                 📊 Moje Statistiky
               </Link>
               {/* Logout is handled in sidebar usually, but keeping context if needed */}
             </div>
           </div>

        </div>
      </div>
    </div>
  );
}

function ProfileItem({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
      <div style={{ 
        width: '40px', height: '40px', background: '#f5f5f5', 
        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.2rem'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#333' }}>
          {value}
        </div>
      </div>
    </div>
  );
}
