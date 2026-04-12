// Servicio de Notificaciones Locales
// Maneja notificaciones para viajes, mensajes y nuevas solicitudes

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

class NotificationService {
    constructor() {
        this.initialized = false;
        this.channelCreated = false;
    }

    async init() {
        if (this.initialized) return true;

        if (!Capacitor.isNativePlatform()) return false;

        try {
            const permission = await LocalNotifications.requestPermissions();
            if (permission.display !== 'granted') {
                console.warn('[Notify] Permisos no otorgados');
                return false;
            }

            await this.createChannels();
            this.registerListeners();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('[Notify] Error inicializando:', error);
            return false;
        }
    }

    async createChannels() {
        if (this.channelCreated) return;

        try {
            await LocalNotifications.createChannel({
                id: 'trips',
                name: 'Viajes',
                description: 'Notificaciones de viajes y solicitudes',
                importance: 5,
                visibility: 1,
                sound: 'default',
                vibration: true
            });

            await LocalNotifications.createChannel({
                id: 'messages',
                name: 'Mensajes',
                description: 'Mensajes de conductores y pasajeros',
                importance: 4,
                visibility: 1,
                sound: 'default',
                vibration: true
            });

            await LocalNotifications.createChannel({
                id: 'general',
                name: 'General',
                description: 'Notificaciones generales',
                importance: 3,
                visibility: 1
            });

            this.channelCreated = true;
        } catch (error) {
            console.error('[Notify] Error creando canales:', error);
        }
    }

    registerListeners() {
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            const data = notification.notification.extra;
            if (data?.type === 'new_ride') {
                // Navegar a la pantalla de aceptar viaje
            } else if (data?.type === 'message') {
                // Abrir chat
            }
        });
    }

    async notifyNewRide(pickup, fare, passengerName) {
        await this.init();
        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id,
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
        return id;
    }

    async notifyTripCompleted(fare, driverName) {
        await this.init();
        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id,
                channelId: 'trips',
                title: '✅ ¡Viaje completado!',
                body: `Gracias por viajar con ${driverName || 'nosotros'}`,
                largeBody: `Tu viaje ha finalizado.\nTotal: $${fare}\n\n¡Gracias por usar LLEVAME!`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { type: 'trip_completed', fare }
            }]
        });
        return id;
    }

    async notifyNewMessage(senderName, messagePreview, isDriver = false) {
        await this.init();
        const id = Date.now();
        const title = isDriver ? `🚗 Mensaje de ${senderName}` : `👤 Mensaje de ${senderName}`;
        await LocalNotifications.schedule({
            notifications: [{
                id,
                channelId: 'messages',
                title,
                body: messagePreview.substring(0, 100),
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                sound: 'default',
                extra: { type: 'message', senderName }
            }]
        });
        return id;
    }

    async notifyDriverAccepted(driverName, vehicleInfo) {
        await this.init();
        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id,
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
        return id;
    }

    async notifyDriverArrived(driverName) {
        await this.init();
        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id,
                channelId: 'trips',
                title: '📍 ¡Tu conductor llegó!',
                body: `${driverName} está esperándote`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                sound: 'default',
                extra: { type: 'driver_arrived', driverName }
            }]
        });
        return id;
    }

    async notifyTripCancelled(reason) {
        await this.init();
        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id,
                channelId: 'trips',
                title: '❌ Viaje cancelado',
                body: reason || 'El viaje ha sido cancelado',
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { type: 'trip_cancelled' }
            }]
        });
        return id;
    }

    async notifyPackageDelivered(destination) {
        await this.init();
        const id = Date.now();
        await LocalNotifications.schedule({
            notifications: [{
                id,
                channelId: 'trips',
                title: '📦 ¡Paquete entregado!',
                body: 'Tu paquete llegó a su destino',
                largeBody: `El paquete fue entregado en:\n${destination}`,
                smallIcon: 'ic_notification',
                largeIcon: 'ic_launcher',
                extra: { type: 'package_delivered' }
            }]
        });
        return id;
    }

    async cancel(notificationId) {
        try {
            await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
        } catch (error) {
            console.error('[Notify] Error cancelando:', error);
        }
    }

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
