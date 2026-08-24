import React from 'react';

function MemberCard({ member, roleLabels }) {
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
                background: 'linear-gradient(135deg, var(--shift-night) 0%, var(--table-header-dark) 100%)',
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
                                color: 'var(--gold-text-on-dark)',
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
                            background: 'var(--info-bg)',
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Email
                            </div>
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-charcoal)',
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
                            background: 'var(--success-bg)',
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Telefon
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-charcoal)' }}>
                                {member.phone || 'Neuvedeno'}
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            background: 'var(--warning-bg)',
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                Adresa
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-charcoal)' }}>
                                {member.address || 'Neuvedeno'}
                            </div>
                        </div>
                    </div>

                    {/* Certifications */}
                    <div style={{
                        marginTop: '0.5rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid var(--border)'
                    }}>
                        <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginBottom: '0.5rem',
                            fontWeight: 600
                        }}>
                            🎓 Kvalifikace
                        </div>
                        {member.certifications && member.certifications.length > 0 ? (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                {member.certifications.map(cert => (
                                    <span key={cert} style={{
                                        background: 'var(--warning-bg)',
                                        color: 'var(--warning-dark)',
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        border: '1px solid var(--warning-border-warm)'
                                    }}>
                                        {cert}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                fontSize: '0.85rem',
                                color: 'var(--text-gray)',
                                fontStyle: 'italic'
                            }}>
                                Bez kvalifikace
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default React.memo(MemberCard);
