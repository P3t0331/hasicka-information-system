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
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        let permission = Notification.permission;
        if (permission === 'denied') return;

        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') return;

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
            console.warn('VITE_VAPID_PUBLIC_KEY not set');
            return;
        }

        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        // Use endpoint hash as device key so each device gets its own document
        const endpointKey = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-32);
        const docId = `${userId}_${endpointKey}`;
        await setDoc(doc(db, 'pushSubscriptions', docId), {
            subscription: sub.toJSON(),
            userId,
            updatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Push subscription failed:', err);
    }
}

export function usePushNotifications() {
    const { currentUser } = useAuth();

    useEffect(() => {
        if (!currentUser) return;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (Notification.permission === 'denied') return;
        const t = setTimeout(() => subscribe(currentUser.uid), 4000);
        return () => clearTimeout(t);
    }, [currentUser]);
}
