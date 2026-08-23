import React, { useMemo, useState } from 'react';

export default function LogParticipantPicker({ members, selectedUids, onChange, externalText, setExternalText }) {
    const [search, setSearch] = useState('');

    const sortedMembers = useMemo(() => {
        return [...members].sort((a, b) => {
            const aLast = (a.lastName || '').localeCompare(b.lastName || '');
            return aLast !== 0 ? aLast : (a.firstName || '').localeCompare(b.firstName || '');
        });
    }, [members]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return sortedMembers;
        return sortedMembers.filter(m => {
            const name = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
            return name.includes(q);
        });
    }, [sortedMembers, search]);

    const toggle = (uid) => {
        if (selectedUids.includes(uid)) {
            onChange(selectedUids.filter(u => u !== uid));
        } else {
            onChange([...selectedUids, uid]);
        }
    };

    const selectedMembers = sortedMembers.filter(m => selectedUids.includes(m.uid));

    return (
        <div>
            {selectedMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    {selectedMembers.map(m => (
                        <span key={m.uid} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            background: 'var(--info-bg)', color: 'var(--info-text)',
                            padding: '0.2rem 0.55rem', borderRadius: '999px',
                            fontSize: '0.8rem', fontWeight: 600,
                            border: '1px solid var(--info-border)'
                        }}>
                            {m.firstName} {m.lastName}
                            <button
                                type="button"
                                onClick={() => toggle(m.uid)}
                                aria-label="Odebrat"
                                style={{
                                    background: 'transparent', border: 'none', color: 'var(--info-text)',
                                    cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0
                                }}
                            >×</button>
                        </span>
                    ))}
                </div>
            )}

            <input
                className="input-field"
                type="text"
                placeholder="Hledat člena..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
            />

            <div style={{
                maxHeight: '180px', overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: '8px',
                background: 'var(--surface-sunken)'
            }}>
                {filtered.length === 0 ? (
                    <div style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                        Nikdo neodpovídá hledání.
                    </div>
                ) : filtered.map(m => {
                    const isSelected = selectedUids.includes(m.uid);
                    return (
                        <label key={m.uid} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.4rem 0.6rem', cursor: 'pointer',
                            background: isSelected ? 'var(--info-bg)' : 'transparent',
                            borderBottom: '1px solid var(--surface-hover)',
                            fontSize: '0.85rem'
                        }}>
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggle(m.uid)}
                                style={{ margin: 0 }}
                            />
                            <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                                {m.firstName} {m.lastName}
                            </span>
                        </label>
                    );
                })}
            </div>

            <div className="input-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.8rem', color: 'var(--text-steel)' }}>
                    Externí osoby (volitelné, oddělte čárkou)
                </label>
                <input
                    className="input-field"
                    type="text"
                    placeholder="např. Novák, Svoboda"
                    value={externalText}
                    onChange={e => setExternalText(e.target.value)}
                />
            </div>
        </div>
    );
}
