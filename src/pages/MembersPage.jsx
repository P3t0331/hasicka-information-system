import React from 'react';
import useMembers from '../hooks/useMembers';
import MemberCard from '../components/members/MemberCard';

export default function MembersPage() {
    const {
        loading,
        searchTerm,
        setSearchTerm,
        roleFilter,
        setRoleFilter,
        filteredMembers,
        allRoles,
        roleLabels
    } = useMembers();

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
                        <MemberCard key={member.id} member={member} roleLabels={roleLabels} />
                    ))}
                </div>
            )}
        </div>
    );
}
