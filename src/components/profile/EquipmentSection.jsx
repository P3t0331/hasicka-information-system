import React, { useState } from 'react';
import { WEAR_OPTIONS } from '../../utils/constants';

const WEAR_COLORS = {
    1: { bg: 'var(--success-bg)', color: 'var(--success-text)', border: 'var(--success-border-strong)' },
    2: { bg: 'var(--info-bg)', color: 'var(--info-text)', border: 'var(--info-border)' },
    3: { bg: 'var(--warning-bg-soft)', color: 'var(--warning-dark)', border: 'var(--warning-border-soft)' },
    4: { bg: 'var(--warning-bg)', color: 'var(--warning-text-strong)', border: 'var(--warning-border)' },
    5: { bg: 'var(--danger-bg)', color: 'var(--danger-dark)', border: 'var(--danger-border-strong)' },
};

function pluralPolozek(n) {
    if (n === 1) return 'položka';
    if (n >= 2 && n <= 4) return 'položky';
    return 'položek';
}

function EmptyState({ message }) {
    return (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4 }}>🧰</div>
            <p style={{ fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>{message}</p>
        </div>
    );
}


export default function EquipmentSection({ equipmentTypes, allEquipment, setCurrentEq, setShowEqModal, handleDeleteEquipment }) {
    const [sortBy, setSortBy] = useState('type');

    // Sorting by evidenční číslo only makes sense once something actually has one.
    const canSortByInventory = allEquipment.length > 1
        && allEquipment.some(item => (item.inventoryNumber || '').trim());

    const sortedEquipment = [...allEquipment].sort((a, b) => {
        if (sortBy === 'inventoryNumber') {
            // "123-45" style numbers — natural compare, items without one go last.
            const av = (a.inventoryNumber || '').trim();
            const bv = (b.inventoryNumber || '').trim();
            if (av && bv) return av.localeCompare(bv, 'cs', { numeric: true, sensitivity: 'base' });
            if (av) return -1;
            if (bv) return 1;
        }
        const ai = equipmentTypes.findIndex(t => t.id === a.typeId);
        const bi = equipmentTypes.findIndex(t => t.id === b.typeId);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    return (
        <>
            <style>{`
                .eq-wrap {
                    background: var(--glass-bg);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border-radius: var(--radius);
                    box-shadow: var(--shadow-soft);
                    border: var(--glass-border);
                    overflow: hidden;
                }
                .eq-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.35rem 1.75rem;
                    background: var(--surface-alt);
                    border-bottom: 1px solid rgba(0,0,0,0.07);
                }
                .eq-header-title {
                    font-family: 'Oswald', sans-serif;
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    text-transform: uppercase;
                    letter-spacing: 0.7px;
                    margin: 0 0 0.15rem;
                }
                .eq-header-sub {
                    font-size: 0.8rem;
                    color: var(--text-faint);
                    margin: 0;
                }
                .eq-sort {
                    padding: 0.5rem 0.7rem;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: var(--surface);
                    color: var(--text-secondary);
                    font-family: 'Inter', sans-serif;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .eq-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .eq-item {
                    display: flex;
                    align-items: center;
                    gap: 1.1rem;
                    padding: 1.05rem 1.75rem;
                    border-bottom: 1px solid var(--border);
                    transition: background 0.12s;
                    position: relative;
                }
                .eq-item:last-child { border-bottom: none; }
                .eq-item::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: transparent;
                    transition: background 0.12s;
                    border-radius: 0 2px 2px 0;
                }
                .eq-item:hover { background: var(--danger-bg-soft); }
                .eq-item:hover::before { background: var(--primary-red); }
                .eq-info {
                    flex: 0 0 auto;
                    min-width: 150px;
                    max-width: 200px;
                }
                .eq-name {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1.3;
                    margin-bottom: 0.35rem;
                }
                .eq-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.3rem;
                }
                .eq-badge {
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.7rem;
                    padding: 0.18rem 0.58rem;
                    border-radius: 20px;
                    font-weight: 600;
                    border: 1px solid;
                    line-height: 1.6;
                    white-space: nowrap;
                }
                .eq-divider {
                    width: 1px;
                    height: 36px;
                    background: var(--border);
                    flex-shrink: 0;
                }
                .eq-details {
                    flex: 1;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem 1.25rem;
                    min-width: 0;
                }
                .eq-detail-pair {
                    display: flex;
                    flex-direction: column;
                    gap: 0.05rem;
                    min-width: 60px;
                }
                .eq-detail-label {
                    font-size: 0.64rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: var(--text-faint);
                    white-space: nowrap;
                }
                .eq-detail-value {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    white-space: nowrap;
                }
                .eq-actions {
                    display: flex;
                    gap: 0.2rem;
                    flex-shrink: 0;
                    margin-left: auto;
                    padding-left: 2rem;
                    opacity: 0;
                    transition: opacity 0.15s;
                }
                .eq-item:hover .eq-actions { opacity: 1; }
                .eq-act-btn {
                    background: none;
                    border: 1px solid transparent;
                    cursor: pointer;
                    padding: 0.32rem 0.72rem;
                    border-radius: 7px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    transition: background 0.12s, border-color 0.12s;
                    white-space: nowrap;
                }
                .eq-act-btn.edit { color: var(--info-text); }
                .eq-act-btn.edit:hover { background: var(--info-bg); border-color: var(--info-border); }
                .eq-act-btn.del { color: var(--danger-dark); }
                .eq-act-btn.del:hover { background: var(--danger-bg); border-color: var(--danger-border-strong); }

                @media (max-width: 900px) {
                    .eq-divider { display: none; }
                    .eq-info { min-width: 0; max-width: none; flex: 0 0 160px; }
                }
                @media (max-width: 640px) {
                    .eq-header { padding: 1.1rem 1.25rem; }
                    .eq-item {
                        padding: 1rem 1.25rem;
                        flex-wrap: wrap;
                        gap: 0.75rem;
                    }
                    .eq-info { flex: 1; min-width: 0; max-width: none; }
                    .eq-divider { display: none; }
                    .eq-details {
                        width: 100%;
                        gap: 0.5rem 1rem;
                    }
                    .eq-actions {
                        opacity: 1;
                        padding-left: 0;
                        margin-left: 0;
                        width: 100%;
                    }
                    .eq-item::before { display: none; }
                }
            `}</style>

            <div className="eq-wrap">
                <div className="eq-header">
                    <div>
                        <p className="eq-header-title">Přidělené vybavení</p>
                        <p className="eq-header-sub">{allEquipment.length} {pluralPolozek(allEquipment.length)}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                        {canSortByInventory && (
                            <select
                                className="eq-sort"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                aria-label="Řazení vybavení"
                            >
                                <option value="type">Řadit: Druh</option>
                                <option value="inventoryNumber">Řadit: Ev. číslo</option>
                            </select>
                        )}
                        {equipmentTypes.length > 0 && (
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setCurrentEq({ typeId: equipmentTypes[0]?.id, ownership: 'jsdh' });
                                    setShowEqModal(true);
                                }}
                                style={{ padding: '0.58rem 1.2rem', fontSize: '0.88rem', flexShrink: 0 }}
                            >
                                + Přidat
                            </button>
                        )}
                    </div>
                </div>

                {equipmentTypes.length === 0 ? (
                    <EmptyState message="Vybavení není nastaveno administrátorem." />
                ) : allEquipment.length === 0 ? (
                    <EmptyState message="Zatím nemáte evidováno žádné vybavení." />
                ) : (
                    <ul className="eq-list">
                        {sortedEquipment.map(item => {
                            const eqType = equipmentTypes.find(t => t.id === item.typeId);
                            if (!eqType) return null;

                            const wearOption = WEAR_OPTIONS.find(o => o.value === item.wear);
                            const wearColors = item.wear != null ? WEAR_COLORS[item.wear] : null;
                            const isJSDH = item.ownership !== 'vlastni';

                            const details = [
                                eqType.hasBrand && item.brand && { label: 'Značka', value: item.brand },
                                eqType.hasSize && item.size && { label: 'Velikost', value: item.size },
                                eqType.hasAmount && { label: 'Počet', value: `${item.amount || 1} ks` },
                                eqType.hasInventoryNumber && item.inventoryNumber && { label: 'Evid. č.', value: item.inventoryNumber },
                                eqType.hasSerialNumber && item.serialNumber && { label: 'S/N', value: item.serialNumber },
                                eqType.hasManufactureYear && item.manufactureYear && { label: 'Rok výroby', value: item.manufactureYear },
                                eqType.hasIssueYear && item.issueYear && { label: 'Nafasováno', value: item.issueYear },
                                eqType.hasPolep && item.polep != null && { label: 'Polep', value: item.polep ? 'ANO' : 'NE' },
                            ].filter(Boolean);

                            return (
                                <li key={item.id} className="eq-item">

                                    <div className="eq-info">
                                        <div className="eq-name">{eqType.name}</div>
                                        <div className="eq-badges">
                                            <span className="eq-badge" style={{
                                                background: isJSDH ? 'var(--danger-bg)' : 'var(--info-bg)',
                                                color: isJSDH ? 'var(--danger-text)' : 'var(--info-text)',
                                                borderColor: isJSDH ? 'var(--danger-border-strong)' : 'var(--info-border)',
                                            }}>
                                                {isJSDH ? 'JSDH' : 'Vlastní'}
                                            </span>
                                            {wearOption && eqType.hasWear && wearColors && (
                                                <span className="eq-badge" style={{
                                                    background: wearColors.bg,
                                                    color: wearColors.color,
                                                    borderColor: wearColors.border,
                                                }}>
                                                    {wearOption.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {details.length > 0 && <div className="eq-divider" />}

                                    {details.length > 0 && (
                                        <div className="eq-details">
                                            {details.map(d => (
                                                <div key={d.label} className="eq-detail-pair">
                                                    <span className="eq-detail-label">{d.label}</span>
                                                    <span className="eq-detail-value">{d.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="eq-actions">
                                        <button
                                            className="eq-act-btn edit"
                                            onClick={() => { setCurrentEq(item); setShowEqModal(true); }}
                                        >
                                            Upravit
                                        </button>
                                        <button
                                            className="eq-act-btn del"
                                            onClick={() => handleDeleteEquipment(item.id)}
                                        >
                                            Smazat
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
}
