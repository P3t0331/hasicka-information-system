import React, { useState } from 'react';
import EditMemberEquipmentModal from './modals/EditMemberEquipmentModal';
import { WEAR_OPTIONS, getWearStyle, getWearRowStyle } from '../../utils/constants';

export default function DetailedInventoryTab({
  allUsers,
  equipmentTypes,
  onSaveEquipment,
  onDeleteEquipment
}) {
  const [filterUser, setFilterUser] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterWear, setFilterWear] = useState('all');
  const [sortBy, setSortBy] = useState('user');
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentEq, setCurrentEq] = useState(null);
  const [targetUserId, setTargetUserId] = useState(null);

  // Extract all equipment items from all users
  const allItems = [];
  allUsers.forEach(user => {
    const list = user.equipmentList || [];
    list.forEach(item => {
      allItems.push({ ...item, _userId: user.uid, _userName: `${user.firstName} ${user.lastName}` });
    });
  });

  // Filter items
  const filtered = allItems.filter(item => {
    if (filterUser !== 'all' && item._userId !== filterUser) return false;
    if (filterType !== 'all' && item.typeId !== filterType) return false;
    if (filterWear !== 'all') {
      if (filterWear === 'none') {
        if (item.wear) return false;
      } else if (item.wear !== parseInt(filterWear)) {
        return false;
      }
    }
    return true;
  });

  // Evidenční čísla look like "123-45", so compare them naturally rather than as
  // plain numbers. Items without a number (types that don't track one) go last.
  const byInventoryNumber = (a, b) => {
    const av = (a.inventoryNumber || '').trim();
    const bv = (b.inventoryNumber || '').trim();
    if (!av && !bv) return 0;
    if (!av) return 1;
    if (!bv) return -1;
    return av.localeCompare(bv, 'cs', { numeric: true, sensitivity: 'base' });
  };

  // 'user' keeps the original grouping by member — no sorting applied.
  const sorted = sortBy === 'inventoryNumber' ? [...filtered].sort(byInventoryNumber) : filtered;

  const handleOpenAddModal = () => {
    const firstUser = allUsers.filter(u => !u.disabled)[0];
    setTargetUserId(firstUser?.uid || null);
    setCurrentEq({ id: 'new_' + Date.now(), typeId: equipmentTypes[0]?.id || '', ownership: 'jsdh' });
    setShowEditModal(true);
  };

  const handleOpenEditModal = (item) => {
    setTargetUserId(item._userId);
    setCurrentEq(item);
    setShowEditModal(true);
  };

  return (
    <div className="card" style={{ padding: '1.25rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Detailní inventář vybavení</h3>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="input-label">Filtr dle uživatele</label>
          <select className="input-field" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="all">Všichni členové</option>
            {allUsers.filter(u => !u.disabled).map(u => (
              <option key={u.uid} value={u.uid}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="input-label">Filtr dle typu vybavení</label>
          <select className="input-field" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">Všechny typy</option>
            {equipmentTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="input-label">Filtr dle stavu opotřebení</label>
          <select className="input-field" value={filterWear} onChange={e => setFilterWear(e.target.value)}>
            <option value="all">Všechny stavy</option>
            <option value="none">Bez stavu</option>
            {WEAR_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label className="input-label">Řazení</label>
          <select className="input-field" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="user">Řadit: Člen</option>
            <option value="inventoryNumber">Řadit: Ev. číslo</option>
          </select>
        </div>
        <div>
          <button
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            disabled={allUsers.length === 0 || equipmentTypes.length === 0}
          >
            + Přidat vybavení členovi
          </button>
        </div>
      </div>

      <div style={{ borderRadius: '8px', border: '1px solid var(--border)' }}>
        <table className="responsive-table" style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead style={{ background: 'var(--surface-alt)' }}>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Uživatel</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Typ vybavení</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Vlastnictví</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Značka</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Detaily (Vel/Ks)</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Evid. čísla</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Roky (Výr/Naf)</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Stav</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>Polep</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid var(--border)' }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Žádné vybavení neodpovídá filtru.
                </td>
              </tr>
            ) : sorted.map((item, i) => {
              const eqType = equipmentTypes.find(t => t.id === item.typeId) || { name: 'Neznámý' };
              const showWear = !!eqType.hasWear;
              const wearRowStyle = showWear ? getWearRowStyle(item.wear) : null;
              const wearBadgeStyle = getWearStyle(item.wear);
              const wearOption = WEAR_OPTIONS.find(o => o.value === item.wear);

              return (
                <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--surface-sunken)', borderBottom: '1px solid var(--surface-hover)', ...(wearRowStyle || {}) }}>
                  <td data-label="Uživatel" style={{ padding: '0.75rem', fontWeight: 600 }}>{item._userName}</td>
                  <td data-label="Typ vybavení" style={{ padding: '0.75rem', color: 'var(--info-text)', fontWeight: 600 }}>{eqType.name}</td>
                  <td data-label="Vlastnictví" style={{ padding: '0.75rem' }}>
                    {item.ownership === 'vlastni' ? (
                      <span style={{ color: 'var(--info-text)', background: 'var(--info-bg)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Vlastní</span>
                    ) : (
                      <span style={{ color: 'var(--success-text)', background: 'var(--success-bg)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>JSDH</span>
                    )}
                  </td>
                  <td data-label="Značka" style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                    {item.brand || <span style={{ color: 'var(--border-medium)' }}>—</span>}
                  </td>
                  <td data-label="Detaily" style={{ padding: '0.75rem' }}>
                    {item.size && <div style={{ marginBottom: '0.2rem' }}><span style={{ color: 'var(--text-muted)' }}>Vel:</span> {item.size}</div>}
                    {eqType.hasAmount && <div><span style={{ color: 'var(--text-muted)' }}>Ks:</span> {item.amount || 1}</div>}
                  </td>
                  <td data-label="Evid. čísla" style={{ padding: '0.75rem' }}>
                    {item.inventoryNumber && <div style={{ marginBottom: '0.2rem' }}><span style={{ color: 'var(--text-muted)' }}>Evid:</span> {item.inventoryNumber}</div>}
                    {item.serialNumber && <div><span style={{ color: 'var(--text-muted)' }}>S/N:</span> {item.serialNumber}</div>}
                  </td>
                  <td data-label="Roky" style={{ padding: '0.75rem' }}>
                    {item.manufactureYear && <div style={{ marginBottom: '0.2rem' }}><span style={{ color: 'var(--text-muted)' }}>Výr:</span> {item.manufactureYear}</div>}
                    {item.issueYear && <div><span style={{ color: 'var(--text-muted)' }}>Naf:</span> {item.issueYear}</div>}
                  </td>
                  <td data-label="Stav" style={{ padding: '0.75rem' }}>
                    {showWear && wearOption ? (
                      <span style={{ ...wearBadgeStyle, padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {wearOption.label}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--border-medium)' }}>—</span>
                    )}
                  </td>
                  <td data-label="Polep" style={{ padding: '0.75rem' }}>
                    {eqType.hasPolep && item.polep != null ? (
                      <span style={{
                        background: item.polep ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: item.polep ? 'var(--success-text)' : 'var(--danger-text)',
                        padding: '0.15rem 0.5rem', borderRadius: '4px',
                        fontSize: '0.8rem', fontWeight: 600
                      }}>
                        {item.polep ? 'ANO' : 'NE'}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--border-medium)' }}>—</span>
                    )}
                  </td>
                  <td data-label="Akce" style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                        title="Upravit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDeleteEquipment(item.id, item._userId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--danger)' }}
                        title="Smazat"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showEditModal && currentEq && (
        <EditMemberEquipmentModal
          currentEq={currentEq}
          setCurrentEq={setCurrentEq}
          targetUserId={targetUserId}
          setTargetUserId={setTargetUserId}
          allUsers={allUsers}
          equipmentTypes={equipmentTypes}
          onClose={() => setShowEditModal(false)}
          onSave={(e) => {
            onSaveEquipment(e, currentEq, targetUserId);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}
