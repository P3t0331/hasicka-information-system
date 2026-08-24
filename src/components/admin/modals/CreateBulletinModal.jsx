import React, { useState } from 'react';
import { createPortal } from 'react-dom';

const PRIORITIES = [
    { value: 'normal', label: 'Normální', color: 'var(--neutral)' },
    { value: 'important', label: 'Důležité', color: 'var(--warning-dark)' },
    { value: 'urgent', label: 'Urgentní', color: 'var(--danger-text)' },
];

export default function CreateBulletinModal({ initialPost, onClose, onSave }) {
    const isEdit = !!initialPost;
    const [title, setTitle] = useState(initialPost?.title || '');
    const [content, setContent] = useState(initialPost?.content || '');
    const [priority, setPriority] = useState(initialPost?.priority || 'normal');
    const [isPinned, setIsPinned] = useState(initialPost?.isPinned || false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!title.trim()) { setError('Vyplňte nadpis.'); return; }
        if (!content.trim()) { setError('Vyplňte text příspěvku.'); return; }
        setSaving(true);
        try {
            await onSave({ title: title.trim(), content: content.trim(), priority, isPinned });
        } finally {
            setSaving(false);
        }
    };

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
                style={{ maxWidth: '540px', width: '94%', animation: 'fadeIn 0.2s', maxHeight: '90vh', overflowY: 'auto' }}
            >
                <h3 style={{ marginTop: 0, marginBottom: '1.25rem', color: 'var(--text-charcoal)' }}>
                    {isEdit ? '✏️ Upravit příspěvek' : '📌 Nový příspěvek na nástěnku'}
                </h3>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Nadpis</label>
                        <input
                            className="input-field"
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nadpis příspěvku..."
                            maxLength={120}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Text</label>
                        <textarea
                            className="input-field"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows={5}
                            placeholder="Obsah zprávy..."
                            style={{ resize: 'vertical' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="input-group">
                            <label className="input-label">Priorita</label>
                            <select
                                className="input-field"
                                value={priority}
                                onChange={e => setPriority(e.target.value)}
                            >
                                {PRIORITIES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="input-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                            <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                cursor: 'pointer', userSelect: 'none',
                                padding: '0.55rem 0.75rem',
                                border: '1px solid var(--border)', borderRadius: '8px',
                                background: isPinned ? 'var(--warning-bg-soft)' : 'var(--surface)',
                                fontSize: '0.9rem'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={isPinned}
                                    onChange={e => setIsPinned(e.target.checked)}
                                    style={{ width: '1rem', height: '1rem', margin: 0, accentColor: 'var(--warning)' }}
                                />
                                📌 Připnout nahoře
                            </label>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            marginTop: '0.75rem', padding: '0.5rem 0.75rem',
                            background: 'var(--danger-bg)', color: 'var(--danger-text)',
                            borderRadius: '6px', fontSize: '0.85rem',
                            border: '1px solid var(--danger-border)'
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={saving}>
                            Zrušit
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
                            {saving ? 'Ukládám...' : (isEdit ? 'Uložit změny' : 'Přidat příspěvek')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
