import React, { useState } from 'react';
import { ROLE_OPTIONS, CERTIFICATION_OPTIONS } from './constants';
import CreateUserModal from './modals/CreateUserModal';
import { getEffectiveRoles } from '../../utils/roles';

export default function UsersTab({
  allUsers,
  pendingUsers,
  stats,
  currentUser,
  userRoles,
  approveUser,
  deactivateUser,
  deleteUser,
  toggleUserRole,
  toggleUserCertification,
  updateRegistrationNumber,
  rejectPendingUser,
  createUserForOther,
  loading
}) {
  const currentUserIsAdmin = userRoles.includes('Admin');
  const currentUserIsAdminOrVJ = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState(new Set());

  const toggleReveal = (uid) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  return (
    <>
      {showCreateModal && (
        <CreateUserModal
          loading={loading}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            const ok = await createUserForOther(data);
            if (ok) setShowCreateModal(false);
          }}
        />
      )}

      {/* Stats Dashboard */}
      <div className="card mb-5" style={{ padding: '1.5rem' }}>
        <h3 className="mb-3" style={{ fontSize: '1.2rem' }}>Přehled stavu jednotky</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>

          {/* Roles Stats */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>FUNKCE (ROLE)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {ROLE_OPTIONS.filter(r => r !== 'Admin').map(role => (
                <div key={role} style={{
                  background: 'var(--info-bg)', color: 'var(--info-text)', padding: '0.4rem 0.8rem', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600
                }}>
                  <span>{role}</span>
                  <span style={{ background: 'white', padding: '0 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{stats.roles[role] || 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Certs Stats */}
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>KVALIFIKACE</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {CERTIFICATION_OPTIONS.map(cert => (
                <div key={cert} style={{
                  background: 'var(--warning-bg)', color: 'var(--warning-dark)', padding: '0.4rem 0.8rem', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600
                }}>
                  <span>{cert}</span>
                  <span style={{ background: 'white', padding: '0 6px', borderRadius: '4px', fontSize: '0.8rem' }}>{stats.certs[cert] || 0}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Create User Button (Admin only) */}
      {currentUserIsAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, var(--info-text), var(--info-dark))',
              color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(21, 101, 192, 0.3)'
            }}
          >
            ➕ Vytvořit účet pro člena
          </button>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingUsers.length > 0 && (
        <div className="mb-5 animation-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-gold)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
              boxShadow: '0 4px 10px rgba(255, 193, 7, 0.3)'
            }}>⚠️</div>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>Žádosti o registraci</h3>
          </div>
          <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {pendingUsers.map(user => (
              <div key={user.uid} className="card" style={{
                padding: '0',
                border: 'none',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                position: 'relative'
              }}>
                <div style={{
                  padding: '1.5rem',
                  borderLeft: '5px solid var(--accent-gold)',
                  background: 'linear-gradient(to right, var(--surface), var(--surface-sunken))'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <strong style={{ fontSize: '1.2rem', display: 'block', color: 'var(--text-primary)' }}>{user.firstName} {user.lastName}</strong>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{user.email}</span>
                    </div>
                    <div style={{
                      background: 'var(--warning-bg-soft)', color: 'var(--accent-gold-dark)', padding: '0.25rem 0.6rem',
                      borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase'
                    }}>
                      Nový
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>Požadované role</div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {(user.roles || [user.role]).map(r => (
                        <span key={r} style={{
                          fontSize: '0.8rem', background: 'var(--border)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-charcoal)'
                        }}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <button
                    style={{
                      flex: 1, padding: '1rem', border: 'none', background: 'white',
                      color: 'var(--danger)', fontWeight: 600, cursor: 'pointer',
                      transition: 'background 0.2s',
                      borderRight: '1px solid var(--border)'
                    }}
                    className="hover-bg-red-50"
                    onClick={() => rejectPendingUser(user)}
                  >
                    🚫 ZAMÍTNOUT
                  </button>
                  <button
                    style={{
                      flex: 1, padding: '1rem', border: 'none', background: 'white',
                      color: 'var(--success-text)', fontWeight: 600, cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    className="hover-bg-green-50"
                    onClick={() => approveUser(user.uid)}
                  >
                    ✅ SCHVÁLIT
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Users / Role Management */}
      <div className="card" style={{ overflow: 'hidden', padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <div style={{ padding: '1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Všichni uživatelé</h3>
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: '0 0 12px 12px', overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <table className="responsive-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Jméno & Email</th>
                <th style={{ width: '15%' }}>Evidenční číslo</th>
                <th style={{ width: '25%' }}>Funkce (Role)</th>
                <th style={{ width: '25%' }}>Kvalifikace (Školení)</th>
                <th style={{ textAlign: 'right' }}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(user => {
                const roles = user.roles || [user.role || 'Hasič'];
                const effectiveRoles = getEffectiveRoles(roles);
                const certs = user.certifications || [];
                const isDisabled = user.disabled;
                const isAdmin = roles.includes('Admin');
                const isSelf = user.uid === currentUser.uid;

                return (
                  <tr key={user.uid} className="hover-row" style={{
                    background: isDisabled ? 'var(--surface-sunken)' : 'white',
                    opacity: isDisabled ? 0.8 : 1
                  }}>
                    {/* COL 1: User Info */}
                    <td data-label="Uživatel">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end', width: '100%' }}>
                        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                            background: isAdmin ? 'var(--primary-red)' : (isDisabled ? 'var(--border-medium)' : 'var(--info-bright)'),
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem'
                          }}>
                            {user.firstName ? user.firstName[0] : ''}{user.lastName ? user.lastName[0] : ''}
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, color: isDisabled ? 'var(--text-gray)' : 'var(--text-primary)', textDecoration: isDisabled ? 'line-through' : 'none' }}>
                              {user.firstName} {user.lastName}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', wordBreak: 'break-all' }}>{user.email}</div>
                            {user.mustChangePassword && user.tempPassword && currentUserIsAdmin && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                marginTop: '0.3rem', padding: '0.2rem 0.5rem',
                                background: 'var(--warning-bg)', border: '1px solid var(--accent-gold)',
                                borderRadius: '6px', fontSize: '0.75rem'
                              }}>
                                <span style={{ color: 'var(--warning-dark)', fontWeight: 600 }}>⏳ Dočasné heslo:</span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--text-charcoal)', letterSpacing: revealedPasswords.has(user.uid) ? '0' : '0.1em' }}>
                                  {revealedPasswords.has(user.uid) ? user.tempPassword : '••••••••'}
                                </span>
                                <button
                                  onClick={() => toggleReveal(user.uid)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '0.85rem', lineHeight: 1 }}
                                  title={revealedPasswords.has(user.uid) ? 'Skrýt' : 'Zobrazit'}
                                >
                                  {revealedPasswords.has(user.uid) ? '🙈' : '👁️'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* COL 1.5: REGISTRATION NUMBER */}
                    <td data-label="Evidenční číslo">
                      <input 
                         type="text" 
                         className="input-field"
                         style={{ padding: '0.4rem', fontSize: '0.9rem', width: '100%', maxWidth: '60px', textAlign: 'center' }}
                         placeholder="Číslo"
                         defaultValue={user.registrationNumber || ''}
                         onBlur={(e) => updateRegistrationNumber(user.uid, e.target.value, user.registrationNumber || '')}
                         disabled={isDisabled} 
                      />
                    </td>

                    {/* COL 2: ROLES */}
                    <td data-label="Funkce" className="mobile-col">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {ROLE_OPTIONS.map(roleOption => {
                          const isAssigned = effectiveRoles.includes(roleOption);
                          const isAutoGranted = isAssigned && !roles.includes(roleOption);
                          const isRoleAdmin = roleOption === 'Admin';
                          const isProtectedRole = ['VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(roleOption);
                          const isAccessRole = roleOption === 'Přístup do Administrace';

                          // Admin role: never editable via UI
                          // VJ/Zástupce VJ: only Admin can change
                          // Přístup do Administrace: only Admin/VJ/Zastupce VJ can assign (not the new role itself)
                          // Auto-granted roles: shown as checked but not toggleable
                          const disabled = isDisabled || isRoleAdmin || isAutoGranted || (isProtectedRole && !currentUserIsAdmin) || (isAccessRole && !currentUserIsAdminOrVJ);
                          const tooltip = isRoleAdmin
                            ? "Roli Admina nelze měnit zde"
                            : isAutoGranted
                              ? "Automaticky uděleno díky jiné roli"
                            : (isProtectedRole && !currentUserIsAdmin)
                              ? "Tuto roli může měnit pouze Admin"
                              : (isAccessRole && !currentUserIsAdminOrVJ)
                                ? "Tuto roli mohou nastavit pouze Admin, VJ a Zástupce VJ"
                                : "";

                          return (
                            <label
                              key={roleOption}
                              style={{
                                display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '99px',
                                border: isAssigned ? `1px solid ${isRoleAdmin ? 'var(--danger)' : (isProtectedRole ? 'var(--warning)' : (isAccessRole ? 'var(--accent-purple)' : 'var(--info)'))}` : '1px solid var(--border)',
                                background: isAssigned ? (isRoleAdmin ? 'var(--danger-bg)' : (isProtectedRole ? 'var(--warning-bg)' : (isAccessRole ? 'var(--accent-purple-bg)' : 'var(--info-bg)'))) : 'transparent',
                                color: isAssigned ? (isRoleAdmin ? 'var(--danger-text)' : (isProtectedRole ? 'var(--warning-dark)' : (isAccessRole ? 'var(--accent-purple)' : 'var(--info-text)'))) : 'var(--text-dim)',
                                fontSize: '0.75rem', fontWeight: 600,
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: (disabled && !isAssigned) ? 0.5 : (isAutoGranted ? 0.7 : 1),
                                transition: 'all 0.2s'
                              }}
                              title={tooltip}
                            >
                              <input
                                type="checkbox"
                                style={{ display: 'none' }}
                                disabled={disabled}
                                checked={isAssigned}
                                onChange={() => toggleUserRole(user.uid, roles, roleOption)}
                              />
                              {roleOption}
                            </label>
                          )
                        })}
                      </div>
                    </td>

                    {/* COL 3: CERTIFICATIONS */}
                    <td data-label="Kvalifikace" className="mobile-col">
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {CERTIFICATION_OPTIONS.map(certOption => {
                          const isAssigned = certs.includes(certOption);
                          const disabled = isDisabled;

                          return (
                            <label
                              key={certOption}
                              style={{
                                display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '4px',
                                border: isAssigned ? '1px solid var(--warning)' : '1px solid var(--border)',
                                background: isAssigned ? 'var(--warning-bg)' : 'transparent',
                                color: isAssigned ? 'var(--warning-dark)' : 'var(--text-dim)',
                                fontSize: '0.75rem', fontWeight: 600,
                                cursor: disabled ? 'default' : 'pointer',
                                opacity: disabled && !isAssigned ? 0.5 : 1,
                                transition: 'all 0.2s'
                              }}
                            >
                              <input
                                type="checkbox"
                                style={{ display: 'none' }}
                                disabled={disabled}
                                checked={isAssigned}
                                onChange={() => toggleUserCertification(user.uid, certs, certOption)}
                              />
                              {certOption}
                            </label>
                          )
                        })}
                      </div>
                    </td>

                    {/* COL 4: ACTIONS */}
                    <td data-label="Akce">
                      {!isAdmin && !isSelf && (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => deactivateUser(user.uid, !isDisabled)}
                            style={{
                              border: 'none', cursor: 'pointer',
                              padding: '0.5rem 0.8rem', borderRadius: '6px',
                              color: isDisabled ? 'var(--success-text)' : 'var(--danger-text)',
                              background: isDisabled ? 'var(--success-bg)' : 'var(--danger-bg)',
                              fontWeight: 600, fontSize: '0.8rem',
                              transition: 'background 0.2s'
                            }}
                            title={isDisabled ? "Aktivovat účet" : "Deaktivovat účet"}
                          >
                            {isDisabled ? 'AKTIVOVAT' : 'DEAKTIVOVAT'}
                          </button>

                          {isDisabled && (
                            <button
                              onClick={() => deleteUser(user.uid)}
                              style={{
                                border: 'none', cursor: 'pointer',
                                padding: '0.5rem 0.8rem', borderRadius: '6px',
                                color: 'var(--text-on-dark)',
                                background: 'var(--danger)',
                                fontWeight: 600, fontSize: '0.8rem',
                                transition: 'background 0.2s',
                                boxShadow: '0 2px 4px rgba(211, 47, 47, 0.2)'
                              }}
                              title="Trvale smazat uživatele"
                            >
                              SMAZAT
                            </button>
                          )}
                        </div>
                      )}
                      {(isAdmin || isSelf) && <span style={{ color: 'var(--border-medium)', fontSize: '0.8rem' }}>---</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
