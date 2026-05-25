import { useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from([...atob(base64)].map((c) => c.charCodeAt(0)));
}

async function subscribe(userId) {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
        });
        await setDoc(doc(db, 'pushSubscriptions', userId), { subscription: sub.toJSON() });
    } catch (err) {
        console.error('Push subscription failed:', err);
    }
}

export function usePushNotifications() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (Notification.permission !== 'default') return;
        const t = setTimeout(() => subscribe(user.uid), 4000);
        return () => clearTimeout(t);
    }, [user]);
}
