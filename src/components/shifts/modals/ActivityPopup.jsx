import React from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../../firebase';
import { logAction } from '../../../utils/logger';

export default function ActivityPopup({ day, trainingsData, eventsData, currentUser, userData, onClose, showToast }) {
  const navigate = useNavigate();

  // Compute activities from real-time data
  const activities = [
    ...(trainingsData || [])
      .filter(t => parseInt(t.date?.split('-')[2]) === day.date)
      .map(t => ({ ...t, type: 'training' })),
    ...(eventsData || [])
      .filter(e => parseInt(e.date?.split('-')[2]) === day.date)
      .map(e => ({ ...e, type: 'event' }))
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

  const formatDate = () => {
    const MONTHS = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
    return `${day.date}. ${MONTHS[new Date().getMonth()]}`;
  };

  return (
    <div className="activity-popup-overlay" onClick={onClose}>
      <div className="activity-popup" onClick={e => e.stopPropagation()}>
        <div className="activity-popup__header">
          <span className="activity-popup__date">📅 {formatDate()}</span>
          <button className="activity-popup__close" onClick={onClose}>✕</button>
        </div>

        <div className="activity-popup__content">
          {activities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
              Žádné aktivity
            </div>
          ) : (
            activities.map(activity => {
              const isJoined = activity.participants?.some(p => p.uid === currentUser?.uid);
              const isTraining = activity.type === 'training';
              const count = activity.participants?.length || 0;

              return (
                <div
                  key={activity.id}
                  className={`activity-item ${isTraining ? 'activity-item--training' : 'activity-item--event'}`}
                >
                  <div className={`activity-item__type ${isTraining ? 'activity-item__type--training' : 'activity-item__type--event'}`}>
                    {isTraining ? '📚 Školení' : '🚩 Akce'}
                  </div>

                  <div className="activity-item__title">
                    <span>{activity.title}</span>
                    {isJoined && <span className="activity-item__joined-badge">✓ Přihlášen</span>}
                  </div>

                  <div className="activity-item__meta">
                    <span>⏰ {activity.time}{activity.timeEnd ? ` – ${activity.timeEnd}` : ''}</span>
                    {activity.location && <span>📍 {activity.location}</span>}
                  </div>

                  <div className="activity-item__participants">
                    👥 {count}{activity.maxParticipants ? `/${activity.maxParticipants}` : ''} {count === 1 ? 'účastník' : (count >= 2 && count <= 4) ? 'účastníci' : 'účastníků'}
                  </div>

                  <div className="activity-item__actions">
                    {isJoined ? (
                      <button
                        className="activity-item__btn activity-item__btn--leave"
                        onClick={() => handleLeave(activity)}
                      >
                        Odhlásit
                      </button>
                    ) : (activity.maxParticipants && count >= parseInt(activity.maxParticipants)) ? (
                      <button
                        className="activity-item__btn"
                        disabled
                        style={{ opacity: 0.6, cursor: 'not-allowed', background: '#e0e0e0', color: '#757575', borderColor: '#d0d0d0' }}
                      >
                        Plno
                      </button>
                    ) : (
                      <button
                        className="activity-item__btn activity-item__btn--join"
                        onClick={() => handleJoin(activity)}
                      >
                        Přihlásit
                      </button>
                    )}
                    <button
                      className="activity-item__btn activity-item__btn--view"
                      onClick={() => {
                        onClose();
                        navigate(isTraining ? '/skoleni' : '/akce');
                      }}
                    >
                      Detail
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
