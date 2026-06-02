import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logAction } from '../utils/logger';

export default function useProfile() {
    const { currentUser, userData, logout } = useAuth();
    const { addToast } = useToast();

    // Edit Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});

    // Equipment State
    const [equipmentTypes, setEquipmentTypes] = useState([]);
    const [showEqModal, setShowEqModal] = useState(false);
    const [currentEq, setCurrentEq] = useState(null);

    // Notifications and Modals
    const [confirmModal, setConfirmModal] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        return new Promise(resolve => {
            setRefreshKey(k => k + 1);
            setTimeout(resolve, 1200);
        });
    }, []);

    function showNotification(type, message) {
        addToast(type, message);
    }

    function requestConfirm(message, onConfirm) {
        setConfirmModal({ message, onConfirm });
    }

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "settings", "equipmentTypes"), (docSnap) => {
            if (docSnap.exists()) {
                setEquipmentTypes(docSnap.data().types || []);
            }
        });
        return unsub;
    }, [refreshKey]);

    useEffect(() => {
        if (currentUser && userData) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setEditForm({
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                phone: userData.phone || '',
                address: userData.address || ''
            });
        }
    }, [currentUser, userData]);

    async function handleLogout() {
        try {
            await logout();
        } catch (error) {
            console.error("Failed to log out", error);
        }
    }

    async function handleUpdateProfile(e) {
        e.preventDefault();
        try {
            const userRef = doc(db, "users", currentUser.uid);

            const changed = [];
            if (editForm.firstName !== userData.firstName) changed.push('Jméno');
            if (editForm.lastName !== userData.lastName) changed.push('Příjmení');
            if (editForm.phone !== userData.phone) changed.push('Telefon');
            if (editForm.address !== userData.address) changed.push('Adresa');

            await updateDoc(userRef, {
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                phone: editForm.phone,
                address: editForm.address
            });

            if (changed.length > 0) {
                logAction(db, currentUser.uid, `${editForm.firstName} ${editForm.lastName}`,
                    'UPDATED_PROFILE', 'profile',
                    `Aktualizoval osobní údaje – změněna pole: ${changed.join(', ')}`);
            }

            setIsEditing(false);
            showNotification('success', 'Profil byl úspěšně aktualizován.');
        } catch (error) {
            console.error("Error updating profile:", error);
            showNotification('error', 'Chyba při ukládání profilu.');
        }
    }

    async function handleSaveEquipment(e) {
        e.preventDefault();
        if (!currentEq || !currentEq.typeId) return;

        try {
            const userRef = doc(db, "users", currentUser.uid);
            const baseList = userData.equipmentList || [];
            let newList = [];
            let isNew = false;

            if (currentEq.id) {
                newList = baseList.map(item => item.id === currentEq.id ? currentEq : item);
            } else {
                isNew = true;
                newList = [...baseList, { ...currentEq, id: crypto.randomUUID() }];
            }

            const eqType = equipmentTypes.find(t => t.id === currentEq.typeId);

            await updateDoc(userRef, {
                equipmentList: newList
            });

            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'UPDATED_EQUIPMENT', 'profile',
                `${isNew ? 'Přidal' : 'Upravil'} vybavení: ${eqType?.name}`);

            setShowEqModal(false);
            setCurrentEq(null);
            showNotification('success', 'Vybavení bylo uloženo.');
        } catch (error) {
            console.error("Error saving equipment:", error);
            showNotification('error', 'Chyba při ukládání vybavení.');
        }
    }

    function handleDeleteEquipment(eqId) {
        requestConfirm('Opravdu smazat toto vybavení ze svého profilu?', async () => {
            try {
                const userRef = doc(db, "users", currentUser.uid);
                const currentList = userData.equipmentList || [];
                const newList = currentList.filter(item => item.id !== eqId);

                await updateDoc(userRef, { equipmentList: newList });

                logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                    'UPDATED_EQUIPMENT', 'profile',
                    `Smazal záznam vybavení.`);
                showNotification('success', 'Vybavení bylo odstraněno.');
            } catch (error) {
                console.error("Error deleting equipment:", error);
                showNotification('error', 'Chyba při odstraňování vybavení.');
            }
        });
    }

    return {
        currentUser,
        userData,
        isEditing,
        setIsEditing,
        editForm,
        setEditForm,
        equipmentTypes,
        showEqModal,
        setShowEqModal,
        currentEq,
        setCurrentEq,
        confirmModal,
        setConfirmModal,
        handleLogout,
        handleUpdateProfile,
        handleSaveEquipment,
        handleDeleteEquipment,
        requestConfirm,
        refresh
    };
}
