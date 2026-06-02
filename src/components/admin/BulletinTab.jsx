import React, { useState } from 'react';
import useBulletin from '../../hooks/useBulletin';
import CreateBulletinModal from './modals/CreateBulletinModal';

const PRIORITY_CONFIG = {
    normal:    { label: 'Normální', color: '#546E7A', bg: '#ECEFF1', border: '#B0BEC5' },
    important: { label: 'Důležité', color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' },
    urgent:    { label: 'Urgentní', color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A' },
};

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function BulletinTab({ allUsers = [] }) {
    const uidToName = (uid) => {
        const u = allUsers.find(u => u.uid === uid);
        return u ? `${u.firstName} ${u.lastName}` : uid;
    };

    const {
        loading,
        posts,
        canCreate,
        canModifyPost,
        showEditor,
        editingPost,
        openCreateEditor,
        openEditEditor,
        closeEditor,
        savePost,
        markAsSeen,
        deleteModal,
        setDeleteModal,
        requestDelete,
        confirmDelete,
        togglePin,
        currentUser,
    } = useBulletin();

    const [expandedPost, setExpandedPost] = useState(null);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Načítání nástěnky...</div>;

    return (
        <div>
            {showEditor && (
                <CreateBulletinModal
                    initialPost={editingPost}
                    onClose={closeEditor}
                    onSave={savePost}
                />
            )}

            {deleteModal && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}
                    onClick={() => setDeleteModal(null)}
                >
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%', animation: 'fadeIn 0.2s' }}>
                        <h3 style={{ marginTop: 0 }}>Smazat příspěvek?</h3>
                        <p style={{ color: '#555', marginBottom: '1.25rem' }}>
                            Příspěvek <strong>„{deleteModal.title}"</strong> bude trvale odstraněn.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteModal(null)}>Zrušit</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#d32f2f', borderColor: '#d32f2f' }} onClick={confirmDelete}>Smazat</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.15rem' }}>📌 Nástěnka</h2>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#888' }}>
                        {posts.length} {posts.length === 1 ? 'příspěvek' : (posts.length >= 2 && posts.length <= 4 ? 'příspěvky' : 'příspěvků')}
                    </p>
                </div>
                {canCreate && (
                    <button className="btn btn-primary" onClick={openCreateEditor} style={{ fontSize: '0.9rem' }}>
                        + Nový příspěvek
                    </button>
                )}
            </div>

            {posts.length === 0 ? (
                <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#888', background: '#fafafa', border: '1px dashed #ddd' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.4 }}>📭</div>
                    <p style={{ margin: 0 }}>Žádné příspěvky na nástěnce.</p>
                    {canCreate && (
                        <button className="btn btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem' }} onClick={openCreateEditor}>
                            + Přidat první příspěvek
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {posts.map(post => {
                        const pc = PRIORITY_CONFIG[post.priority] || PRIORITY_CONFIG.normal;
                        const seenCount = (post.seenBy || []).length;
                        const isExpanded = expandedPost === post.id;

                        return (
                            <div
                                key={post.id}
                                className="card"
                                style={{
                                    padding: 0, overflow: 'hidden',
                                    borderLeft: `4px solid ${pc.border}`,
                                    background: pc.bg,
                                }}
                            >
                                <div style={{ padding: '1rem 1rem 0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                                {post.isPinned && (
                                                    <span style={{ fontSize: '0.7rem', background: '#F57C00', color: 'white', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 700 }}>
                                                        📌 Připnuto
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.7rem', background: pc.color, color: 'white', padding: '0.1rem 0.45rem', borderRadius: '999px', fontWeight: 700 }}>
                                                    {pc.label}
                                                </span>
                                            </div>
                                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#222' }}>{post.title}</h4>
                                            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.2rem' }}>
                                                {post.createdBy?.name} · {formatDate(post.createdAt)}
                                                {post.updatedAt && <span> · upraven {formatDate(post.updatedAt)}</span>}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                            <button
                                                title={post.isPinned ? 'Odepnout' : 'Připnout'}
                                                onClick={() => togglePin(post)}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    fontSize: '1rem', opacity: post.isPinned ? 1 : 0.4,
                                                    padding: '0.3rem', borderRadius: '6px'
                                                }}
                                            >📌</button>
                                            {canModifyPost(post) && (
                                                <>
                                                    <button
                                                        onClick={() => openEditEditor(post)}
                                                        title="Upravit"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#1976D2', padding: '0.3rem', borderRadius: '6px' }}
                                                    >✏️</button>
                                                    <button
                                                        onClick={() => requestDelete(post)}
                                                        title="Smazat"
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#d32f2f', lineHeight: 1, padding: '0.2rem 0.45rem', borderRadius: '6px' }}
                                                    >×</button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <p style={{ margin: '0.6rem 0 0', fontSize: '0.9rem', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {post.content}
                                    </p>
                                </div>

                                <div style={{
                                    padding: '0.5rem 1rem',
                                    borderTop: '1px solid rgba(0,0,0,0.06)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255,255,255,0.5)', flexWrap: 'wrap', gap: '0.5rem'
                                }}>
                                    <button
                                        onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            fontSize: '0.78rem', color: '#666', padding: 0
                                        }}
                                    >
                                        👁️ {seenCount} {seenCount === 1 ? 'člen viděl' : 'členů vidělo'}
                                        {isExpanded ? ' ▲' : ' ▼'}
                                    </button>

                                    {currentUser && !(post.seenBy || []).includes(currentUser.uid) && (
                                        <button
                                            onClick={() => markAsSeen(post.id)}
                                            style={{
                                                background: '#E8F5E9', border: '1px solid #A5D6A7',
                                                color: '#2E7D32', borderRadius: '6px', cursor: 'pointer',
                                                fontSize: '0.78rem', fontWeight: 600, padding: '0.25rem 0.7rem'
                                            }}
                                        >
                                            ✓ Označit jako viděno
                                        </button>
                                    )}
                                    {currentUser && (post.seenBy || []).includes(currentUser.uid) && (
                                        <span style={{ fontSize: '0.78rem', color: '#888' }}>✓ Viděno tebou</span>
                                    )}
                                </div>

                                {isExpanded && (post.seenBy || []).length > 0 && (
                                    <div style={{ padding: '0.5rem 1rem 0.75rem', background: 'rgba(255,255,255,0.7)', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.35rem', fontWeight: 600 }}>Kdo viděl:</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                            {(post.seenBy || []).map(uid => (
                                                <span key={uid} style={{
                                                    fontSize: '0.72rem', background: '#E3F2FD', color: '#1565C0',
                                                    padding: '0.1rem 0.5rem', borderRadius: '999px', border: '1px solid #BBDEFB'
                                                }}>
                                                    {uidToName(uid)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {isExpanded && (post.seenBy || []).length === 0 && (
                                    <div style={{ padding: '0.5rem 1rem 0.75rem', background: 'rgba(255,255,255,0.7)', borderTop: '1px solid rgba(0,0,0,0.06)', fontSize: '0.78rem', color: '#aaa' }}>
                                        Nikdo zatím neviděl.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
