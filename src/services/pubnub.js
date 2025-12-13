// PubNub Service para tracking en tiempo real
// Latencia: ~50-100ms

import PubNub from 'pubnub';

// Configuración de PubNub
const PUBNUB_PUBLISH_KEY = 'pub-c-fc5150b8-3d41-4a94-a607-f4386b54b99d';
const PUBNUB_SUBSCRIBE_KEY = 'sub-c-b69d8600-06ee-4671-a8f4-aa2ae598ec9a';

// Canal para ubicaciones de conductores
const DRIVERS_CHANNEL = 'drivers-location';

class PubNubService {
    constructor() {
        this.pubnub = null;
        this.userId = null;
    }

    // Inicializar con el ID del usuario
    init(userId) {
        if (this.pubnub && this.userId === userId) {
            console.log('[PubNub] Ya inicializado');
            return;
        }

        this.userId = userId;
        this.pubnub = new PubNub({
            publishKey: PUBNUB_PUBLISH_KEY,
            subscribeKey: PUBNUB_SUBSCRIBE_KEY,
            userId: userId
        });

        console.log('[PubNub] ✅ Inicializado para usuario:', userId);
    }

    // Publicar ubicación del conductor
    async publishLocation(driverData) {
        if (!this.pubnub) {
            console.warn('[PubNub] No inicializado');
            return false;
        }

        try {
            const message = {
                type: 'location_update',
                driverId: driverData.id,
                name: driverData.name,
                status: driverData.status,
                location: driverData.location,
                vehicleInfo: driverData.vehicleInfo,
                phoneNumber: driverData.phoneNumber,
                rating: driverData.rating,
                photoURL: driverData.photoURL,
                timestamp: Date.now()
            };

            await this.pubnub.publish({
                channel: DRIVERS_CHANNEL,
                message: message
            });

            console.log('[PubNub] 📤 Ubicación publicada');
            return true;
        } catch (error) {
            console.error('[PubNub] ❌ Error publicando:', error);
            return false;
        }
    }

    // Suscribirse a actualizaciones de ubicación
    subscribe(onMessage) {
        if (!this.pubnub) {
            console.warn('[PubNub] No inicializado');
            return;
        }

        // Listener para mensajes
        this.pubnub.addListener({
            message: (event) => {
                if (event.channel === DRIVERS_CHANNEL) {
                    onMessage(event.message);
                }
            },
            status: (event) => {
                if (event.category === 'PNConnectedCategory') {
                    console.log('[PubNub] ✅ Conectado al canal');
                }
            }
        });

        // Suscribirse al canal
        this.pubnub.subscribe({
            channels: [DRIVERS_CHANNEL]
        });

        console.log('[PubNub] 📡 Suscrito a:', DRIVERS_CHANNEL);
    }

    // Desuscribirse
    unsubscribe() {
        if (this.pubnub) {
            this.pubnub.unsubscribe({
                channels: [DRIVERS_CHANNEL]
            });
            console.log('[PubNub] 👋 Desuscrito');
        }
    }

    // Publicar que el conductor está offline
    async publishOffline(driverId) {
        if (!this.pubnub) return;

        try {
            await this.pubnub.publish({
                channel: DRIVERS_CHANNEL,
                message: {
                    type: 'driver_offline',
                    driverId: driverId,
                    timestamp: Date.now()
                }
            });
            console.log('[PubNub] 🔴 Offline publicado');
        } catch (error) {
            console.error('[PubNub] Error:', error);
        }
    }
}

export const pubnubService = new PubNubService();
export default pubnubService;
