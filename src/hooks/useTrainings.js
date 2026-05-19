import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

export default function useTrainings() {
    const { currentUser, userData } = useAuth();
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [editTraining, setEditTraining] = useState(null);

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
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (type, message) => setToast({ type, message });

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

    return {
        currentUser,
        userData,
        loading,
        showCreateModal,
        setShowCreateModal,
        showPast,
        setShowPast,
        toast,
        setToast,
        deleteModal,
        setDeleteModal,
        editTraining,
        canCreate,
        canDeleteAny,
        upcomingTrainings,
        pastTrainings,
        handleJoin,
        handleLeave,
        requestDelete,
        confirmDelete,
        openEditModal,
        handleCloseModal,
        showToast
    };
}
