import React, { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAction } from '../../utils/logger';

export default function InlineActivities({ trainings, events, currentUser, userData, showToast, retroMode, onRetroAddParticipant }) {
  const [expanded, setExpanded] = useState(false);

  const activities = [
    ...(trainings || []).map(t => ({ ...t, type: 'training' })),
    ...(events || []).map(e => ({ ...e, type: 'event' }))
  ];

  const handleJoin = async (activity) => {
    if (!currentUser || !userData) return;

    if (activity.maxParticipants && (activity.participants?.length || 0) >= parseInt(activity.maxParticipants)) {
      showToast('error', 'Kapacita je naplněna.');
      return;
    }

    const collectionName = activity.type === 'training' ? 'trainings' : 'events';

    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayUnion({
          uid: currentUser.uid,
          name: `${userData.firstName} ${userData.lastName}`,
          joinedAt: new Date().toISOString()
        })
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akci';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'JOINED_TRAINING' : 'JOINED_EVENT', 'activities',
        `Přihlásil se na ${typeLabel} „${activity.title}“ (${activity.date}) – ze stránky Směn`);
      showToast('success', 'Přihlášeno!');
    } catch (err) {
      console.error('Error joining:', err);
      showToast('error', 'Chyba při přihlašování.');
    }
  };

  const handleLeave = async (activity) => {
    const myParticipation = activity.participants?.find(p => p.uid === currentUser?.uid);
    if (!myParticipation) return;
    const collectionName = activity.type === 'training' ? 'trainings' : 'events';

    try {
      await updateDoc(doc(db, collectionName, activity.id), {
        participants: arrayRemove(myParticipation)
      });
      const typeLabel = activity.type === 'training' ? 'školení' : 'akce';
      logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
        activity.type === 'training' ? 'LEFT_TRAINING' : 'LEFT_EVENT', 'activities',
        `Odhlásil se ze ${typeLabel} „${activity.title}“ (${activity.date}) – ze stránky Směn`);
      showToast('success', 'Odhlášeno.');
    } catch (err) {
      console.error('Error leaving:', err);
      showToast('error', 'Chyba při odhlašování.');
    }
  };

  const trainingCount = trainings?.length || 0;
  const eventCount = events?.length || 0;

  return (
    <div className="inline-activities">
      <div className="inline-activities__header" onClick={() => setExpanded(!expanded)}>
        <div className="inline-activities__title">
          {trainingCount > 0 && (
            <span className="inline-activities__badge inline-activities__badge--training">
              📚 {trainingCount} školení
            </span>
          )}
          {eventCount > 0 && (
            <span className="inline-activities__badge inline-activities__badge--event">
              🚩 {eventCount} akce
            </span>
          )}
        </div>
        <span className={`inline-activities__toggle ${expanded ? 'inline-activities__toggle--open' : ''}`}>
          ▼
        </span>
      </div>

      {expanded && (
        <div className="inline-activities__content">
          {activities.map(activity => {
            const isJoined = activity.participants?.some(p => p.uid === currentUser?.uid);
            const isTraining = activity.type === 'training';

            return (
              <div
                key={activity.id}
                className={`inline-activity-card ${isTraining ? 'inline-activity-card--training' : 'inline-activity-card--event'}`}
              >
                <div className="inline-activity-card__info">
                  <div className={`inline-activity-card__type ${isTraining ? 'inline-activity-card__type--training' : 'inline-activity-card__type--event'}`}>
                    {isTraining ? 'Školení' : 'Akce'}
                  </div>
                  <div className="inline-activity-card__title">{activity.title}</div>
                  <div className="inline-activity-card__meta">
                    ⏰ {activity.time}{activity.timeEnd ? ` – ${activity.timeEnd}` : ''}
                    {activity.location && ` • 📍 ${activity.location}`}
                  </div>
                </div>

                <div className="inline-activity-card__actions">
                    {isJoined ? (
                      <button
                        className="inline-activity-card__btn inline-activity-card__btn--leave"
                        onClick={() => handleLeave(activity)}
                      >
                        Odhlásit
                      </button>
                    ) : (activity.maxParticipants && (activity.participants?.length || 0) >= parseInt(activity.maxParticipants)) ? (
                      <button
                        className="inline-activity-card__btn"
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed', background: '#e0e0e0', color: '#757575', borderColor: '#d0d0d0' }}
                      >
                        Plno
                      </button>
                    ) : (
                      <button
                        className="inline-activity-card__btn inline-activity-card__btn--join"
                        onClick={() => handleJoin(activity)}
                      >
                        Přihlásit
                      </button>
                    )}
                    {retroMode && (
                      <button
                        className="inline-activity-card__btn"
                        onClick={() => onRetroAddParticipant && onRetroAddParticipant(activity)}
                        style={{ background: '#FFF8E1', color: '#E65100', borderColor: '#FFB300', marginLeft: '0.25rem' }}
                        title="Přidat jiného člena (Admin)"
                      >
                        ⏱ +
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
