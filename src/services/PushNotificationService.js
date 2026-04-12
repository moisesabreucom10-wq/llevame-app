// Servicio de Push Notifications con Firebase Cloud Messaging
// Funciona incluso cuando la app está cerrada

import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

class PushNotificationService {
    constructor() {
        this.initialized = false;
        this.token = null;
    }

    async init(userId) {
        if (!Capacitor.isNativePlatform()) return null;

        if (this.initialized && this.token) {
            if (userId) await this.saveToken(userId, this.token);
            return this.token;
        }

        try {
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }
            if (permStatus.receive !== 'granted') {
                console.warn('[Push] Permisos no otorgados');
                return null;
            }

            await LocalNotifications.requestPermissions();
            await this.createNotificationChannels();
            this.setupListeners(userId);
            await PushNotifications.register();
            this.initialized = true;
            return this.token;
        } catch (error) {
            console.error('[Push] Error inicializando:', error);
            return null;
        }
    }

    async createNotificationChannels() {
        try {
            await LocalNotifications.createChannel({
                id: 'trips',
                name: 'Viajes',
                description: 'Notificaciones de viajes',
                importance: 5,
                visibility: 1,
                sound: 'default',
                vibration: true,
                lights: true
            });
            await LocalNotifications.createChannel({
                id: 'messages',
                name: 'Mensajes',
                description: 'Mensajes de chat',
                importance: 5,
                visibility: 1,
                sound: 'default',
                vibration: true
            });
        } catch (error) {
            console.error('[Push] Error creando canales:', error);
        }
    }

    setupListeners(userId) {
        PushNotifications.addListener('registration', async (token) => {
            this.token = token.value;
            if (userId) await this.saveToken(userId, token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
            console.error('[Push] Error de registro:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            if (typeof window !== 'undefined' && window.showInAppNotification) {
                window.showInAppNotification(
                    notification.data?.type || 'general',
                    notification.title || 'LLEVAME',
                    notification.body || '',
                    notification.data
                );
            }
            await this.showLocalNotification(
                notification.title || 'LLEVAME',
                notification.body || '',
                notification.data
            );
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            this.handleNotificationAction(action.notification.data);
        });

        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
            this.handleNotificationAction(action.notification.extra);
        });
    }

    async showLocalNotification(title, body, data = {}) {
        try {
            const channelId = data?.type === 'message' ? 'messages' : 'trips';
            await LocalNotifications.schedule({
                notifications: [{
                    id: Date.now(),
                    channelId,
                    title,
                    body,
                    smallIcon: 'ic_notification',
                    largeIcon: 'ic_launcher',
                    sound: 'default',
                    extra: data
                }]
            });
        } catch (error) {
            console.error('[Push] Error mostrando notificación local:', error);
        }
    }

    handleNotificationAction(data) {
        if (!data) return;
        // Reserved for future navigation logic (new_ride, message, driver_accepted)
    }

    async saveToken(userId, token) {
        if (!userId || !token) return;
        try {
            const tokenRef = doc(db, 'user_tokens', userId);
            await setDoc(tokenRef, {
                token,
                platform: Capacitor.getPlatform(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error('[Push] Error guardando token:', error);
        }
    }

    async removeToken(userId) {
        if (!userId) return;
        try {
            const tokenRef = doc(db, 'user_tokens', userId);
            await setDoc(tokenRef, { token: null, updatedAt: serverTimestamp() }, { merge: true });
        } catch (error) {
            console.error('[Push] Error eliminando token:', error);
        }
    }

    getToken() { return this.token; }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
