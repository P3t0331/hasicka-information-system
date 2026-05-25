import React from 'react';
import { WEAR_OPTIONS, getWearStyle } from '../../utils/constants';

export default function EquipmentSection({ equipmentTypes, allEquipment, setCurrentEq, setShowEqModal, handleDeleteEquipment }) {
    return (
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
                    [...allEquipment]
                        .sort((a, b) => {
                            const ai = equipmentTypes.findIndex(t => t.id === a.typeId);
                            const bi = equipmentTypes.findIndex(t => t.id === b.typeId);
                            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                        })
                        .map(item => {
                        const eqType = equipmentTypes.find(t => t.id === item.typeId);
                        if (!eqType) return null;
                        const wearOption = WEAR_OPTIONS.find(o => o.value === item.wear);

                        return (
                            <div key={item.id} style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, color: '#222', fontSize: '1rem' }}>{eqType.name}</span>
                                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: item.ownership === 'vlastni' ? '#E3F2FD' : '#E8F5E9', color: item.ownership === 'vlastni' ? '#1565C0' : '#2E7D32', fontWeight: 600 }}>
                                            {item.ownership === 'vlastni' ? 'Vlastní' : 'JSDH'}
                                        </span>
                                        {wearOption && eqType.hasWear && (
                                            <span style={{ ...getWearStyle(item.wear), fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                                {wearOption.label}
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.85rem', color: '#555' }}>
                                        {eqType.hasBrand && item.brand && <div><span style={{ color: '#999' }}>Značka:</span> <strong>{item.brand}</strong></div>}
                                        {eqType.hasSize && item.size && <div><span style={{ color: '#999' }}>Velikost:</span> <strong>{item.size}</strong></div>}
                                        {eqType.hasAmount && <div><span style={{ color: '#999' }}>Ks:</span> <strong>{item.amount || 1}</strong></div>}
                                        {eqType.hasInventoryNumber && item.inventoryNumber && <div><span style={{ color: '#999' }}>Evid. č.:</span> <strong>{item.inventoryNumber}</strong></div>}
                                        {eqType.hasSerialNumber && item.serialNumber && <div><span style={{ color: '#999' }}>S/N:</span> <strong>{item.serialNumber}</strong></div>}
                                        {eqType.hasManufactureYear && item.manufactureYear && <div><span style={{ color: '#999' }}>Vyrobeno:</span> <strong>{item.manufactureYear}</strong></div>}
                                        {eqType.hasIssueYear && item.issueYear && <div><span style={{ color: '#999' }}>Nafasováno:</span> <strong>{item.issueYear}</strong></div>}
                                        {eqType.hasPolep && item.polep != null && <div><span style={{ color: '#999' }}>Polep:</span> <strong>{item.polep ? 'ANO' : 'NE'}</strong></div>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, width: '100%', justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0', paddingTop: '0.5rem', marginTop: '0.5rem' }} className="mobile-only-border-top">
                                    <button onClick={() => { setCurrentEq(item); setShowEqModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#1976D2' }}>✏️</button>
                                    <button onClick={() => handleDeleteEquipment(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#d32f2f' }}>×</button>
                                </div>

                                <style dangerouslySetInnerHTML={{__html: `
                                    @media (min-width: 600px) {
                                        .mobile-only-border-top { border-top: none !important; padding-top: 0 !important; margin-top: 0 !important; width: auto !important; justify-content: flex-start !important; }
                                    }
                                `}} />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
