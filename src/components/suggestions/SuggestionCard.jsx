const STATUS_CONFIG = {
    open:     { label: 'Otevřeno',  bg: 'var(--info-bg)', color: 'var(--info-text)', border: 'var(--info-border-soft)' },
    planned:  { label: 'Plánováno', bg: 'var(--warning-bg)', color: 'var(--warning-dark)', border: 'var(--warning-border)' },
    done:     { label: 'Hotovo',    bg: 'var(--success-bg)', color: 'var(--success-text)', border: 'var(--success-border-strong)' },
    rejected: { label: 'Zamítnuto', bg: 'var(--surface-alt)', color: 'var(--text-dim)', border: 'var(--border)' },
};

export default function SuggestionCard({ suggestion, currentUser, isAdmin, onVote, onDelete }) {
    const uid = currentUser?.uid;
    const isOwn = suggestion.authorUid === uid;
    const hasVotedYes = suggestion.yesVotes?.includes(uid);
    const hasVotedNo = suggestion.noVotes?.includes(uid);
    const yesCount = suggestion.yesVotes?.length || 0;
    const noCount = suggestion.noVotes?.length || 0;
    const status = STATUS_CONFIG[suggestion.status] || STATUS_CONFIG.open;

    const createdAt = suggestion.createdAt?.toDate?.();
    const dateStr = createdAt
        ? createdAt.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })
        : '';

    const canDelete = isAdmin || (isOwn && suggestion.status === 'open');

    return (
        <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1.25rem 1.4rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            border: '1px solid var(--surface-hover)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem', lineHeight: 1.3 }}>
                        {suggestion.title}
                    </div>
                    {suggestion.description && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                            {suggestion.description}
                        </div>
                    )}
                </div>
                <span style={{
                    padding: '0.22rem 0.7rem',
                    borderRadius: '50px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: status.bg,
                    color: status.color,
                    border: `1px solid ${status.border}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                }}>
                    {status.label}
                </span>
            </div>

            {suggestion.adminNote && (
                <div style={{
                    background: 'var(--warning-bg-soft)',
                    border: '1px solid var(--warning-border-yellow)',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-brown)',
                }}>
                    <strong>Poznámka admina:</strong> {suggestion.adminNote}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                    {suggestion.authorName} · {dateStr}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        onClick={() => !isOwn && onVote(suggestion.id, 'yes')}
                        disabled={isOwn}
                        title={isOwn ? 'Nemůžete hlasovat pro vlastní návrh' : ''}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.7rem',
                            borderRadius: '50px',
                            border: hasVotedYes ? '1.5px solid var(--info-text)' : '1.5px solid var(--border)',
                            background: hasVotedYes ? 'var(--info-bg)' : 'white',
                            color: hasVotedYes ? 'var(--info-text)' : 'var(--text-secondary)',
                            cursor: isOwn ? 'default' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: hasVotedYes ? 700 : 400,
                            opacity: isOwn ? 0.5 : 1,
                            transition: 'all 0.15s',
                        }}
                    >
                        👍 {yesCount}
                    </button>
                    <button
                        onClick={() => !isOwn && onVote(suggestion.id, 'no')}
                        disabled={isOwn}
                        title={isOwn ? 'Nemůžete hlasovat pro vlastní návrh' : ''}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.7rem',
                            borderRadius: '50px',
                            border: hasVotedNo ? '1.5px solid var(--danger-text)' : '1.5px solid var(--border)',
                            background: hasVotedNo ? 'var(--danger-bg)' : 'white',
                            color: hasVotedNo ? 'var(--danger-text)' : 'var(--text-secondary)',
                            cursor: isOwn ? 'default' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: hasVotedNo ? 700 : 400,
                            opacity: isOwn ? 0.5 : 1,
                            transition: 'all 0.15s',
                        }}
                    >
                        👎 {noCount}
                    </button>
                    {canDelete && (
                        <button
                            onClick={() => onDelete(suggestion.id)}
                            style={{
                                padding: '0.3rem 0.6rem',
                                borderRadius: '50px',
                                border: '1.5px solid var(--border)',
                                background: 'white',
                                color: 'var(--text-subtle)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger-text)'; e.currentTarget.style.color = 'var(--danger-text)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-subtle)'; }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
