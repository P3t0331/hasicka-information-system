import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function useBulletin() {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [deleteModal, setDeleteModal] = useState(null);

    const userRoles = userData ? (userData.roles || [userData.role || 'Hasič']) : [];
    const canCreate = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));
    const canDeleteAny = userRoles.some(r => ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'].includes(r));

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'bulletinPosts'), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                return (b.createdAt || '').localeCompare(a.createdAt || '');
            });
            setPosts(data);
            setLoading(false);
        }, (err) => {
            console.error('Error loading bulletin posts:', err);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const showToastMsg = (type, message) => addToast(type, message);

    const unseenPosts = useMemo(() => {
        if (!currentUser) return [];
        return posts.filter(p => !(p.seenBy || []).includes(currentUser.uid));
    }, [posts, currentUser]);

    const canModifyPost = (post) => {
        if (!currentUser) return false;
        if (canDeleteAny) return true;
        return post.createdBy?.uid === currentUser.uid;
    };

    const openCreateEditor = () => {
        setEditingPost(null);
        setShowEditor(true);
    };

    const openEditEditor = (post) => {
        setEditingPost(post);
        setShowEditor(true);
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditingPost(null);
    };

    const savePost = async (payload) => {
        if (!currentUser || !userData) return;
        const isEdit = !!editingPost;
        const authorName = `${userData.firstName} ${userData.lastName}`;

        try {
            if (isEdit) {
                await updateDoc(doc(db, 'bulletinPosts', editingPost.id), {
                    title: payload.title,
                    content: payload.content,
                    priority: payload.priority,
                    isPinned: payload.isPinned,
                    updatedAt: new Date().toISOString(),
                    updatedBy: { uid: currentUser.uid, name: authorName }
                });
                logAction(db, currentUser.uid, authorName,
                    'BULLETIN_UPDATED', 'admin',
                    `Upravil příspěvek na nástěnce: „${payload.title}"`);
                showToastMsg('success', 'Příspěvek upraven.');
            } else {
                await addDoc(collection(db, 'bulletinPosts'), {
                    title: payload.title,
                    content: payload.content,
                    priority: payload.priority,
                    isPinned: payload.isPinned,
                    seenBy: [],
                    createdBy: { uid: currentUser.uid, name: authorName },
                    createdAt: new Date().toISOString()
                });
                logAction(db, currentUser.uid, authorName,
                    'BULLETIN_CREATED', 'admin',
                    `Přidal příspěvek na nástěnku: „${payload.title}"`);
                showToastMsg('success', 'Příspěvek přidán.');
            }
            closeEditor();
        } catch (err) {
            console.error('Error saving bulletin post:', err);
            showToastMsg('error', 'Chyba při ukládání.');
        }
    };

    const markAsSeen = async (postId) => {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, 'bulletinPosts', postId), {
                seenBy: arrayUnion(currentUser.uid)
            });
        } catch (err) {
            console.error('Error marking post as seen:', err);
        }
    };

    const requestDelete = (post) => {
        if (!canModifyPost(post)) return;
        setDeleteModal(post);
    };

    const confirmDelete = async () => {
        if (!deleteModal || !currentUser || !userData) return;
        const authorName = `${userData.firstName} ${userData.lastName}`;
        try {
            await deleteDoc(doc(db, 'bulletinPosts', deleteModal.id));
            logAction(db, currentUser.uid, authorName,
                'BULLETIN_DELETED', 'admin',
                `Smazal příspěvek z nástěnky: „${deleteModal.title}"`);
            showToastMsg('success', 'Příspěvek smazán.');
        } catch (err) {
            console.error('Error deleting bulletin post:', err);
            showToastMsg('error', 'Chyba při mazání.');
        }
        setDeleteModal(null);
    };

    const togglePin = async (post) => {
        if (!canDeleteAny) return;
        try {
            await updateDoc(doc(db, 'bulletinPosts', post.id), {
                isPinned: !post.isPinned
            });
        } catch (err) {
            console.error('Error toggling pin:', err);
        }
    };

    return {
        currentUser,
        userData,
        loading,
        posts,
        unseenPosts,
        canCreate,
        canDeleteAny,
        canModifyPost,
        showEditor,
        editingPost,
        openCreateEditor,
        openEditEditor,
        closeEditor,
        savePost,
        markAsSeen,
        deleteModal,
        setDeleteModal,
        requestDelete,
        confirmDelete,
        togglePin,
    };
}
