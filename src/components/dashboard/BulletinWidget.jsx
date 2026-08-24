import React, { useState } from 'react';
import useBulletin from '../../hooks/useBulletin';
import LinkifiedText from '../LinkifiedText';

const PRIORITY_CONFIG = {
    normal:    { label: 'Normální', color: 'var(--neutral)', bg: 'var(--surface)', border: 'var(--neutral-border)', accent: 'var(--neutral-bg)' },
    important: { label: 'Důležité', color: 'var(--warning-dark)', bg: 'var(--warning-bg-soft)', border: 'var(--warning-border)', accent: 'var(--warning-bg)' },
    urgent:    { label: 'Urgentní', color: 'var(--danger-text)', bg: 'var(--danger-bg-soft)', border: 'var(--danger-border-strong)', accent: 'var(--danger-bg)' },
};

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function BulletinWidget() {
    const { posts, unseenPosts, markAsSeen, loading, currentUser } = useBulletin();
    const [showArchive, setShowArchive] = useState(false);

    if (loading) return null;

    const displayPosts = showArchive ? posts : unseenPosts;
    const seenCount = posts.length - unseenPosts.length;

    if (posts.length === 0) return null;

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            {/* Widget header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.6rem', gap: '0.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>📌</span>
                    <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        Nástěnka
                    </h2>
                    {unseenPosts.length > 0 && (
                        <span style={{
                            background: 'var(--danger)', color: 'white',
                            fontSize: '0.65rem', fontWeight: 700,
                            padding: '0.1rem 0.45rem', borderRadius: '999px', lineHeight: 1.4
                        }}>
                            {unseenPosts.length}
                        </span>
                    )}
                </div>
                {seenCount > 0 && (
                    <button
                        onClick={() => setShowArchive(v => !v)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '0.78rem', color: 'var(--text-muted)', padding: 0
                        }}
                    >
                        {showArchive ? '▲ Skrýt archiv' : `▼ Archiv (${seenCount})`}
                    </button>
                )}
            </div>

            {/* Posts */}
            {displayPosts.length === 0 && !showArchive && (
                <div style={{
                    padding: '0.85rem 1rem', background: 'white', borderRadius: '10px',
                    border: '1px solid var(--border)', color: 'var(--text-faint)', fontSize: '0.85rem', textAlign: 'center'
                }}>
                    Žádné nové příspěvky.
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {displayPosts.map(post => {
                    const pc = PRIORITY_CONFIG[post.priority] || PRIORITY_CONFIG.normal;
                    const isSeen = currentUser && (post.seenBy || []).includes(currentUser.uid);

                    return (
                        <div
                            key={post.id}
                            style={{
                                background: pc.bg,
                                border: `1px solid ${pc.border}`,
                                borderLeft: `4px solid ${pc.border}`,
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                opacity: isSeen ? 0.7 : 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                        {post.isPinned && (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--warning)' }}>📌</span>
                                        )}
                                        {post.priority !== 'normal' && (
                                            <span style={{
                                                fontSize: '0.65rem', background: pc.color, color: 'white',
                                                padding: '0.05rem 0.4rem', borderRadius: '999px', fontWeight: 700
                                            }}>
                                                {pc.label}
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                                            {post.createdBy?.name} · {formatDate(post.createdAt)}
                                        </span>
                                    </div>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                                        {post.title}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                                        <LinkifiedText text={post.content} />
                                    </div>
                                </div>
                            </div>

                            {!isSeen && currentUser && (
                                <div style={{ marginTop: '0.65rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => markAsSeen(post.id)}
                                        style={{
                                            background: 'var(--success-bg)', border: '1px solid var(--success-border-strong)',
                                            color: 'var(--success-text)', borderRadius: '6px', cursor: 'pointer',
                                            fontSize: '0.78rem', fontWeight: 600,
                                            padding: '0.3rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem'
                                        }}
                                    >
                                        ✓ Rozumím / Viděno
                                    </button>
                                </div>
                            )}
                            {isSeen && (
                                <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-faint)', textAlign: 'right' }}>
                                    ✓ Viděno
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
