import React, { useState } from 'react';
import LinkifiedText from '../LinkifiedText';

export default function TrainingCard({ training, isPast, currentUser, onJoin, onLeave, onDelete, onEdit, canDelete }) {
    const [expanded, setExpanded] = useState(false);

    const isJoined = training.participants?.some(p => p.uid === currentUser?.uid);
    const count = training.participants?.length || 0;

    const formatDate = (isoDate) => {
        if (!isoDate) return {};
        const [year, month, day] = isoDate.split('-');
        const MONTHS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
        return { day: parseInt(day), month: MONTHS[parseInt(month) - 1], year };
    };

    const dateInfo = formatDate(training.date);

    const dateBadgeClass = isPast ? 'date-badge date-badge--past' :
        isJoined ? 'date-badge date-badge--joined' : 'date-badge';

    return (
        <div className={`event-card ${isPast ? 'event-card--past' : ''}`}>
            {/* Date Badge */}
            <div className={dateBadgeClass}>
                <div className="date-badge__day">{dateInfo.day}</div>
                <div className="date-badge__month">{dateInfo.month}</div>
            </div>

            {/* Content */}
            <div className="event-card__content">
                <div className="event-card__header">
                    <div className={`event-card__title ${isPast ? 'event-card__title--past' : ''}`}>
                        <span>{training.title}</span>
                        {isJoined && !isPast && (
                            <span className="event-card__badge event-card__badge--joined">✓ Přihlášen</span>
                        )}
                        {isPast && (
                            <span className="event-card__badge event-card__badge--past">Proběhlo</span>
                        )}
                    </div>

                    {canDelete && (
                        <div className="event-card__actions-top">
                            <button
                                className="event-card__edit-btn"
                                onClick={(e) => { e.stopPropagation(); onEdit(training); }}
                                title="Upravit"
                            >
                                ✏️
                            </button>
                            <button
                                className="event-card__delete-btn"
                                onClick={(e) => { e.stopPropagation(); onDelete(training); }}
                                title="Smazat"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Meta Info */}
                <div className="event-card__meta">
                    {training.departureTime && (
                        <>
                            <span className="event-card__meta-item" title="Čas odjezdu">
                                🚌 {training.departureTime}
                            </span>
                            <span className="event-card__meta-sep">•</span>
                        </>
                    )}
                    <span className="event-card__meta-item" title="Čas konání">
                        ⏰ {training.time}{training.timeEnd ? ` – ${training.timeEnd}` : ''}
                    </span>
                    <span className="event-card__meta-sep">•</span>
                    <span className="event-card__meta-item">
                        📍 {training.location || 'Stanice'}
                    </span>
                    {training.vehicles && (
                        <>
                            <span className="event-card__meta-sep">•</span>
                            <span className="event-card__meta-item" title="Technika" style={{ color: '#E65100', fontWeight: 600 }}>
                                🚒 {training.vehicles}
                            </span>
                        </>
                    )}
                    {(() => {
                        const instructors = training.instructors?.length
                            ? training.instructors
                            : training.instructor?.name
                                ? [training.instructor]
                                : [];
                        if (!instructors.length) return null;
                        return (
                            <>
                                <span className="event-card__meta-sep">•</span>
                                <span className="event-card__meta-item" title="Školitel" style={{ color: '#1565C0', fontWeight: 600 }}>
                                    🎓 {instructors.map(i => i.name).join(', ')}
                                </span>
                            </>
                        );
                    })()}
                </div>

                {training.description && (
                    <div className="event-card__description">
                        <LinkifiedText text={training.description} />
                    </div>
                )}

                {/* Footer */}
                <div className="event-card__footer">
                    <div
                        className={`participants-count ${count > 0 ? 'participants-count--clickable' : ''}`}
                        onClick={() => count > 0 && setExpanded(!expanded)}
                    >
                        <span className="participants-count__icon">👥</span>
                        <span className="participants-count__number">
                            {count}{training.maxParticipants ? `/${training.maxParticipants}` : ''}
                        </span>
                        {count > 0 && (
                            <span className={`participants-count__chevron ${expanded ? 'open' : ''}`}>▼</span>
                        )}
                    </div>

                    {!isPast && (
                        isJoined ? (
                            <button className="event-action-btn event-action-btn--leave" onClick={() => onLeave(training)}>
                                Odhlásit
                            </button>
                        ) : (training.maxParticipants && count >= parseInt(training.maxParticipants)) ? (
                            <button className="event-action-btn" disabled style={{ opacity: 0.6, cursor: 'not-allowed', background: '#e0e0e0', color: '#757575', borderColor: '#d0d0d0' }}>
                                Plno
                            </button>
                        ) : (
                            <button className="event-action-btn event-action-btn--join" onClick={() => onJoin(training)}>
                                Přihlásit
                            </button>
                        )
                    )}
                </div>

                {/* Expanded Participants List */}
                {expanded && count > 0 && (
                    <div className="participants-list">
                        {training.participants.map(p => (
                            <div
                                key={p.uid}
                                className={`participants-list__item ${p.uid === currentUser?.uid ? 'participants-list__item--current' : ''}`}
                            >
                                {p.uid === currentUser?.uid && <span>⭐</span>}
                                <span>{p.name}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
