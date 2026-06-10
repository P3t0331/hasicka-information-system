import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logAction } from '../../utils/logger';
import ReorderLinksModal from './modals/ReorderLinksModal';

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
const EMPTY_GROUP = { emoji: '', label: '', description: '' };

const EMOJI_OPTIONS = [
    '📖','🎓','🌐','🚒','📁','🚗','🛌','📋','🔗','📌','⭐','🔥',
    '🧯','🏋️','📞','🗂️','🔧','🏥','🗺️','📸','📊','🧰','💡','🌍','✂️',
];

function EmojiPicker({ value, onChange }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ marginBottom: '0.75rem' }}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.75rem', border: '1px solid #ddd',
                    borderRadius: '8px', background: 'white', cursor: 'pointer',
                    fontSize: '0.82rem', color: '#555', fontWeight: 600,
                }}
            >
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{value || '—'}</span>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>Ikona</span>
                <span style={{ fontSize: '0.65rem', color: '#aaa', marginLeft: '0.1rem' }}>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                    <button
                        type="button"
                        onClick={() => { onChange(''); setOpen(false); }}
                        style={{
                            fontSize: '0.72rem', padding: '0.3rem 0.5rem',
                            border: value === '' ? '2px solid #E53935' : '2px solid #eee',
                            borderRadius: '8px', background: value === '' ? '#ffebee' : 'white',
                            cursor: 'pointer', color: '#888', fontWeight: 600,
                        }}
                    >
                        Bez ikony
                    </button>
                    {EMOJI_OPTIONS.map(e => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => { onChange(e); setOpen(false); }}
                            style={{
                                fontSize: '1.35rem', padding: '0.3rem 0.4rem',
                                border: value === e ? '2px solid #E53935' : '2px solid #eee',
                                borderRadius: '8px', background: value === e ? '#ffebee' : 'white',
                                cursor: 'pointer', lineHeight: 1,
                            }}
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function LinkFormFields({ value, onChange }) {
    return (
        <>
            <EmojiPicker value={value.emoji} onChange={emoji => onChange({ ...value, emoji })} />
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

function GroupFormFields({ value, onChange }) {
    return (
        <>
            <EmojiPicker value={value.emoji} onChange={emoji => onChange({ ...value, emoji })} />
            <input
                placeholder="Název skupiny *"
                value={value.label}
                onChange={e => onChange({ ...value, label: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />
            <input
                placeholder="Popis skupiny (volitelný)"
                value={value.description}
                onChange={e => onChange({ ...value, description: e.target.value })}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #ddd', borderRadius: '8px', boxSizing: 'border-box' }}
            />
        </>
    );
}

export default function LinksTab() {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [links, setLinks] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
    const [editLink, setEditLink] = useState(null);
    const [saving, setSaving] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [reordering, setReordering] = useState(false);
    const [addingSubTo, setAddingSubTo] = useState(null);
    const [subForm, setSubForm] = useState(EMPTY_FORM);
    const [movingLink, setMovingLink] = useState(null);

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

    const showToast = (type, msg) => addToast(type, msg);
    const userName = () => `${userData?.firstName} ${userData?.lastName}`.trim();

    const save = async (newLinks) => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'importantLinks'), { links: newLinks });
            setLinks(newLinks);
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

    const handleAddGroup = async () => {
        if (!groupForm.label.trim()) { showToast('error', 'Vyplňte název skupiny.'); return; }
        const id = Date.now().toString();
        const newLinks = [...(links || []), { id, type: 'group', emoji: groupForm.emoji, label: groupForm.label.trim(), description: groupForm.description.trim(), links: [] }];
        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_ADDED_LINK_GROUP', 'admin', `Přidána skupina odkazů: ${groupForm.label.trim()}`);
        setGroupForm(EMPTY_GROUP);
        showToast('success', 'Skupina přidána.');
    };

    const handleAddSubLink = async (groupId) => {
        if (!subForm.label.trim() || !subForm.url.trim()) { showToast('error', 'Vyplňte název a URL.'); return; }
        const id = Date.now().toString();
        const newLinks = (links || []).map(l =>
            l.id === groupId
                ? { ...l, links: [...(l.links || []), { id, ...subForm, label: subForm.label.trim(), url: subForm.url.trim(), description: subForm.description.trim() }] }
                : l
        );
        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_ADDED_LINK', 'admin', `Přidán odkaz do skupiny: ${subForm.label.trim()}`);
        setSubForm(EMPTY_FORM);
        setAddingSubTo(null);
        showToast('success', 'Odkaz přidán do skupiny.');
    };

    const handleEdit = async () => {
        if (editLink.type === 'group') {
            if (!editLink.label.trim()) { showToast('error', 'Vyplňte název skupiny.'); return; }
            const newLinks = (links || []).map(l => l.id === editLink.id
                ? { ...l, emoji: editLink.emoji, label: editLink.label.trim(), description: editLink.description.trim() }
                : l
            );
            await save(newLinks);
            logAction(db, currentUser.uid, userName(), 'ADMIN_UPDATED_LINK_GROUP', 'admin', `Upravena skupina odkazů: ${editLink.label.trim()}`);
            showToast('success', 'Skupina upravena.');
        } else if (editLink._groupId) {
            if (!editLink.label.trim() || !editLink.url.trim()) { showToast('error', 'Vyplňte název a URL.'); return; }
            const { _groupId, ...subData } = editLink;
            const newLinks = (links || []).map(l =>
                l.id === _groupId
                    ? { ...l, links: (l.links || []).map(sl => sl.id === subData.id ? { ...subData, label: subData.label.trim(), url: subData.url.trim(), description: subData.description.trim() } : sl) }
                    : l
            );
            await save(newLinks);
            logAction(db, currentUser.uid, userName(), 'ADMIN_UPDATED_LINK', 'admin', `Upraven odkaz ve skupině: ${subData.label.trim()}`);
            showToast('success', 'Odkaz upraven.');
        } else {
            if (!editLink.label.trim() || !editLink.url.trim()) { showToast('error', 'Vyplňte název a URL.'); return; }
            const newLinks = (links || []).map(l => l.id === editLink.id
                ? { ...editLink, label: editLink.label.trim(), url: editLink.url.trim(), description: editLink.description.trim() }
                : l
            );
            await save(newLinks);
            logAction(db, currentUser.uid, userName(), 'ADMIN_UPDATED_LINK', 'admin', `Upraven odkaz: ${editLink.label.trim()}`);
            showToast('success', 'Odkaz upraven.');
        }
        setEditLink(null);
    };

    const handleRemove = async (id) => {
        if (confirmRemove._groupId) {
            const { _groupId, label } = confirmRemove;
            const newLinks = (links || []).map(l =>
                l.id === _groupId ? { ...l, links: (l.links || []).filter(sl => sl.id !== id) } : l
            );
            await save(newLinks);
            logAction(db, currentUser.uid, userName(), 'ADMIN_REMOVED_LINK', 'admin', `Odstraněn odkaz ze skupiny: ${label || id}`);
            showToast('success', 'Odkaz odstraněn.');
        } else {
            const item = (links || []).find(l => l.id === id);
            const newLinks = (links || []).filter(l => l.id !== id);
            await save(newLinks);
            if (item?.type === 'group') {
                logAction(db, currentUser.uid, userName(), 'ADMIN_REMOVED_LINK_GROUP', 'admin', `Odstraněna skupina odkazů: ${item?.label || id}`);
            } else {
                logAction(db, currentUser.uid, userName(), 'ADMIN_REMOVED_LINK', 'admin', `Odstraněn odkaz: ${item?.label || id}`);
            }
            showToast('success', item?.type === 'group' ? 'Skupina odstraněna.' : 'Odkaz odstraněn.');
        }
        setConfirmRemove(null);
    };

    const handleMoveToGroup = async (groupId) => {
        const link = movingLink;
        const newLinks = (links || [])
            .filter(l => l.id !== link.id)
            .map(l => l.id === groupId ? { ...l, links: [...(l.links || []), link] } : l);
        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_UPDATED_LINK', 'admin', `Odkaz „${link.label}" přesunut do skupiny`);
        setMovingLink(null);
        showToast('success', 'Odkaz přesunut do skupiny.');
    };

    const handleReorderSave = async (newLinks) => {        await save(newLinks);
        logAction(db, currentUser.uid, userName(), 'ADMIN_REORDERED_LINKS', 'admin', `Změněno pořadí odkazů: ${newLinks.map(l => l.label).join(', ')}`);
        setReordering(false);
        showToast('success', 'Pořadí odkazů bylo uloženo.');
    };

    if (links === null) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Načítání...</div>;

    const btnEdit = { background: 'none', border: '1px solid #ddd', color: '#555', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };
    const btnRemove = { background: 'none', border: '1px solid #ffcdd2', color: '#c62828', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 };
    const groups = (links || []).filter(l => l.type === 'group');

    return (
        <div>
            {reordering && (
                <ReorderLinksModal links={links} onClose={() => setReordering(false)} onSave={handleReorderSave} />
            )}

            {/* Edit modal */}
            {editLink && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem'
                }} onClick={() => setEditLink(null)}>
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', animation: 'fadeIn 0.2s' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.25rem' }}>
                            {editLink.type === 'group' ? 'Upravit skupinu' : editLink._groupId ? 'Upravit odkaz ve skupině' : 'Upravit odkaz'}
                        </h3>
                        {editLink.type === 'group'
                            ? <GroupFormFields value={editLink} onChange={setEditLink} />
                            : <LinkFormFields value={editLink} onChange={setEditLink} />
                        }
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
                        <h3 style={{ marginTop: 0 }}>{confirmRemove.type === 'group' ? 'Odebrat skupinu?' : 'Odebrat odkaz?'}</h3>
                        <p style={{ color: '#555', marginBottom: '1.25rem' }}>
                            {confirmRemove.type === 'group'
                                ? <>Skupina <strong>„{confirmRemove.label}"</strong> a všechny její odkazy budou trvale odstraněny.</>
                                : <>Odkaz <strong>„{confirmRemove.label}"</strong> bude trvale odstraněn.</>
                            }
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmRemove(null)}>Zrušit</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#d32f2f', borderColor: '#d32f2f' }} onClick={() => handleRemove(confirmRemove.id)}>Odebrat</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move to group modal */}
            {movingLink && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                }} onClick={() => setMovingLink(null)}>
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%', animation: 'fadeIn 0.2s' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>Přesunout do skupiny</h3>
                        <p style={{ color: '#555', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Vyberte skupinu pro odkaz <strong>„{movingLink.label}"</strong>:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                            {groups.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => handleMoveToGroup(g.id)}
                                    disabled={saving}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#f0f7ff', border: '1px solid #bbdefb', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                                >
                                    <span style={{ fontSize: '1.25rem' }}>{g.emoji || '📁'}</span>
                                    <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1565c0' }}>{g.label}</span>
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setMovingLink(null)}>Zrušit</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Správa důležitých odkazů</h2>
                {links.length > 1 && (
                    <button className="btn btn-secondary" onClick={() => setReordering(true)} disabled={saving} style={{ fontSize: '0.85rem' }}>
                        Změnit pořadí
                    </button>
                )}
            </div>

            {/* Add link form */}
            <div className="card" style={{ marginBottom: '1rem', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 700 }}>Přidat odkaz</h3>
                <LinkFormFields value={form} onChange={setForm} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button onClick={handleAdd} disabled={saving} className="btn btn-primary">+ Přidat</button>
                </div>
            </div>

            {/* Add group form */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 700 }}>Přidat skupinu odkazů</h3>
                <GroupFormFields value={groupForm} onChange={setGroupForm} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                    <button onClick={handleAddGroup} disabled={saving} className="btn btn-primary">+ Přidat skupinu</button>
                </div>
            </div>

            {/* Links list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {links.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Žádné odkazy</div>
                )}
                {links.map((item) => item.type === 'group' ? (
                    /* Group */
                    <div key={item.id} style={{ borderRadius: '12px', border: '2px solid #e3f2fd', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', background: '#e3f2fd' }}>
                            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{item.emoji || '📁'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.label}</div>
                                {item.description && (
                                    <div style={{ fontSize: '0.78rem', color: '#555', marginTop: '0.1rem' }}>{item.description}</div>
                                )}
                                <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>{(item.links || []).length} odkazů</div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                <button onClick={() => setEditLink({ ...item })} disabled={saving} style={btnEdit}>Upravit</button>
                                <button onClick={() => setConfirmRemove(item)} disabled={saving} style={btnRemove}>Odebrat</button>
                            </div>
                        </div>

                        <div style={{ padding: '0.5rem', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {(item.links || []).map(sl => (
                                <div key={sl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #eee' }}>
                                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{sl.emoji || '🔗'}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sl.label}</div>
                                        {sl.description && <div style={{ fontSize: '0.75rem', color: '#666' }}>{sl.description}</div>}
                                        <div style={{ fontSize: '0.7rem', color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sl.url}</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                        <button onClick={() => setEditLink({ ...sl, _groupId: item.id })} disabled={saving} style={btnEdit}>Upravit</button>
                                        <button onClick={() => setConfirmRemove({ ...sl, _groupId: item.id })} disabled={saving} style={btnRemove}>✕</button>
                                    </div>
                                </div>
                            ))}

                            {addingSubTo === item.id ? (
                                <div style={{ padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #bbdefb' }}>
                                    <LinkFormFields value={subForm} onChange={setSubForm} />
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => { setAddingSubTo(null); setSubForm(EMPTY_FORM); }}>Zrušit</button>
                                        <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} disabled={saving} onClick={() => handleAddSubLink(item.id)}>Přidat</button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => { setAddingSubTo(item.id); setSubForm(EMPTY_FORM); }}
                                    style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed #90caf9', color: '#1565c0', borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                >
                                    + Přidat odkaz do skupiny
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Regular link */
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1rem', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}>
                        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{item.emoji || '🔗'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.label}</div>
                            {item.description && (
                                <div style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.1rem' }}>{item.description}</div>
                            )}
                            <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.url}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            {groups.length > 0 && (
                                <button onClick={() => setMovingLink(item)} disabled={saving} style={{ ...btnEdit, color: '#1565c0', borderColor: '#bbdefb' }}>Přesunout</button>
                            )}
                            <button onClick={() => setEditLink({ ...item })} disabled={saving} style={btnEdit}>Upravit</button>
                            <button onClick={() => setConfirmRemove(item)} disabled={saving} style={btnRemove}>Odebrat</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
