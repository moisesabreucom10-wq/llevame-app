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

    // Inicializar y registrar para push notifications
    async init(userId) {
        if (!Capacitor.isNativePlatform()) {
            console.log('[Push] No es plataforma nativa');
            return null;
        }

        if (this.initialized && this.token) {
            // Si ya está inicializado, solo actualizar el token en Firestore
            if (userId) await this.saveToken(userId, this.token);
            return this.token;
        }

        try {
            // Solicitar permisos de Push
            let permStatus = await PushNotifications.checkPermissions();

            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                console.warn('[Push] Permisos no otorgados');
                return null;
            }

            // Solicitar permisos de notificaciones locales también
            await LocalNotifications.requestPermissions();

            // Crear canales de notificación (Android)
            await this.createNotificationChannels();

            // Registrar listeners ANTES de register()
            this.setupListeners(userId);

            // Registrar para push notifications
            await PushNotifications.register();

            this.initialized = true;
            console.log('[Push] ✅ Inicializado, esperando token...');

            return this.token;
        } catch (error) {
            console.error('[Push] Error inicializando:', error);
            return null;
        }
    }

    // Crear canales de notificación para Android
    async createNotificationChannels() {
        try {
            await LocalNotifications.createChannel({
                id: 'trips',
                name: 'Viajes',
                description: 'Notificaciones de viajes',
                importance: 5, // MAX - muestra banner
                visibility: 1, // PUBLIC
                sound: 'default',
                vibration: true,
                lights: true
            });

            await LocalNotifications.createChannel({
                id: 'messages',
                name: 'Mensajes',
                description: 'Mensajes de chat',
                importance: 5, // MAX
                visibility: 1,
                sound: 'default',
                vibration: true
            });

            console.log('[Push] Canales creados con importancia MAX');
        } catch (error) {
            console.error('[Push] Error creando canales:', error);
        }
    }

    // Configurar listeners de push notifications
    setupListeners(userId) {
        // Cuando se recibe el token de registro
        PushNotifications.addListener('registration', async (token) => {
            console.log('[Push] 🔑 Token recibido:', token.value.substring(0, 20) + '...');
            this.token = token.value;

            if (userId) {
                await this.saveToken(userId, token.value);
            }
        });

        // Error de registro
        PushNotifications.addListener('registrationError', (error) => {
            console.error('[Push] ❌ Error de registro:', error);
        });

        // Notificación recibida (app en primer plano)
        // Mostrar notificación elegante in-app + notificación local del sistema
        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            console.log('[Push] 📬 Notificación recibida en primer plano:', notification);

            // Mostrar notificación elegante in-app (si está disponible)
            if (typeof window !== 'undefined' && window.showInAppNotification) {
                window.showInAppNotification(
                    notification.data?.type || 'general',
                    notification.title || 'LLEVAME',
                    notification.body || '',
                    notification.data
                );
            }

            // También mostrar notificación local del sistema para que aparezca el banner
            await this.showLocalNotification(
                notification.title || 'LLEVAME',
                notification.body || '',
                notification.data
            );
        });

        // Notificación tocada (usuario interactúa)
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[Push] 👆 Notificación tocada:', action);
            // Navegar según el tipo de notificación
            const data = action.notification.data;
            this.handleNotificationAction(data);
        });

        // Listener para cuando se toca una notificación local
        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
            console.log('[Push] 👆 Notificación local tocada:', action);
            const data = action.notification.extra;
            this.handleNotificationAction(data);
        });
    }

    // Mostrar notificación local (para cuando la app está en primer plano)
    async showLocalNotification(title, body, data = {}) {
        try {
            const channelId = data?.type === 'message' ? 'messages' : 'trips';

            await LocalNotifications.schedule({
                notifications: [{
                    id: Date.now(),
                    channelId: channelId,
                    title: title,
                    body: body,
                    smallIcon: 'ic_notification',
                    largeIcon: 'ic_launcher',
                    sound: 'default',
                    extra: data
                }]
            });

            console.log('[Push] 📢 Notificación local mostrada');
        } catch (error) {
            console.error('[Push] Error mostrando notificación local:', error);
        }
    }

    // Manejar acción cuando se toca la notificación
    handleNotificationAction(data) {
        if (!data) return;

        // Puedes emitir eventos personalizados aquí para navegar
        if (data.type === 'new_ride') {
            // Navegar a pantalla de aceptar viaje
            console.log('[Push] Navegando a nuevo viaje:', data.tripId);
        } else if (data.type === 'message') {
            // Abrir chat
            console.log('[Push] Abriendo chat:', data.tripId);
        } else if (data.type === 'driver_accepted') {
            console.log('[Push] Conductor aceptó viaje');
        }
    }

    // Guardar token en Firestore
    async saveToken(userId, token) {
        if (!userId || !token) return;

        try {
            const tokenRef = doc(db, 'user_tokens', userId);
            await setDoc(tokenRef, {
                token: token,
                platform: Capacitor.getPlatform(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            console.log('[Push] 💾 Token guardado en Firestore');
        } catch (error) {
            console.error('[Push] Error guardando token:', error);
        }
    }

    // Eliminar token (cuando el usuario hace logout)
    async removeToken(userId) {
        if (!userId) return;

        try {
            const tokenRef = doc(db, 'user_tokens', userId);
            await setDoc(tokenRef, {
                token: null,
                updatedAt: serverTimestamp()
            }, { merge: true });

            console.log('[Push] 🗑️ Token eliminado');
        } catch (error) {
            console.error('[Push] Error eliminando token:', error);
        }
    }

    // Obtener el token actual
    getToken() {
        return this.token;
    }
}

export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
