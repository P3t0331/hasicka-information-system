import React, { useState } from 'react';
import EditMemberEquipmentModal from './modals/EditMemberEquipmentModal';

export default function DetailedInventoryTab({
  allUsers,
  equipmentTypes,
  onSaveEquipment,
  onDeleteEquipment
}) {
  const [filterUser, setFilterUser] = useState('all');
  const [filterType, setFilterType] = useState('all');
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
    return true;
  });

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

      <div style={{ borderRadius: '8px', border: '1px solid #eee' }}>
        <table className="responsive-table" style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead style={{ background: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Uživatel</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Typ vybavení</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Vlastnictví</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Značka</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Detaily (Vel/Ks)</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Evid. čísla</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Roky (Výr/Naf)</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Akce</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                  Žádné vybavení neodpovídá filtru.
                </td>
              </tr>
            ) : filtered.map((item, i) => {
              const eqType = equipmentTypes.find(t => t.id === item.typeId) || { name: 'Neznámý' };

              return (
                <tr key={item.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <td data-label="Uživatel" style={{ padding: '0.75rem', fontWeight: 600 }}>{item._userName}</td>
                  <td data-label="Typ vybavení" style={{ padding: '0.75rem', color: '#1565C0', fontWeight: 600 }}>{eqType.name}</td>
                  <td data-label="Vlastnictví" style={{ padding: '0.75rem' }}>
                    {item.ownership === 'vlastni' ? (
                      <span style={{ color: '#1565C0', background: '#E3F2FD', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>Vlastní</span>
                    ) : (
                      <span style={{ color: '#2E7D32', background: '#E8F5E9', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>JSDH</span>
                    )}
                  </td>
                  <td data-label="Značka" style={{ padding: '0.75rem', color: '#555' }}>
                    {item.brand || <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td data-label="Detaily" style={{ padding: '0.75rem' }}>
                    {item.size && <div style={{ marginBottom: '0.2rem' }}><span style={{ color: '#888' }}>Vel:</span> {item.size}</div>}
                    {eqType.hasAmount && <div><span style={{ color: '#888' }}>Ks:</span> {item.amount || 1}</div>}
                  </td>
                  <td data-label="Evid. čísla" style={{ padding: '0.75rem' }}>
                    {item.inventoryNumber && <div style={{ marginBottom: '0.2rem' }}><span style={{ color: '#888' }}>Evid:</span> {item.inventoryNumber}</div>}
                    {item.serialNumber && <div><span style={{ color: '#888' }}>S/N:</span> {item.serialNumber}</div>}
                  </td>
                  <td data-label="Roky" style={{ padding: '0.75rem' }}>
                    {item.manufactureYear && <div style={{ marginBottom: '0.2rem' }}><span style={{ color: '#888' }}>Výr:</span> {item.manufactureYear}</div>}
                    {item.issueYear && <div><span style={{ color: '#888' }}>Naf:</span> {item.issueYear}</div>}
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
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#d32f2f' }}
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
