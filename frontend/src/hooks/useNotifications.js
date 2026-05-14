import { useEffect } from 'react';
import { messaging, getToken, onMessage } from '../firebase';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

export function useNotifications(profile) {
  useEffect(() => {
    if (!profile || !messaging) return;

    async function requestPermission() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging, {
          vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
        });

        if (token) {
          await authApi.registerFcm(token);
        }
      } catch (err) {
        console.warn('FCM registration failed:', err.message);
      }
    }

    requestPermission();

    const unsub = onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      toast(`${title}: ${body}`, { icon: '⚠️', duration: 8000 });
    });

    return unsub;
  }, [profile]);
}
