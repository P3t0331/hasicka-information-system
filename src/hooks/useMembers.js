import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function useMembers() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('approved', '==', true));
            const snapshot = await getDocs(q);

            const membersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by last name
            membersData.sort((a, b) =>
                (a.lastName || '').localeCompare(b.lastName || '')
            );

            setMembers(membersData);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

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
    const roleLabels = {
        'VJ': 'Velitel jednotky',
        'Zástupce VJ': 'Zástupce VJ',
        'VD': 'Velitel družstva',
        'Strojník': 'Strojník',
        'Hasič': 'Hasič',
        'Admin': 'Administrátor'
    };

    return {
        loading,
        searchTerm,
        setSearchTerm,
        roleFilter,
        setRoleFilter,
        filteredMembers,
        allRoles,
        roleLabels
    };
}
