import { useState } from 'react';

export default function CreateSuggestionModal({ onSubmit, onClose }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
            await onSubmit(title, description);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 1200,
                background: 'rgba(0,0,0,0.55)',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                padding: '1rem',
                animation: 'fadeIn 0.2s',
            }}
        >
            <div
                className="card"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '480px', width: '100%', animation: 'slideUp 0.2s' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>💡 Nový návrh</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-subtle)', lineHeight: 1 }}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                            Název návrhu *
                        </label>
                        <input
                            className="input-field"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            maxLength={100}
                            placeholder="Stručně popište váš návrh..."
                            required
                            autoFocus
                            style={{ width: '100%' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--border-medium)', textAlign: 'right', marginTop: '0.2rem' }}>
                            {title.length}/100
                        </div>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-gray)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                            Popis (volitelný)
                        </label>
                        <textarea
                            className="input-field"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            maxLength={500}
                            rows={4}
                            placeholder="Podrobnější popis návrhu..."
                            style={{ resize: 'vertical', width: '100%' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--border-medium)', textAlign: 'right', marginTop: '0.2rem' }}>
                            {description.length}/500
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={!title.trim() || saving}>
                            {saving ? 'Odesílání...' : 'Odeslat návrh'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
