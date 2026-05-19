import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { logAction } from '../utils/logger';

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

  // Equipment State
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [showEqModal, setShowEqModal] = useState(false);
  const [currentEq, setCurrentEq] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "equipmentTypes"), (docSnap) => {
      if (docSnap.exists()) {
        setEquipmentTypes(docSnap.data().types || []);
      }
    });
    return unsub;
  }, []);

  // No need for useEffect for editEqForm anymore

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

      // Build list of changed fields for the log
      const changed = [];
      if (editForm.firstName !== userData.firstName) changed.push('Jméno');
      if (editForm.lastName !== userData.lastName) changed.push('Příjmení');
      if (editForm.phone !== userData.phone) changed.push('Telefon');
      if (editForm.address !== userData.address) changed.push('Adresa');

      await updateDoc(userRef, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        address: editForm.address
      });

      if (changed.length > 0) {
        logAction(db, currentUser.uid, `${editForm.firstName} ${editForm.lastName}`,
          'UPDATED_PROFILE', 'profile',
          `Aktualizoval osobní údaje – změněna pole: ${changed.join(', ')}`);
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  }

  async function handleSaveEquipment(e) {
    e.preventDefault();
    if (!currentEq || !currentEq.typeId) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      const currentList = userData.equipmentList || [];
      let newList = [];
      let isNew = false;
      
      // If saving for the first time, migrate legacy data if exists
      const legacyEq = userData.equipment || {};
      const legacyItems = Object.entries(legacyEq)
        .filter(([key, d]) => d && (d.size || (d.amount && d.amount > 0)))
        .map(([key, d]) => ({
          id: `legacy_${key}`,
          typeId: key,
          size: d.size,
          amount: d.amount,
          ownership: d.ownership || 'jsdh'
        }));
        
      const baseList = currentList.length === 0 && legacyItems.length > 0 ? legacyItems : currentList;

      if (currentEq.id) {
        // Edit existing
        newList = baseList.map(item => item.id === currentEq.id ? currentEq : item);
      } else {
        // Add new
        isNew = true;
        newList = [...baseList, { ...currentEq, id: crypto.randomUUID() }];
      }

      const eqType = equipmentTypes.find(t => t.id === currentEq.typeId);
      
      await updateDoc(userRef, {
        equipmentList: newList,
        equipment: {} // clear legacy to prevent duplicates if migrated
      });

      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'UPDATED_EQUIPMENT', 'profile',
        `${isNew ? 'Přidal' : 'Upravil'} vybavení: ${eqType?.name}`);

      setShowEqModal(false);
      setCurrentEq(null);
    } catch (error) {
      console.error("Error saving equipment:", error);
    }
  }
  
  async function handleDeleteEquipment(eqId) {
    if (!window.confirm('Opravdu smazat toto vybavení?')) return;
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const currentList = userData.equipmentList || [];
      const newList = currentList.filter(item => item.id !== eqId);
      
      await updateDoc(userRef, { equipmentList: newList });
      
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        'UPDATED_EQUIPMENT', 'profile',
        `Smazal záznam vybavení.`);
    } catch (error) {
      console.error("Error deleting equipment:", error);
    }
  }

  const legacyEq = userData?.equipment || {};
  const legacyItems = Object.entries(legacyEq)
    .filter(([key, d]) => d && (d.size || (d.amount && d.amount > 0)))
    .map(([key, d]) => ({
      id: `legacy_${key}`,
      typeId: key,
      size: d.size,
      amount: d.amount,
      ownership: d.ownership || 'jsdh'
    }));
  const allEquipment = userData?.equipmentList?.length > 0 ? userData.equipmentList : (userData?.equipmentList ? [] : legacyItems);


  if (loading) return <div>Načítání...</div>;

  if (!userData) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center' }}>
        <div className="card">
          <h2 style={{ color: 'var(--primary-red)' }}>Chyba profilu</h2>
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
          <h2 style={{ color: 'var(--primary-red)' }}>Čekání na schválení</h2>
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
            {userData.registrationNumber && (
              <span style={{
                background: 'rgba(255, 193, 7, 0.15)',
                color: '#FFD54F',
                padding: '0.25rem 0.75rem',
                borderRadius: '50px',
                fontSize: '0.85rem', fontWeight: 600,
                border: '1px solid rgba(255, 193, 7, 0.3)'
              }}>
                Ev. č. {userData.registrationNumber}
              </span>
            )}
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
      </div>

      {/* 2. MAIN GRID CONTENT */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '1.5rem'
      }}>

        {/* Left Col: Personal Info & Equipment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                    <input className="input-field" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Příjmení</label>
                    <input className="input-field" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} required />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Telefon</label>
                  <input className="input-field" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label">Adresa Bydliště</label>
                  <input className="input-field" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button className="btn btn-success" style={{ background: '#2e7d32', color: 'white', flex: 1 }} type="submit">Uložit změny</button>
                  <button className="btn btn-secondary" style={{ flex: 1 }} type="button" onClick={() => setIsEditing(false)}>Zrušit</button>
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

          <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', color: '#333' }}>🧰 Přidělené vybavení</h3>
              {equipmentTypes.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCurrentEq({ typeId: equipmentTypes[0]?.id, ownership: 'jsdh' });
                    setShowEqModal(true);
                  }}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  + Přidat vybavení
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {equipmentTypes.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Vybavení není nastaveno administrátorem.</p>
              ) : allEquipment.length === 0 ? (
                <p style={{ color: '#888', fontStyle: 'italic', margin: 0 }}>Zatím nemáte evidováno žádné vybavení.</p>
              ) : (
                allEquipment.map(item => {
                  const eqType = equipmentTypes.find(t => t.id === item.typeId);
                  if (!eqType) return null;
                  
                  return (
                    <div key={item.id} style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: '#222', fontSize: '1rem' }}>{eqType.name}</span>
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: item.ownership === 'vlastni' ? '#E3F2FD' : '#E8F5E9', color: item.ownership === 'vlastni' ? '#1565C0' : '#2E7D32', fontWeight: 600 }}>
                            {item.ownership === 'vlastni' ? 'Vlastní' : 'JSDH'}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: '#555' }}>
                          {eqType.hasSize && item.size && <div><span style={{ color: '#999' }}>Velikost:</span> <strong>{item.size}</strong></div>}
                          {eqType.hasAmount && item.amount > 0 && <div><span style={{ color: '#999' }}>Ks:</span> <strong>{item.amount}</strong></div>}
                          {eqType.hasInventoryNumber && item.inventoryNumber && <div><span style={{ color: '#999' }}>Evid. č.:</span> <strong>{item.inventoryNumber}</strong></div>}
                          {eqType.hasSerialNumber && item.serialNumber && <div><span style={{ color: '#999' }}>S/N:</span> <strong>{item.serialNumber}</strong></div>}
                          {eqType.hasManufactureYear && item.manufactureYear && <div><span style={{ color: '#999' }}>Vyrobeno:</span> <strong>{item.manufactureYear}</strong></div>}
                          {eqType.hasIssueYear && item.issueYear && <div><span style={{ color: '#999' }}>Nafasováno:</span> <strong>{item.issueYear}</strong></div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, width: '100%', justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0', paddingTop: '0.5rem', marginTop: '0.5rem' }} className="mobile-only-border-top">
                        <button onClick={() => { setCurrentEq(item); setShowEqModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#1976D2' }}>✏️</button>
                        <button onClick={() => handleDeleteEquipment(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#d32f2f' }}>🗑️</button>
                      </div>
                      
                      <style dangerouslySetInnerHTML={{__html: `
                        @media (min-width: 600px) {
                          .mobile-only-border-top { border-top: none !important; padding-top: 0 !important; margin-top: 0 !important; width: auto !important; justify-content: flex-start !important; }
                        }
                      `}} />
                    </div>
                  )
                })
              )}
            </div>
          </div>
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
                    {cert}
                  </span>
                ))
              ) : (
                <p style={{ color: '#888', fontStyle: 'italic' }}>Žádné kvalifikace.</p>
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

      {/* EQUIPMENT MODAL */}
      {showEqModal && currentEq && (
        <div className="modal-overlay" onClick={() => setShowEqModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#333' }}>
              {currentEq.id ? 'Upravit vybavení' : 'Přidat vybavení'}
            </h3>
            
            <form onSubmit={handleSaveEquipment}>
              <div className="input-group">
                <label className="input-label">Druh vybavení</label>
                <select 
                  className="input-field" 
                  value={currentEq.typeId || ''} 
                  onChange={e => setCurrentEq({ ...currentEq, typeId: e.target.value })}
                  disabled={!!currentEq.id} // Cannot change type of existing item
                >
                  {equipmentTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const eqType = equipmentTypes.find(t => t.id === currentEq.typeId) || equipmentTypes[0];
                if (!eqType) return null;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="input-label">Původ (Vlastnictví)</label>
                      <select className="input-field" value={currentEq.ownership || 'jsdh'} onChange={e => setCurrentEq({...currentEq, ownership: e.target.value})}>
                        <option value="jsdh">Fasované (JSDH)</option>
                        <option value="vlastni">Vlastní</option>
                      </select>
                    </div>

                    {eqType.hasSize && (
                      <div className="input-group">
                        <label className="input-label">Velikost</label>
                        <input className="input-field" value={currentEq.size || ''} onChange={e => setCurrentEq({...currentEq, size: e.target.value})} placeholder="Např. XL, 42" />
                      </div>
                    )}
                    {eqType.hasAmount && (
                      <div className="input-group">
                        <label className="input-label">Počet kusů</label>
                        <input type="number" min="1" className="input-field" value={currentEq.amount || 1} onChange={e => setCurrentEq({...currentEq, amount: parseInt(e.target.value) || 1})} />
                      </div>
                    )}
                    {eqType.hasInventoryNumber && (
                      <div className="input-group">
                        <label className="input-label">Evidenční číslo (JSDH)</label>
                        <input className="input-field" value={currentEq.inventoryNumber || ''} onChange={e => setCurrentEq({...currentEq, inventoryNumber: e.target.value})} placeholder="Např. 123-45" />
                      </div>
                    )}
                    {eqType.hasSerialNumber && (
                      <div className="input-group">
                        <label className="input-label">Výrobní číslo (S/N)</label>
                        <input className="input-field" value={currentEq.serialNumber || ''} onChange={e => setCurrentEq({...currentEq, serialNumber: e.target.value})} placeholder="Např. AB123456" />
                      </div>
                    )}
                    {eqType.hasManufactureYear && (
                      <div className="input-group">
                        <label className="input-label">Rok výroby</label>
                        <input type="number" className="input-field" value={currentEq.manufactureYear || ''} onChange={e => setCurrentEq({...currentEq, manufactureYear: parseInt(e.target.value) || ''})} placeholder="Např. 2021" />
                      </div>
                    )}
                    {eqType.hasIssueYear && (
                      <div className="input-group">
                        <label className="input-label">Rok nafasování</label>
                        <input type="number" className="input-field" value={currentEq.issueYear || ''} onChange={e => setCurrentEq({...currentEq, issueYear: parseInt(e.target.value) || ''})} placeholder="Např. 2023" />
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn btn-success" style={{ background: '#2e7d32', color: 'white', flex: 1 }} type="submit">Uložit položku</button>
                <button className="btn btn-secondary" style={{ flex: 1 }} type="button" onClick={() => setShowEqModal(false)}>Zrušit</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
