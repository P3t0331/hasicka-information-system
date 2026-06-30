import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function useSuggestions() {
    const { currentUser, userData } = useAuth();
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'suggestions'), (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => {
                const statusOrder = { open: 0, planned: 1, done: 2, rejected: 3 };
                const sa = statusOrder[a.status] ?? 0;
                const sb = statusOrder[b.status] ?? 0;
                if (sa !== sb) return sa - sb;
                const netA = (a.yesVotes?.length || 0) - (a.noVotes?.length || 0);
                const netB = (b.yesVotes?.length || 0) - (b.noVotes?.length || 0);
                if (netB !== netA) return netB - netA;
                const ta = a.createdAt?.seconds || 0;
                const tb = b.createdAt?.seconds || 0;
                return tb - ta;
            });
            setSuggestions(data);
            setLoading(false);
        }, () => setLoading(false));
        return unsubscribe;
    }, []);

    const createSuggestion = async (title, description) => {
        const authorName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
        await addDoc(collection(db, 'suggestions'), {
            title: title.trim(),
            description: description.trim(),
            authorUid: currentUser.uid,
            authorName,
            createdAt: serverTimestamp(),
            status: 'open',
            yesVotes: [],
            noVotes: [],
            adminNote: '',
        });
    };

    const vote = async (id, voteType) => {
        const ref = doc(db, 'suggestions', id);
        const suggestion = suggestions.find(s => s.id === id);
        if (!suggestion) return;
        const uid = currentUser.uid;
        const hasVotedYes = suggestion.yesVotes?.includes(uid);
        const hasVotedNo = suggestion.noVotes?.includes(uid);

        if (voteType === 'yes') {
            if (hasVotedYes) {
                await updateDoc(ref, { yesVotes: arrayRemove(uid) });
            } else {
                const updates = { yesVotes: arrayUnion(uid) };
                if (hasVotedNo) updates.noVotes = arrayRemove(uid);
                await updateDoc(ref, updates);
            }
        } else {
            if (hasVotedNo) {
                await updateDoc(ref, { noVotes: arrayRemove(uid) });
            } else {
                const updates = { noVotes: arrayUnion(uid) };
                if (hasVotedYes) updates.yesVotes = arrayRemove(uid);
                await updateDoc(ref, updates);
            }
        }
    };

    const updateSuggestion = async (id, { status, adminNote }) => {
        await updateDoc(doc(db, 'suggestions', id), { status, adminNote: adminNote ?? '' });
    };

    const deleteSuggestion = async (id) => {
        await deleteDoc(doc(db, 'suggestions', id));
    };

    return { suggestions, loading, createSuggestion, vote, updateSuggestion, deleteSuggestion };
}
