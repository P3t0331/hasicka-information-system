import React, { useState } from 'react';

export default function ImportantLinks() {
    const [isLinksOpen, setIsLinksOpen] = useState(false);

    return (
        <section style={{ marginBottom: '2rem' }}>
            <div 
                className="dashboard-card"
                style={{ 
                    overflow: 'hidden',
                    padding: 0,
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                    background: 'white'
                }}
            >
                <div 
                    onClick={() => setIsLinksOpen(!isLinksOpen)}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem', 
                        padding: '1.25rem', 
                        background: 'linear-gradient(135deg, #FFB74D, #FFA726)',
                        color: 'white',
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
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#fdfdfd' }}>
                        <a 
                            href="https://docs.google.com/spreadsheets/d/1qWtU8OSbAX1PB9biEztcqjwtLVIx3KBegE1L52FOWhM/edit?gid=0#gid=0" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                        >
                            <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>📖</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Návody k obsluze</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Kompletní dokumentace k technice</div>
                            </div>
                        </a>

                        <a 
                            href="https://www.hasici-vzdelavani.cz/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                        >
                            <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🎓</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Učební materiály</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Portál hasičského vzdělávání</div>
                            </div>
                        </a>

                        <a 
                            href="https://jsdh.izscr.cz/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                        >
                            <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🌐</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Portál JSDH</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Informační systém pro hasiče</div>
                            </div>
                        </a>

                        <a 
                            href="https://udalosti.firebrno.cz/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                        >
                            <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🚒</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Fire Brno</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Přehled událostí HZS JMK</div>
                            </div>
                        </a>

                        <a
                            href="https://drive.google.com/drive/folders/1CCvV1OuTlbsjLtfQSzU6WpZynDLRTqqt?usp=drive_link"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                        >
                            <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>📁</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Google Disk</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Fotky a sdílené dokumenty</div>
                            </div>
                        </a>

                        <a
                            href="https://rescue.euroncap.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', padding: '1rem', textDecoration: 'none', color: '#333', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #eee' }}
                        >
                            <span style={{ fontSize: '1.75rem', marginRight: '1rem' }}>🚗</span>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Karty vozidel</div>
                                <div style={{ fontSize: '0.8rem', color: '#666' }}>Euro NCAP Rescue – záchranné karty</div>
                            </div>
                        </a>
                    </div>
                )}
            </div>
        </section>
    );
}
