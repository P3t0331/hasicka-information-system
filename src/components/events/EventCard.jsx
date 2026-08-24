import React, { useState } from 'react';
import LinkifiedText from '../LinkifiedText';

export default function EventCard({ event, isPast, currentUser, onJoin, onLeave, onDelete, onEdit, canDelete }) {
    const [expanded, setExpanded] = useState(false);

    const isJoined = event.participants?.some(p => p.uid === currentUser?.uid);
    const count = event.participants?.length || 0;

    const formatDate = (isoDate) => {
        if (!isoDate) return {};
        const [year, month, day] = isoDate.split('-');
        const MONTHS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
        const DAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
        const weekday = DAYS[new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).getDay()];
        return { day: parseInt(day), month: MONTHS[parseInt(month) - 1], year, weekday };
    };

    const dateInfo = formatDate(event.date);

    const dateBadgeClass = isPast ? 'date-badge date-badge--past' :
        isJoined ? 'date-badge date-badge--joined' : 'date-badge';

    const cardClass = `event-card ${isPast ? 'event-card--past' : event.isImportant ? 'event-card--important' : ''}`;

    return (
        <div className={cardClass}>
            {/* Date Badge */}
            <div className={dateBadgeClass}>
                <div className="date-badge__weekday">{dateInfo.weekday}</div>
                <div className="date-badge__day">{dateInfo.day}</div>
                <div className="date-badge__month">{dateInfo.month}</div>
            </div>

            {/* Content */}
            <div className="event-card__content">
                <div className="event-card__header">
                    <div className={`event-card__title ${isPast ? 'event-card__title--past' : ''}`}>
                        <span>{event.title}</span>
                        {event.isImportant && !isPast && (
                            <span className="event-card__badge event-card__badge--important">⚠️ Důležité</span>
                        )}
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
                                onClick={(e) => { e.stopPropagation(); onEdit(event); }}
                                title="Upravit"
                            >
                                ✏️
                            </button>
                            <button
                                className="event-card__delete-btn"
                                onClick={(e) => { e.stopPropagation(); onDelete(event); }}
                                title="Smazat"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Meta Info */}
                <div className="event-card__meta">
                    {event.departureTime && (
                        <>
                            <span className="event-card__meta-item" title="Čas odjezdu">
                                🚌 {event.departureTime}
                            </span>
                            <span className="event-card__meta-sep">•</span>
                        </>
                    )}
                    <span className="event-card__meta-item" title="Čas konání">
                        ⏰ {event.time}{event.timeEnd ? ` – ${event.timeEnd}` : ''}
                    </span>
                    <span className="event-card__meta-sep">•</span>
                    <span className="event-card__meta-item">
                        📍 {event.location || 'Stanice'}
                    </span>
                    {event.vehicles && (
                        <>
                            <span className="event-card__meta-sep">•</span>
                            <span className="event-card__meta-item" title="Technika" style={{ color: 'var(--warning-dark)', fontWeight: 600 }}>
                                🚒 {event.vehicles}
                            </span>
                        </>
                    )}
                </div>

                {event.description && (
                    <div className="event-card__description">
                        <LinkifiedText text={event.description} />
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
                            {count}{event.maxParticipants ? `/${event.maxParticipants}` : ''}
                        </span>
                        {count > 0 && (
                            <span className={`participants-count__chevron ${expanded ? 'open' : ''}`}>▼</span>
                        )}
                    </div>

                    {!isPast && (
                        isJoined ? (
                            <button className="event-action-btn event-action-btn--leave" onClick={() => onLeave(event)}>
                                Odhlásit
                            </button>
                        ) : (event.maxParticipants && count >= parseInt(event.maxParticipants)) ? (
                            <button className="event-action-btn" disabled style={{ opacity: 0.6, cursor: 'not-allowed', background: 'var(--border)', color: 'var(--text-dim)', borderColor: 'var(--border-medium)' }}>
                                Plno
                            </button>
                        ) : (
                            <button className="event-action-btn event-action-btn--join" onClick={() => onJoin(event)}>
                                Přihlásit
                            </button>
                        )
                    )}
                </div>

                {/* Expanded Participants List */}
                {expanded && count > 0 && (
                    <div className="participants-list">
                        {event.participants.map(p => (
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
