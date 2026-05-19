import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

export default function useEvents() {
    const { currentUser, userData } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [toast, setToast] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [editEvent, setEditEvent] = useState(null);

    const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
    const canCreate = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ', 'VD'].includes(r));
    const canDeleteAny = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => a.date.localeCompare(b.date));
            setEvents(data);
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

    const upcomingEvents = events.filter(t => t.date >= todayISO);
    const pastEvents = events.filter(t => t.date < todayISO).reverse();

    const handleJoin = async (event) => {
        if (!currentUser || !userData) return;

        if (event.participants?.some(p => p.uid === currentUser.uid)) {
            showToast('warning', 'Již jste přihlášen/a.');
            return;
        }

        if (event.maxParticipants && event.participants?.length >= event.maxParticipants) {
            showToast('error', 'Akce je plně obsazena.');
            return;
        }

        try {
            await updateDoc(doc(db, 'events', event.id), {
                participants: arrayUnion({
                    uid: currentUser.uid,
                    name: `${userData.firstName} ${userData.lastName}`,
                    joinedAt: new Date().toISOString()
                })
            });
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'JOINED_EVENT', 'activities',
                `Přihlásil se na akci „${event.title}“ (${event.date})${event.location ? ` – místo: ${event.location}` : ''}`);
            showToast('success', 'Přihlášeno!');
        } catch (err) {
            console.error('Error joining:', err);
            showToast('error', 'Chyba při přihlašování.');
        }
    };

    const handleLeave = async (event) => {
        const myParticipation = event.participants?.find(p => p.uid === currentUser?.uid);
        if (!myParticipation) return;

        try {
            await updateDoc(doc(db, 'events', event.id), {
                participants: arrayRemove(myParticipation)
            });
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'LEFT_EVENT', 'activities',
                `Odhlásil se z akce „${event.title}“ (${event.date})`);
            showToast('success', 'Odhlášeno.');
        } catch (err) {
            console.error('Error leaving:', err);
            showToast('error', 'Chyba při odhlašování.');
        }
    };

    const requestDelete = (event) => {
        if (!(canDeleteAny || event.createdBy?.uid === currentUser?.uid)) return;
        setDeleteModal(event);
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        try {
            await deleteDoc(doc(db, 'events', deleteModal.id));
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'ADMIN_DELETED_EVENT', 'admin',
                `Smazal akci „${deleteModal.title}“ (${deleteModal.date})`);
            showToast('success', 'Smazáno.');
        } catch (err) {
            console.error('Error deleting:', err);
            showToast('error', 'Chyba při mazání.');
        }
        setDeleteModal(null);
    };

    const openEditModal = (event) => {
        setEditEvent(event);
        setShowCreateModal(true);
    };

    const handleCloseModal = () => {
        setShowCreateModal(false);
        setEditEvent(null);
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
        editEvent,
        canCreate,
        canDeleteAny,
        upcomingEvents,
        pastEvents,
        handleJoin,
        handleLeave,
        requestDelete,
        confirmDelete,
        openEditModal,
        handleCloseModal,
        showToast
    };
}
