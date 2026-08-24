import { useState } from 'react';
import useSuggestions from '../../hooks/useSuggestions';
import SuggestionCard from '../suggestions/SuggestionCard';
import { useAuth } from '../../contexts/AuthContext';

const STATUS_FILTERS = [
    { id: 'all',      label: 'Vše' },
    { id: 'open',     label: 'Otevřeno' },
    { id: 'planned',  label: 'Plánováno' },
    { id: 'done',     label: 'Hotovo' },
    { id: 'rejected', label: 'Zamítnuto' },
];

const STATUS_OPTIONS = [
    { value: 'open',     label: 'Otevřeno' },
    { value: 'planned',  label: 'Plánováno' },
    { value: 'done',     label: 'Hotovo' },
    { value: 'rejected', label: 'Zamítnuto' },
];

export default function SuggestionsAdminTab() {
    const { currentUser } = useAuth();
    const { suggestions, loading, vote, updateSuggestion, deleteSuggestion } = useSuggestions();
    const [statusFilter, setStatusFilter] = useState('all');
    const [editStates, setEditStates] = useState({});
    const [confirmDelete, setConfirmDelete] = useState(null);

    const filtered = statusFilter === 'all'
        ? suggestions
        : suggestions.filter(s => s.status === statusFilter);

    const getEdit = (id, suggestion) => editStates[id] ?? { status: suggestion.status, adminNote: suggestion.adminNote || '' };

    const setEdit = (id, patch) => setEditStates(prev => ({
        ...prev,
        [id]: { ...getEdit(id, suggestions.find(s => s.id === id) || {}), ...patch },
    }));

    const handleSave = async (id) => {
        const edit = editStates[id];
        if (!edit) return;
        await updateSuggestion(id, edit);
        setEditStates(prev => { const n = { ...prev }; delete n[id]; return n; });
    };

    const handleDelete = async (id) => {
        await deleteSuggestion(id);
        setConfirmDelete(null);
    };

    if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Načítání návrhů...</div>;

    return (
        <div>
            {confirmDelete && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1200,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                }} onClick={() => setConfirmDelete(null)}>
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%' }}>
                        <h3 style={{ marginBottom: '0.75rem' }}>Smazat návrh?</h3>
                        <p style={{ color: 'var(--text-dim)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>Tato akce je nevratná.</p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Zrušit</button>
                            <button className="btn btn-primary" onClick={() => handleDelete(confirmDelete)}>Smazat</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>💡 Návrhy členů</h2>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{suggestions.length} celkem</p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setStatusFilter(f.id)}
                            style={{
                                padding: '0.35rem 0.9rem',
                                borderRadius: '50px',
                                border: '1.5px solid',
                                borderColor: statusFilter === f.id ? 'var(--primary-red)' : 'var(--border)',
                                background: statusFilter === f.id ? 'var(--primary-red)' : 'var(--surface)',
                                color: statusFilter === f.id ? 'var(--text-on-dark)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: statusFilter === f.id ? 700 : 400,
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-subtle)' }}>
                    Žádné návrhy v této kategorii.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filtered.map(suggestion => {
                        const edit = getEdit(suggestion.id, suggestion);
                        const isDirty = editStates[suggestion.id] !== undefined;

                        return (
                            <div key={suggestion.id} style={{
                                background: 'var(--surface)',
                                borderRadius: '10px',
                                padding: '1.25rem 1.4rem',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                                border: '1px solid var(--surface-hover)',
                            }}>
                                <SuggestionCard
                                    suggestion={suggestion}
                                    currentUser={currentUser}
                                    isAdmin={true}
                                    onVote={vote}
                                    onDelete={() => setConfirmDelete(suggestion.id)}
                                />

                                <div style={{
                                    marginTop: '1rem',
                                    paddingTop: '1rem',
                                    borderTop: '1px solid var(--surface-hover)',
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'flex-end',
                                    flexWrap: 'wrap',
                                }}>
                                    <div style={{ flex: '0 0 160px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                                            Status
                                        </label>
                                        <select
                                            className="input-field"
                                            value={edit.status}
                                            onChange={e => setEdit(suggestion.id, { status: e.target.value })}
                                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                                        >
                                            {STATUS_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                                            Poznámka admina
                                        </label>
                                        <input
                                            className="input-field"
                                            type="text"
                                            value={edit.adminNote}
                                            onChange={e => setEdit(suggestion.id, { adminNote: e.target.value })}
                                            placeholder="Viditelná pro všechny členy..."
                                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                                        />
                                    </div>
                                    {isDirty && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleSave(suggestion.id)}
                                            style={{ padding: '0.5rem 1.2rem', fontSize: '0.88rem', alignSelf: 'flex-end' }}
                                        >
                                            Uložit
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
