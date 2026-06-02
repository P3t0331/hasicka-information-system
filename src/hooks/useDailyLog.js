import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, addDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function useDailyLog(collectionName, logCategory, logLabel) {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [showEditor, setShowEditor] = useState(false);
    const [editingEntry, setEditingEntry] = useState(null);
    const [editorPrefillDate, setEditorPrefillDate] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);
    const [onlyMine, setOnlyMine] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
    const canEditAny = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));
    const canCreate = !!currentUser && !!userData && !userData.disabled && userData.approved !== false;

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, collectionName), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            setEntries(data);
            setLoading(false);
        }, (err) => {
            console.error(`Error loading ${collectionName}:`, err);
            setLoading(false);
        });
        return unsubscribe;
    }, [collectionName, refreshKey]);

    const refresh = useCallback(() => {
        return new Promise(resolve => {
            setRefreshKey(k => k + 1);
            setTimeout(resolve, 1200);
        });
    }, []);

    const showToast = (type, message) => addToast(type, message);

    const monthPrefix = useMemo(() => {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    }, [currentDate]);

    const monthEntries = useMemo(() => {
        return entries.filter(e => e.date && e.date.startsWith(monthPrefix));
    }, [entries, monthPrefix]);

    const visibleEntries = useMemo(() => {
        if (!onlyMine || !currentUser) return monthEntries;
        return monthEntries.filter(e =>
            (e.participants || []).some(p => p.uid === currentUser.uid) ||
            e.createdBy?.uid === currentUser.uid
        );
    }, [monthEntries, onlyMine, currentUser]);

    const canModifyEntry = (entry) => {
        if (!currentUser) return false;
        if (canEditAny) return true;
        return entry.createdBy?.uid === currentUser.uid;
    };

    const handleMonthChange = (offset) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const goToMonth = (year, monthIndex) => {
        setCurrentDate(new Date(year, monthIndex, 1));
    };

    const openCreateEditor = (date = null) => {
        setEditingEntry(null);
        setEditorPrefillDate(date);
        setShowEditor(true);
    };

    const openEditEditor = (entry) => {
        setEditingEntry(entry);
        setEditorPrefillDate(null);
        setShowEditor(true);
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditingEntry(null);
        setEditorPrefillDate(null);
    };

    const saveEntry = async (payload) => {
        if (!currentUser || !userData) return;

        const isEdit = !!editingEntry;
        const baseData = {
            date: payload.date,
            description: payload.description.trim(),
            participants: payload.participants,
            externalParticipants: payload.externalParticipants,
            hours: Number(payload.hours) || 0,
            peopleCount: Number(payload.peopleCount) || 0,
            personHoursOverride: payload.personHoursOverride ?? null,
        };

        try {
            if (isEdit) {
                await updateDoc(doc(db, collectionName, editingEntry.id), {
                    ...baseData,
                    updatedAt: new Date().toISOString(),
                    updatedBy: { uid: currentUser.uid, name: `${userData.firstName} ${userData.lastName}` }
                });
                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    `${logCategory.toUpperCase()}_UPDATED`, logCategory,
                    `Upravil záznam ${logLabel}: „${baseData.description}“ (${baseData.date})`);
                showToast('success', 'Záznam upraven.');
            } else {
                await addDoc(collection(db, collectionName), {
                    ...baseData,
                    createdBy: { uid: currentUser.uid, name: `${userData.firstName} ${userData.lastName}` },
                    createdAt: new Date().toISOString()
                });
                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    `${logCategory.toUpperCase()}_ADDED`, logCategory,
                    `Přidal záznam ${logLabel}: „${baseData.description}“ (${baseData.date})`);
                showToast('success', 'Záznam přidán.');
            }
            closeEditor();
        } catch (err) {
            console.error('Error saving log entry:', err);
            showToast('error', 'Chyba při ukládání.');
        }
    };

    const requestDelete = (entry) => {
        if (!canModifyEntry(entry)) return;
        setDeleteModal(entry);
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;
        try {
            await deleteDoc(doc(db, collectionName, deleteModal.id));
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                `${logCategory.toUpperCase()}_DELETED`, logCategory,
                `Smazal záznam ${logLabel}: „${deleteModal.description}“ (${deleteModal.date})`);
            showToast('success', 'Smazáno.');
        } catch (err) {
            console.error('Error deleting log entry:', err);
            showToast('error', 'Chyba při mazání.');
        }
        setDeleteModal(null);
    };

    return {
        currentUser,
        userData,
        loading,
        entries,
        monthEntries,
        visibleEntries,
        currentDate,
        setCurrentDate,
        handleMonthChange,
        goToMonth,
        canCreate,
        canEditAny,
        canModifyEntry,
        showEditor,
        editingEntry,
        editorPrefillDate,
        openCreateEditor,
        openEditEditor,
        closeEditor,
        saveEntry,
        deleteModal,
        setDeleteModal,
        requestDelete,
        confirmDelete,
        onlyMine,
        setOnlyMine,
        refresh
    };
}
