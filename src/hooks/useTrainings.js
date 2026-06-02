import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, deleteDoc, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function useTrainings() {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [trainings, setTrainings] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [deleteModal, setDeleteModal] = useState(null);
    const [editTraining, setEditTraining] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
    const canCreate = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'VD'].includes(r));
    const canDeleteAny = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'trainings'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => a.date.localeCompare(b.date));
            setTrainings(data);
            setLoading(false);
        });
        return unsubscribe;
    }, [refreshKey]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'trainingTemplates'), (snap) => {
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => a.title.localeCompare(b.title, 'cs')));
        });
        return unsub;
    }, [refreshKey]);

    const showToast = (type, message) => addToast(type, message);

    const refresh = useCallback(() => {
        return new Promise(resolve => {
            setRefreshKey(k => k + 1);
            setTimeout(resolve, 1200);
        });
    }, []);

    const upcomingTrainings = trainings.filter(t => t.date >= todayISO);
    const pastTrainings = trainings.filter(t => t.date < todayISO).reverse();

    const handleJoin = async (training) => {
        if (!currentUser || !userData) return;

        if (training.participants?.some(p => p.uid === currentUser.uid)) {
            showToast('warning', 'Již jste přihlášen/a.');
            return;
        }

        if (training.maxParticipants && training.participants?.length >= training.maxParticipants) {
            showToast('error', 'Školení je plně obsazeno.');
            return;
        }

        try {
            await updateDoc(doc(db, 'trainings', training.id), {
                participants: arrayUnion({
                    uid: currentUser.uid,
                    name: `${userData.firstName} ${userData.lastName}`,
                    joinedAt: new Date().toISOString()
                })
            });
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'JOINED_TRAINING', 'activities',
                `Přihlásil se na školení „${training.title}“ (${training.date})${training.location ? ` – místo: ${training.location}` : ''}`);
            showToast('success', 'Přihlášeno!');
        } catch (err) {
            console.error('Error joining:', err);
            showToast('error', 'Chyba při přihlašování.');
        }
    };

    const handleLeave = async (training) => {
        const myParticipation = training.participants?.find(p => p.uid === currentUser?.uid);
        if (!myParticipation) return;

        try {
            await updateDoc(doc(db, 'trainings', training.id), {
                participants: arrayRemove(myParticipation)
            });
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'LEFT_TRAINING', 'activities',
                `Odhlásil se ze školení „${training.title}“ (${training.date})`);
            showToast('success', 'Odhlášeno.');
        } catch (err) {
            console.error('Error leaving:', err);
            showToast('error', 'Chyba při odhlašování.');
        }
    };

    const requestDelete = (training) => {
        if (!(canDeleteAny || training.createdBy?.uid === currentUser?.uid)) return;
        setDeleteModal(training);
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        try {
            await deleteDoc(doc(db, 'trainings', deleteModal.id));
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'ADMIN_DELETED_TRAINING', 'admin',
                `Smazal školení „${deleteModal.title}“ (${deleteModal.date})`);
            showToast('success', 'Smazáno.');
        } catch (err) {
            console.error('Error deleting:', err);
            showToast('error', 'Chyba při mazání.');
        }
        setDeleteModal(null);
    };

    const openEditModal = (training) => {
        setEditTraining(training);
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditTraining(null);
    };

    const saveAsTemplate = async (templateData) => {
        try {
            await addDoc(collection(db, 'trainingTemplates'), {
                ...templateData,
                createdBy: { uid: currentUser.uid, name: `${userData.firstName} ${userData.lastName}` },
                createdAt: new Date().toISOString()
            });
            showToast('success', 'Šablona uložena.');
        } catch (err) {
            console.error('Error saving template:', err);
            showToast('error', 'Chyba při ukládání šablony.');
        }
    };

    const deleteTemplate = async (templateId) => {
        try {
            await deleteDoc(doc(db, 'trainingTemplates', templateId));
            showToast('success', 'Šablona smazána.');
        } catch (err) {
            console.error('Error deleting template:', err);
            showToast('error', 'Chyba při mazání šablony.');
        }
    };

    return {
        currentUser,
        userData,
        loading,
        showCreateModal,
        setShowCreateModal,
        showPast,
        setShowPast,
        deleteModal,
        setDeleteModal,
        editTraining,
        canCreate,
        canDeleteAny,
        upcomingTrainings,
        pastTrainings,
        templates,
        handleJoin,
        handleLeave,
        requestDelete,
        confirmDelete,
        openEditModal,
        handleCloseModal,
        saveAsTemplate,
        deleteTemplate,
        refresh,
    };
}
