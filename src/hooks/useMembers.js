import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const ROLE_LABELS = {
    'VJ': 'Velitel jednotky',
    'Zástupce VJ': 'Zástupce VJ',
    'VD': 'Velitel družstva',
    'Strojník': 'Strojník',
    'Hasič': 'Hasič',
    'Admin': 'Administrátor'
};

export default function useMembers() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => {
        const q = query(collection(db, 'users'), where('approved', '==', true));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const membersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            membersData.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));
            setMembers(membersData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching members:', error);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Filter members based on search and role
    const filteredMembers = members.filter(member => {
        const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
        const matchesSearch = fullName.includes(searchTerm.toLowerCase());

        if (roleFilter === 'all') return matchesSearch;

        const roles = member.roles || [member.role || 'Hasič'];
        const normalizedRoles = Array.isArray(roles)
            ? roles.map(r => r.toString().toLowerCase())
            : Object.keys(roles).filter(k => roles[k]).map(r => r.toLowerCase());

        return matchesSearch && normalizedRoles.includes(roleFilter.toLowerCase());
    });

    const allRoles = ['VJ', 'Zástupce VJ', 'VD', 'Strojník', 'Hasič'];

    return {
        loading,
        searchTerm,
        setSearchTerm,
        roleFilter,
        setRoleFilter,
        filteredMembers,
        allRoles,
        roleLabels: ROLE_LABELS
    };
}
