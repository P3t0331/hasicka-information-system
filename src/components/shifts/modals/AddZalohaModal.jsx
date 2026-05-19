import React, { useState } from 'react';

export default function AddZalohaModal({ date, onClose, onSubmit }) {
  const [timeFrom, setTimeFrom] = useState('07:00');
  const [timeTo, setTimeTo] = useState('19:00');
  const [velitelCount, setVelitelCount] = useState(1);
  const [strojnikCount, setStrojnikCount] = useState(1);
  const [hasicCount, setHasicCount] = useState(2);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      timeFrom,
      timeTo,
      velitelCount,
      strojnikCount,
      hasicCount
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', width: '90%', padding: '1.5rem', borderRadius: '12px', background: 'white' }}>
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1565C0', textAlign: 'center' }}>
          🛡️ Záloha / Stáž ({date}.)
        </h3>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Čas OD:</label>
              <input 
                type="time" 
                value={timeFrom} 
                onChange={e => setTimeFrom(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #BBDEFB', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>Čas DO:</label>
              <input 
                type="time" 
                value={timeTo} 
                onChange={e => setTimeTo(e.target.value)}
                required
                style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: '2px solid #BBDEFB', fontSize: '1rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Velitel (1-2)</label>
               <input type="number" min="1" max="2" value={velitelCount} onChange={e => setVelitelCount(parseInt(e.target.value)||1)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Strojník (1-2)</label>
               <input type="number" min="1" max="2" value={strojnikCount} onChange={e => setStrojnikCount(parseInt(e.target.value)||1)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
             <div>
               <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.75rem', color: '#555', fontWeight: 600, textAlign: 'center' }}>Hasič (2-5)</label>
               <input type="number" min="2" max="5" value={hasicCount} onChange={e => setHasicCount(parseInt(e.target.value)||2)} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center', boxSizing: 'border-box' }} />
             </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: '2px solid #BBDEFB', background: 'white', color: '#1565C0', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>Zrušit</button>
            <button type="submit" style={{ flex: 1, padding: '0.85rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #1976D2, #1565C0)', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(25, 118, 210, 0.3)' }}>Vytvořit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
