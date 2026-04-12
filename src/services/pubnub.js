// PubNub Service para tracking en tiempo real
// Latencia: ~50-100ms

import PubNub from 'pubnub';

const PUBNUB_PUBLISH_KEY = 'pub-c-fc5150b8-3d41-4a94-a607-f4386b54b99d';
const PUBNUB_SUBSCRIBE_KEY = 'sub-c-b69d8600-06ee-4671-a8f4-aa2ae598ec9a';

const DRIVERS_CHANNEL = 'drivers-location';

class PubNubService {
    constructor() {
        this.pubnub = null;
        this.userId = null;
    }

    init(userId) {
        if (this.pubnub && this.userId === userId) return;

        this.userId = userId;
        this.pubnub = new PubNub({
            publishKey: PUBNUB_PUBLISH_KEY,
            subscribeKey: PUBNUB_SUBSCRIBE_KEY,
            userId: userId
        });
    }

    async publishLocation(driverData) {
        if (!this.pubnub) {
            console.warn('[PubNub] No inicializado');
            return false;
        }

        try {
            await this.pubnub.publish({
                channel: DRIVERS_CHANNEL,
                message: {
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
                }
            });
            return true;
        } catch (error) {
            console.error('[PubNub] Error publicando:', error);
            return false;
        }
    }

    subscribe(onMessage) {
        if (!this.pubnub) {
            console.warn('[PubNub] No inicializado');
            return;
        }

        this.pubnub.addListener({
            message: (event) => {
                if (event.channel === DRIVERS_CHANNEL) {
                    onMessage(event.message);
                }
            }
        });

        this.pubnub.subscribe({ channels: [DRIVERS_CHANNEL] });
    }

    unsubscribe() {
        if (this.pubnub) {
            this.pubnub.unsubscribe({ channels: [DRIVERS_CHANNEL] });
        }
    }

    async publishOffline(driverId) {
        if (!this.pubnub) return;
        try {
            await this.pubnub.publish({
                channel: DRIVERS_CHANNEL,
                message: { type: 'driver_offline', driverId, timestamp: Date.now() }
            });
        } catch (error) {
            console.error('[PubNub] Error publicando offline:', error);
        }
    }
}

export const pubnubService = new PubNubService();
export default pubnubService;
