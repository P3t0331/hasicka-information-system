import React from 'react';

export default function AddEquipmentTypeModal({
  newEq,
  setNewEq,
  onSubmit,
  onClose
}) {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '400px', width: '90%', animation: 'fadeIn 0.2s' }}
      >
        <h3 className="mb-4">{newEq.id ? 'Upravit druh vybavení' : 'Přidat druh vybavení'}</h3>
        <form onSubmit={onSubmit}>
          <div className="input-group">
            <label className="input-label">Název (např. Oblečení PS II)</label>
            <input
              className="input-field"
              value={newEq.name}
              onChange={e => setNewEq({ ...newEq, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasBrand} onChange={e => setNewEq({ ...newEq, hasBrand: e.target.checked })} />
              Značka
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasSize} onChange={e => setNewEq({ ...newEq, hasSize: e.target.checked })} />
              Velikost
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasAmount} onChange={e => setNewEq({ ...newEq, hasAmount: e.target.checked })} />
              Počet (ks)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasInventoryNumber} onChange={e => setNewEq({ ...newEq, hasInventoryNumber: e.target.checked })} />
              Evidenční číslo (JSDH)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasSerialNumber} onChange={e => setNewEq({ ...newEq, hasSerialNumber: e.target.checked })} />
              Výrobní číslo (S/N)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasManufactureYear} onChange={e => setNewEq({ ...newEq, hasManufactureYear: e.target.checked })} />
              Rok výroby
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={newEq.hasIssueYear} onChange={e => setNewEq({ ...newEq, hasIssueYear: e.target.checked })} />
              Rok nafasování
            </label>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Zrušit</button>
            <button type="submit" className="btn btn-primary">{newEq.id ? 'Uložit' : 'Přidat'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
