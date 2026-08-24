import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

const DEFAULT_LINKS = [
    { id: 'navody', emoji: '📖', label: 'Návody k obsluze', url: 'https://docs.google.com/spreadsheets/d/1qWtU8OSbAX1PB9biEztcqjwtLVIx3KBegE1L52FOWhM/edit?gid=0#gid=0', description: 'Kompletní dokumentace k technice' },
    { id: 'vzdelavani', emoji: '🎓', label: 'Učební materiály', url: 'https://www.hasici-vzdelavani.cz/', description: 'Portál hasičského vzdělávání' },
    { id: 'jsdh', emoji: '🌐', label: 'Portál JSDH', url: 'https://jsdh.izscr.cz/', description: 'Informační systém pro hasiče' },
    { id: 'firebrno', emoji: '🚒', label: 'Fire Brno', url: 'https://udalosti.firebrno.cz/', description: 'Přehled událostí HZS JMK' },
    { id: 'disk', emoji: '📁', label: 'Google Disk', url: 'https://drive.google.com/drive/folders/1CCvV1OuTlbsjLtfQSzU6WpZynDLRTqqt?usp=drive_link', description: 'Fotky a sdílené dokumenty' },
    { id: 'karta', emoji: '🚗', label: 'Karty vozidel', url: 'https://rescue.euroncap.com/', description: 'Euro NCAP Rescue – záchranné karty' },
    { id: 'spaci', emoji: '🛌', label: 'Spací pořádek', url: 'https://docs.google.com/spreadsheets/d/1fE4WmjSbXR9WRydpOva2nGuK2ksyLrbJQjtXb5zVBSU/edit?gid=0#gid=0', description: '' },
];

function GroupLinkItem({ group }) {
    const [expanded, setExpanded] = useState(false);
    const count = (group.links || []).length;

    return (
        <div style={{ borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div
                onClick={() => setExpanded(!expanded)}
                style={{ display: 'flex', alignItems: 'center', padding: '1rem', background: 'var(--info-bg)', cursor: 'pointer', userSelect: 'none' }}
            >
                <span style={{ fontSize: '1.75rem', marginRight: '1rem', flexShrink: 0 }}>{group.emoji || '📁'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{group.label}</div>
                    {group.description && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{group.description}</div>}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.5rem', flexShrink: 0 }}>{count} {count === 1 ? 'odkaz' : count < 5 ? 'odkazy' : 'odkazů'}</div>
                <div style={{
                    fontSize: '0.9rem', color: 'var(--text-muted)', flexShrink: 0,
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                }}>▼</div>
            </div>
            {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', background: 'var(--surface-alt)' }}>
                    {count === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '0.75rem', fontSize: '0.85rem' }}>Žádné odkazy ve skupině</div>
                    )}
                    {(group.links || []).map(link => (
                        <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '0.75rem 1rem', textDecoration: 'none', color: 'var(--text-primary)', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}
                        >
                            <span style={{ fontSize: '1.5rem', marginRight: '0.75rem', flexShrink: 0 }}>{link.emoji || '🔗'}</span>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{link.label}</div>
                                {link.description && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{link.description}</div>}
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ImportantLinks() {
    const [isLinksOpen, setIsLinksOpen] = useState(false);
    const [links, setLinks] = useState(DEFAULT_LINKS);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'importantLinks'), (snap) => {
            if (snap.exists()) {
                const data = snap.data().links;
                if (Array.isArray(data) && data.length > 0) {
                    setLinks(data);
                }
            }
        });
        return () => unsub();
    }, []);

    return (
        <section style={{ marginBottom: '2rem' }}>
            <div
                className="dashboard-card"
                style={{
                    overflow: 'hidden',
                    padding: 0,
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                    background: 'var(--surface)'
                }}
            >
                <div
                    onClick={() => setIsLinksOpen(!isLinksOpen)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1.25rem',
                        background: 'linear-gradient(135deg, var(--accent-amber-grad-1), var(--accent-amber-grad-2))',
                        color: 'var(--text-on-dark)',
                        cursor: 'pointer',
                        userSelect: 'none'
                    }}
                >
                    <div style={{ fontSize: '2rem' }}>🔗</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.1rem' }}>Důležité odkazy</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>Návody, portály, materiály a disk</div>
                    </div>
                    <div style={{
                        marginLeft: 'auto',
                        fontSize: '1.2rem',
                        opacity: 0.8,
                        transform: isLinksOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                    }}>
                        ▼
                    </div>
                </div>

                {isLinksOpen && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--surface)' }}>
                        {links.map((item) => item.type === 'group' ? (
                            <GroupLinkItem key={item.id} group={item} />
                        ) : (
                            <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: 'var(--text-primary)', background: 'var(--surface-alt)', borderRadius: '12px', border: '1px solid var(--border)' }}
                            >
                                <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>{item.emoji || '🔗'}</span>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{item.label}</div>
                                    {item.description && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.description}</div>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
