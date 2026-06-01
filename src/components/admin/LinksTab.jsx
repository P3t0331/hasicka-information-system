import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logAction } from '../../utils/logger';

const DEFAULT_LINKS = [
    { id: 'navody', emoji: '📖', label: 'Návody k obsluze', url: 'https://docs.google.com/spreadsheets/d/1qWtU8OSbAX1PB9biEztcqjwtLVIx3KBegE1L52FOWhM/edit?gid=0#gid=0', description: 'Kompletní dokumentace k technice' },
    { id: 'vzdelavani', emoji: '🎓', label: 'Učební materiály', url: 'https://www.hasici-vzdelavani.cz/', description: 'Portál hasičského vzdělávání' },
    { id: 'jsdh', emoji: '🌐', label: 'Portál JSDH', url: 'https://jsdh.izscr.cz/', description: 'Informační systém pro hasiče' },
    { id: 'firebrno', emoji: '🚒', label: 'Fire Brno', url: 'https://udalosti.firebrno.cz/', description: 'Přehled událostí HZS JMK' },
    { id: 'disk', emoji: '📁', label: 'Google Disk', url: 'https://drive.google.com/drive/folders/1CCvV1OuTlbsjLtfQSzU6WpZynDLRTqqt?usp=drive_link', description: 'Fotky a sdílené dokumenty' },
    { id: 'karta', emoji: '🚗', label: 'Karty vozidel', url: 'https://rescue.euroncap.com/', description: 'Euro NCAP Rescue – záchranné karty' },
    { id: 'spaci', emoji: '🛌', label: 'Spací pořádek', url: 'https://docs.google.com/spreadsheets/d/1fE4WmjSbXR9WRydpOva2nGuK2ksyLrbJQjtXb5zVBSU/edit?gid=0#gid=0', description: '' },
];

const EMPTY_FORM = { label: '', url: '', emoji: '', description: '' };

const EMOJI_OPTIONS = [
    '📖','🎓','🌐','🚒','📁','🚗','🛌','📋','🔗','📌','⭐','🔥',
    '🧯','🏋️','📞','🗂️','🔧','🏥','🗺️','📸','📊','🧰','💡','🌍',
];

function LinkFormFields({ value, onChange }) {
    return (
        <>
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: '0.4rem' }}>Vyberte ikonu</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <button
                        type="button"
                        onClick={() => onChange({ ...value, emoji: '' })}
                        style={{
                            fontSize: '0.72rem', padding: '0.3rem 0.5rem',
                            border: value.emoji === '' ? '2px solid #E53935' : '2px solid #eee',
                            borderRadius: '8px', background: value.emoji === '' ? '#ffebee' : 'white',
                            cursor: 'pointer', color: '#888', fontWeight: 600,
                        }}
                    >
                        Bez ikony
                    </button>
                    {EMOJI_OPTIONS.map(e => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => onChange({ ...value, emoji: e })}
                            style={{
                                fontSize: '1.35rem', padding: '0.3rem 0.4rem',
                                border: value.emoji === e ? '2px solid #E53935' : '2px solid #eee',
                                borderRadius: '8px', background: value.emoji === e ? '#ffebee' : 'white',
                                cursor: 'pointer', lineHeight: 1,
                            }}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <input
                    placeholder="Název *"
                    value={value.label}
                    onChange={e => onChange({ ...value, label: e.target.value })}
                    style={{ padding: '0.6rem', border: '1px solid #ddd', borderRadius: '8px' }}
                />
                <input
                    placeholder="URL *"
                    value={value.url}
                    onChange={e => onChange({ ...value, url: e.target.value })}
                    style={{ padding: '0.6rem', border: '1px solid #ddd', borderRadius: '8px' }}
                />
            </div>
            <input
                placeholder="Popis (volitelný)"
                value={value.description}
                onChange={e => onChange({ ...value, description: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }}
            />
        </>
    );
}

export default function LinksTab() {
    const { currentUser, userData } = useAuth();
    const [links, setLinks] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editLink, setEditLink] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'importantLinks'), (snap) => {
            if (snap.exists()) {
                const data = snap.data().links;
                setLinks(Array.isArray(data) ? data : DEFAULT_LINKS);
            } else {
                setLinks(DEFAULT_LINKS);
            }
        });
        return () => unsub();
    }, []);

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3000);
    };

    const userName = () => `${userData?.firstName} ${userData?.lastName}`.trim();

    const save = async (newLinks) => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'importantLinks'), { links: newLinks });
        } catch {
            showToast('error', 'Chyba při ukládání.');
        } finally {
            setSaving(false);
        }
    };

    const handleAdd = async () => {
        if (!form.label.trim() || !form.url.trim()) { showToast('error', 'Vyplňte název a URL.'); return; }
        const id = Date.now().toString();
        const newLinks = [...(links || []), { id, ...form, label: form.label.trim(), url: form.url.trim(), description: form.description.trim() }];
        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_ADDED_LINK', 'admin', `Přidán odkaz: ${form.label.trim()}`);
        setForm(EMPTY_FORM);
        showToast('success', 'Odkaz přidán.');
    };

    const handleEdit = async () => {
        if (!editLink.label.trim() || !editLink.url.trim()) { showToast('error', 'Vyplňte název a URL.'); return; }
        const newLinks = (links || []).map(l => l.id === editLink.id
            ? { ...editLink, label: editLink.label.trim(), url: editLink.url.trim(), description: editLink.description.trim() }
            : l
        );
        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_UPDATED_LINK', 'admin', `Upraven odkaz: ${editLink.label.trim()}`);
        setEditLink(null);
        showToast('success', 'Odkaz upraven.');
    };

    const handleRemove = async (id) => {
        const link = (links || []).find(l => l.id === id);
        const newLinks = (links || []).filter(l => l.id !== id);
        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_REMOVED_LINK', 'admin', `Odstraněn odkaz: ${link?.label || id}`);
        showToast('success', 'Odkaz odstraněn.');
        setConfirmRemove(null);
    };

    if (links === null) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Načítání...</div>;

    return (
        <div>
            {/* Edit modal */}
            {editLink && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setEditLink(null)}>
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', animation: 'fadeIn 0.2s' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.25rem' }}>Upravit odkaz</h3>
                        <LinkFormFields value={editLink} onChange={setEditLink} />
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditLink(null)}>Zrušit</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleEdit}>Uložit</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm remove modal */}
            {confirmRemove && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => setConfirmRemove(null)}>
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%', animation: 'fadeIn 0.2s' }}>
                        <h3 style={{ marginTop: 0 }}>Odebrat odkaz?</h3>
                        <p style={{ color: '#555', marginBottom: '1.25rem' }}>
                            Odkaz <strong>„{confirmRemove.label}"</strong> bude trvale odstraněn.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmRemove(null)}>Zrušit</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#d32f2f', borderColor: '#d32f2f' }} onClick={() => handleRemove(confirmRemove.id)}>Odebrat</button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px', zIndex: 2000,
                    padding: '0.75rem 1.5rem', borderRadius: '8px',
                    background: toast.type === 'success' ? '#E8F5E9' : '#FFEBEE',
                    color: toast.type === 'success' ? '#2E7D32' : '#C62828',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}>
                    {toast.type === 'success' ? '✓' : '⚠'} {toast.msg}
                </div>
            )}

            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem' }}>Správa důležitých odkazů</h2>

            {/* Add form */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 700 }}>Přidat odkaz</h3>
                <LinkFormFields value={form} onChange={setForm} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button onClick={handleAdd} disabled={saving} className="btn btn-primary">+ Přidat</button>
                </div>
            </div>

            {/* Links list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {links.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Žádné odkazy</div>
                )}
                {links.map((link) => (
                    <div key={link.id} style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '0.875rem 1rem', background: '#f8f9fa',
                        borderRadius: '12px', border: '1px solid #eee'
                    }}>
                        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{link.emoji || '🔗'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{link.label}</div>
                            {link.description && (
                                <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.1rem' }}>{link.description}</div>
                            )}
                            <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {link.url}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                                onClick={() => setEditLink({ ...link })}
                                disabled={saving}
                                style={{
                                    background: 'none', border: '1px solid #ddd', color: '#555',
                                    borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600,
                                }}
                            >
                                Upravit
                            </button>
                            <button
                                onClick={() => setConfirmRemove(link)}
                                disabled={saving}
                                style={{
                                    background: 'none', border: '1px solid #ffcdd2', color: '#c62828',
                                    borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600,
                                }}
                            >
                                Odebrat
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
