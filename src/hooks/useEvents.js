import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, onSnapshot, updateDoc, deleteDoc, addDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function useEvents() {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [events, setEvents] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [deleteModal, setDeleteModal] = useState(null);
    const [editEvent, setEditEvent] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

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
    }, [refreshKey]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'eventTemplates'), (snap) => {
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

    const saveAsTemplate = async (templateData) => {
        try {
            await addDoc(collection(db, 'eventTemplates'), {
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
            await deleteDoc(doc(db, 'eventTemplates', templateId));
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
        editEvent,
        canCreate,
        canDeleteAny,
        upcomingEvents,
        pastEvents,
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
