import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function MembersPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const [equipmentTypes, setEquipmentTypes] = useState([]);

    useEffect(() => {
        fetchMembers();
        fetchEquipmentTypes();
    }, []);

    const fetchEquipmentTypes = async () => {
        try {
            const docRef = doc(db, 'settings', 'equipmentTypes');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setEquipmentTypes(docSnap.data().types || []);
            }
        } catch (error) {
            console.error('Error fetching equipment types:', error);
        }
    };

    const fetchMembers = async () => {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('approved', '==', true));
            const snapshot = await getDocs(q);

            const membersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by last name
            membersData.sort((a, b) =>
                (a.lastName || '').localeCompare(b.lastName || '')
            );

            setMembers(membersData);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter members based on search and role
    const filteredMembers = members.filter(member => {
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase());

        if (roleFilter === 'all') return matchesSearch;

        const roles = member.roles || [member.role || 'Hasič'];
        const normalizedRoles = Array.isArray(roles)
            ? roles.map(r => r.toString().toLowerCase())
            : Object.keys(roles).filter(k => roles[k]).map(r => r.toLowerCase());

        return matchesSearch && normalizedRoles.includes(roleFilter.toLowerCase());
    });

    // Get unique roles for filter
    const allRoles = ['VJ', 'Zástupce VJ', 'VD', 'Strojník', 'Hasič'];
    const roleLabels = {
        'VJ': 'Velitel jednotky',
        'Zástupce VJ': 'Zástupce VJ',
        'VD': 'Velitel družstva',
        'Strojník': 'Strojník',
        'Hasič': 'Hasič',
        'Admin': 'Administrátor'
    };

    if (loading) {
        return (
            <div className="page-layout flex-center">
                <div className="card">
                    <p>Načítání členů...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem 1rem' }}>
            {/* Header */}
            <div style={{
                marginBottom: '2rem',
                textAlign: 'center'
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    background: 'linear-gradient(135deg, var(--primary-red), var(--primary-red-dark))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '0.5rem'
                }}>
                    👥 Členové jednotky
                </h1>
                <p style={{ color: '#666', fontSize: '1.1rem' }}>
                    Celkem {filteredMembers.length} {filteredMembers.length === 1 ? 'člen' : filteredMembers.length < 5 ? 'členové' : 'členů'}
                </p>
            </div>

            {/* Search and Filter Bar */}
            <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginBottom: '2rem',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                {/* Search Input */}
                <div style={{ flex: '1 1 300px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Hledat podle jména..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field"
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            fontSize: '1rem'
                        }}
                    />
                </div>

                {/* Role Filter */}
                <div style={{ flex: '0 0 200px' }}>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="input-field"
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            fontSize: '1rem'
                        }}
                    >
                        <option value="all">Všechny role</option>
                        {allRoles.map(role => (
                            <option key={role} value={role}>{roleLabels[role] || role}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Members Grid */}
            {filteredMembers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
                    <h3 style={{ color: '#666' }}>Žádní členové nenalezeni</h3>
                    <p style={{ color: '#999' }}>Zkuste změnit vyhledávací kritéria</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {filteredMembers.map(member => (
                        <MemberCard key={member.id} member={member} roleLabels={roleLabels} equipmentTypes={equipmentTypes} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MemberCard({ member, roleLabels, equipmentTypes }) {
    // Normalize roles to array of strings
    const rawRoles = member.roles || [member.role || 'Hasič'];
    const userRoles = Array.isArray(rawRoles)
        ? rawRoles
        : Object.keys(rawRoles).filter(r => rawRoles[r]);

    const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();

    return (
        <div
            className="card"
            style={{
                padding: '0',
                overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
            }}
            onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
            }}
            onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
        >
            {/* Header with Avatar */}
            <div style={{
                background: 'linear-gradient(135deg, #263238 0%, #37474F 100%)',
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                color: 'white'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, var(--primary-red), var(--primary-red-dark))',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                    {initials}
                </div>

                <div style={{ flex: 1 }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '1.3rem',
                        fontWeight: 700,
                        marginBottom: '0.25rem'
                    }}>
                        {member.firstName} {member.lastName}
                    </h3>
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                    }}>
                        {member.registrationNumber && (
                            <span style={{
                                background: 'rgba(255, 193, 7, 0.15)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#FFD54F',
                                border: '1px solid rgba(255, 193, 7, 0.3)'
                            }}>
                                Ev. č. {member.registrationNumber}
                            </span>
                        )}
                        {userRoles.map(role => (
                            <span key={role} style={{
                                background: 'rgba(255,255,255,0.15)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                border: '1px solid rgba(255,255,255,0.2)'
                            }}>
                                {roleLabels[role] || role}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contact Information */}
            <div style={{ padding: '1.5rem' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    {/* Email */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            background: '#E3F2FD',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0
                        }}>
                            ✉️
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
                                Email
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: '#333',
                                wordBreak: 'break-word'
                            }}>
                                {member.email || 'Neuvedeno'}
                            </div>
                        </div>
                    </div>

                    {/* Phone */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            background: '#E8F5E9',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0
                        }}>
                            📱
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
                                Telefon
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#333' }}>
                                {member.phone || 'Neuvedeno'}
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            background: '#FFF3E0',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0
                        }}>
                            🏠
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>
                                Adresa
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#333' }}>
                                {member.address || 'Neuvedeno'}
                            </div>
                        </div>
                    </div>

                    {/* Certifications */}
                    {member.certifications && member.certifications.length > 0 && (
                        <div style={{
                            marginTop: '0.5rem',
                            paddingTop: '1rem',
                            borderTop: '1px solid #eee'
                        }}>
                            <div style={{
                                fontSize: '0.75rem',
                                color: '#888',
                                marginBottom: '0.5rem',
                                fontWeight: 600
                            }}>
                                🎓 Kvalifikace
                            </div>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                {member.certifications.map(cert => (
                                    <span key={cert} style={{
                                        background: '#FFF3E0',
                                        color: '#E65100',
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        border: '1px solid #FFE0B2'
                                    }}>
                                        {cert}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}


                </div>
            </div>
        </div>
    );
}
