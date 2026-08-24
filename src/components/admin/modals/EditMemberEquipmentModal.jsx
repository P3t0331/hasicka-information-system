import React from 'react';
import { createPortal } from 'react-dom';
import { WEAR_OPTIONS } from '../../../utils/constants';

export default function EditMemberEquipmentModal({
  currentEq,
  setCurrentEq,
  targetUserId,
  setTargetUserId,
  allUsers,
  equipmentTypes,
  onClose,
  onSave
}) {
  const eqType = equipmentTypes.find(t => t.id === currentEq.typeId) || equipmentTypes[0];

  return createPortal(
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
        style={{ maxWidth: '500px', width: '90%', animation: 'fadeIn 0.2s', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-charcoal)' }}>
          {currentEq.id && !currentEq.id.startsWith('new_') ? 'Upravit vybavení' : 'Přidat vybavení členovi'}
        </h3>

        <form onSubmit={onSave}>
          {currentEq.id && currentEq.id.startsWith('new_') && (
            <div className="input-group">
              <label className="input-label">Vyberte člena</label>
              <select className="input-field" value={targetUserId || ''} onChange={e => setTargetUserId(e.target.value)} required>
                <option value="" disabled>Zvolte člena</option>
                {allUsers.filter(u => !u.disabled).map(u => (
                  <option key={u.uid} value={u.uid}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Druh vybavení</label>
            <select
              className="input-field"
              value={currentEq.typeId || ''}
              onChange={e => setCurrentEq({ ...currentEq, typeId: e.target.value })}
              disabled={currentEq.id && !currentEq.id.startsWith('new_')}
            >
              {equipmentTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {eqType && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Původ (Vlastnictví)</label>
                <select
                  className="input-field"
                  value={currentEq.ownership || 'jsdh'}
                  onChange={e => setCurrentEq({ ...currentEq, ownership: e.target.value })}
                >
                  <option value="jsdh">Fasované (JSDH)</option>
                  <option value="vlastni">Vlastní</option>
                </select>
              </div>

              {eqType.hasBrand && (
                <div className="input-group">
                  <label className="input-label">Značka / Výrobce</label>
                  <input
                    className="input-field"
                    value={currentEq.brand || ''}
                    onChange={e => setCurrentEq({ ...currentEq, brand: e.target.value })}
                    placeholder="Např. Rosenbauer"
                  />
                </div>
              )}

              {eqType.hasSize && (
                <div className="input-group">
                  <label className="input-label">Velikost</label>
                  <input
                    className="input-field"
                    value={currentEq.size || ''}
                    onChange={e => setCurrentEq({ ...currentEq, size: e.target.value })}
                    placeholder="Např. XL, 42"
                  />
                </div>
              )}

              {eqType.hasAmount && (
                <div className="input-group">
                  <label className="input-label">Počet kusů</label>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="input-field"
                    value={currentEq.amount ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      setCurrentEq({ ...currentEq, amount: v === '' ? '' : (parseInt(v) || '') });
                    }}
                    onBlur={() => {
                      if (!currentEq.amount || currentEq.amount < 1) {
                        setCurrentEq({ ...currentEq, amount: 1 });
                      }
                    }}
                  />
                </div>
              )}

              {eqType.hasInventoryNumber && (
                <div className="input-group">
                  <label className="input-label">Evidenční číslo (JSDH)</label>
                  <input
                    className="input-field"
                    value={currentEq.inventoryNumber || ''}
                    onChange={e => setCurrentEq({ ...currentEq, inventoryNumber: e.target.value })}
                    placeholder="Např. 123-45"
                  />
                </div>
              )}

              {eqType.hasSerialNumber && (
                <div className="input-group">
                  <label className="input-label">Výrobní číslo (S/N)</label>
                  <input
                    className="input-field"
                    value={currentEq.serialNumber || ''}
                    onChange={e => setCurrentEq({ ...currentEq, serialNumber: e.target.value })}
                    placeholder="Např. AB123456"
                  />
                </div>
              )}

              {eqType.hasManufactureYear && (
                <div className="input-group">
                  <label className="input-label">Rok výroby</label>
                  <input
                    type="number"
                    className="input-field"
                    value={currentEq.manufactureYear || ''}
                    onChange={e => setCurrentEq({ ...currentEq, manufactureYear: parseInt(e.target.value) || '' })}
                    placeholder="Např. 2021"
                  />
                </div>
              )}

              {eqType.hasIssueYear && (
                <div className="input-group">
                  <label className="input-label">Rok nafasování</label>
                  <input
                    type="number"
                    className="input-field"
                    value={currentEq.issueYear || ''}
                    onChange={e => setCurrentEq({ ...currentEq, issueYear: parseInt(e.target.value) || '' })}
                    placeholder="Např. 2023"
                  />
                </div>
              )}

              {eqType.hasWear && (
                <div className="input-group">
                  <label className="input-label">Stav opotřebení</label>
                  <select
                    className="input-field"
                    value={currentEq.wear ?? ''}
                    onChange={e => {
                      const v = e.target.value;
                      setCurrentEq({ ...currentEq, wear: v === '' ? null : parseInt(v) });
                    }}
                  >
                    <option value="">— Neuvedeno —</option>
                    {WEAR_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {eqType.hasPolep && (
                <div className="input-group">
                  <label className="input-label">Polep</label>
                  <select
                    className="input-field"
                    value={currentEq.polep === true ? 'ano' : currentEq.polep === false ? 'ne' : ''}
                    onChange={e => {
                      const v = e.target.value;
                      setCurrentEq({ ...currentEq, polep: v === 'ano' ? true : v === 'ne' ? false : null });
                    }}
                  >
                    <option value="">— Neuvedeno —</option>
                    <option value="ano">ANO</option>
                    <option value="ne">NE</option>
                  </select>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-success" style={{ background: 'var(--success-text)', color: 'var(--text-on-dark)', flex: 1 }} type="submit">Uložit položku</button>
            <button className="btn btn-secondary" style={{ flex: 1 }} type="button" onClick={onClose}>Zrušit</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
