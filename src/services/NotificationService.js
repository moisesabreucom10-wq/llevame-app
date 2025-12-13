// Servicio de Notificaciones Locales
// Maneja notificaciones para viajes, mensajes y nuevas solicitudes

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

class NotificationService {
    constructor() {
        this.initialized = false;
        this.channelCreated = false;
    }

    // Inicializar permisos y canales
    async init() {
        if (this.initialized) return true;

        try {
            // Verificar si estamos en dispositivo nativo
            if (!Capacitor.isNativePlatform()) {
                console.log('[Notify] No es plataforma nativa, saltando inicialización');
                return false;
            }

            // Solicitar permisos
            const permission = await LocalNotifications.requestPermissions();
            if (permission.display !== 'granted') {
                console.warn('[Notify] Permisos no otorgados');
                return false;
            }

            // Crear canales de notificación (Android)
            await this.createChannels();

            // Registrar listeners
            this.registerListeners();

            this.initialized = true;
            console.log('[Notify] ✅ Inicializado correctamente');
            return true;
        } catch (error) {
            console.error('[Notify] Error inicializando:', error);
            return false;
        }
    }

    // Crear canales de notificación para Android
    async createChannels() {
        if (this.channelCreated) return;

        try {
            await LocalNotifications.createChannel({
                id: 'trips',
                name: 'Viajes',
                description: 'Notificaciones de viajes y solicitudes',
                importance: 5, // HIGH
                visibility: 1, // PUBLIC
                sound: 'default',
                vibration: true
            });

            await LocalNotifications.createChannel({
                id: 'messages',
                name: 'Mensajes',
                description: 'Mensajes de conductores y pasajeros',
                importance: 4, // DEFAULT
                visibility: 1,
                sound: 'default',
                vibration: true
            });

            await LocalNotifications.createChannel({
                id: 'general',
                name: 'General',
                description: 'Notificaciones generales',
                importance: 3, // DEFAULT
                visibility: 1
            });

            this.channelCreated = true;
            console.log('[Notify] Canales creados');
        } catch (error) {
            console.error('[Notify] Error creando canales:', error);
        }
    }

    // Registrar listeners para cuando se toca la notificación
    registerListeners() {
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            console.log('[Notify] Notificación tocada:', notification);
            // Aquí puedes navegar a una pantalla específica según el tipo
            const data = notification.notification.extra;
            if (data?.type === 'new_ride') {
                // Navegar a la pantalla de aceptar viaje
            } else if (data?.type === 'message') {
                // Abrir chat
            }
        });
    }

    // ========== NOTIFICACIONES ESPECÍFICAS ==========

    // 🆕 Nuevo viaje disponible (para conductores)
    async notifyNewRide(pickup, fare, passengerName) {
        await this.init();

        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'trips',
                title: '🚗 ¡Nuevo viaje disponible!',
                body: `${passengerName || 'Pasajero'} solicita viaje • $${fare}`,
                largeBody: `Recogida: ${pickup}\nTarifa: $${fare}`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                sound: 'default',
                extra: { type: 'new_ride', pickup, fare }
            }]
        });

        console.log('[Notify] 📢 Nuevo viaje notificado');
        return id;
    }

    // ✅ Viaje finalizado
    async notifyTripCompleted(fare, driverName) {
        await this.init();

        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'trips',
                title: '✅ ¡Viaje completado!',
                body: `Gracias por viajar con ${driverName || 'nosotros'}`,
                largeBody: `Tu viaje ha finalizado.\nTotal: $${fare}\n\n¡Gracias por usar LLEVAME!`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { type: 'trip_completed', fare }
            }]
        });

        console.log('[Notify] ✅ Viaje completado notificado');
        return id;
    }

    // 💬 Nuevo mensaje
    async notifyNewMessage(senderName, messagePreview, isDriver = false) {
        await this.init();

        const id = Date.now();
        const title = isDriver
            ? `🚗 Mensaje de ${senderName}`
            : `👤 Mensaje de ${senderName}`;

        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'messages',
                title: title,
                body: messagePreview.substring(0, 100),
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                sound: 'default',
                extra: { type: 'message', senderName }
            }]
        });

        console.log('[Notify] 💬 Mensaje notificado de:', senderName);
        return id;
    }

    // 🚗 Conductor aceptó el viaje
    async notifyDriverAccepted(driverName, vehicleInfo) {
        await this.init();

        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'trips',
                title: '🎉 ¡Conductor en camino!',
                body: `${driverName} va en camino a recogerte`,
                largeBody: `${driverName} aceptó tu viaje.\n${vehicleInfo || ''}\n\nPrepárate, llegará pronto.`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                sound: 'default',
                extra: { type: 'driver_accepted', driverName }
            }]
        });

        console.log('[Notify] 🚗 Conductor aceptó notificado');
        return id;
    }

    // 🚗 Conductor llegó
    async notifyDriverArrived(driverName) {
        await this.init();

        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'trips',
                title: '📍 ¡Tu conductor llegó!',
                body: `${driverName} está esperándote`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                sound: 'default',
                extra: { type: 'driver_arrived', driverName }
            }]
        });

        console.log('[Notify] 📍 Conductor llegó notificado');
        return id;
    }

    // ❌ Viaje cancelado
    async notifyTripCancelled(reason) {
        await this.init();

        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'trips',
                title: '❌ Viaje cancelado',
                body: reason || 'El viaje ha sido cancelado',
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { type: 'trip_cancelled' }
            }]
        });

        console.log('[Notify] ❌ Viaje cancelado notificado');
        return id;
    }

    // 📦 Paquete entregado
    async notifyPackageDelivered(destination) {
        await this.init();

        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id: id,
                channelId: 'trips',
                title: '📦 ¡Paquete entregado!',
                body: `Tu paquete llegó a su destino`,
                largeBody: `El paquete fue entregado en:\n${destination}`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { type: 'package_delivered' }
            }]
        });

        console.log('[Notify] 📦 Paquete entregado notificado');
        return id;
    }

    // Cancelar una notificación específica
    async cancel(notificationId) {
        try {
            await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        } catch (error) {
            console.error('[Notify] Error cancelando:', error);
        }
    }

    // Cancelar todas las notificaciones
    async cancelAll() {
        try {
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
                await LocalNotifications.cancel(pending);
            }
        } catch (error) {
            console.error('[Notify] Error cancelando todas:', error);
        }
    }
}

export const notificationService = new NotificationService();
export default notificationService;
