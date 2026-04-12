// BackgroundLocationService.js
// Tracking en tiempo real con PubNub (latencia ~50-100ms) + Firestore (respaldo)

import { registerPlugin } from '@capacitor/core';
import { db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { pubnubService } from './pubnub';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

class BackgroundLocationService {
    constructor() {
        this.watcherId = null;
        this.onLocationUpdate = null;
        this.driverInfo = null;
        this.updateCount = 0;
    }

    setDriverInfo(info) {
        this.driverInfo = info;
        if (info?.uid) {
            pubnubService.init(info.uid);
        }
    }

    async publishToPubNub(location) {
        if (!this.driverInfo?.uid) return false;

        return await pubnubService.publishLocation({
            id: this.driverInfo.uid,
            name: this.driverInfo.name || 'Conductor',
            status: this.driverInfo.currentTrip ? 'in_trip' : 'online',
            location: location,
            vehicleInfo: {
                model: this.driverInfo.vehicleInfo?.model || 'Vehículo',
                color: this.driverInfo.vehicleInfo?.color || 'Blanco',
                plate: this.driverInfo.vehicleInfo?.plate || '---',
                type: this.driverInfo.vehicleInfo?.type || 'carro'
            },
            phoneNumber: this.driverInfo.phoneNumber || '',
            rating: this.driverInfo.rating || 5.0,
            photoURL: this.driverInfo.photoURL || null
        });
    }

    async saveToFirestore(location) {
        if (!this.driverInfo?.uid) return false;

        try {
            const driverRef = doc(db, 'online_drivers', this.driverInfo.uid);
            await setDoc(driverRef, {
                driverId: this.driverInfo.uid,
                name: this.driverInfo.name || 'Conductor',
                status: this.driverInfo.currentTrip ? 'in_trip' : 'online',
                location: location,
                vehicleInfo: {
                    model: this.driverInfo.vehicleInfo?.model || 'Vehículo',
                    color: this.driverInfo.vehicleInfo?.color || 'Blanco',
                    plate: this.driverInfo.vehicleInfo?.plate || '---',
                    type: this.driverInfo.vehicleInfo?.type || 'carro'
                },
                phoneNumber: this.driverInfo.phoneNumber || '',
                rating: this.driverInfo.rating || 5.0,
                photoURL: this.driverInfo.photoURL || null,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error('[BGL] Firestore error:', error.message);
            return false;
        }
    }

    async setOffline() {
        if (!this.driverInfo?.uid) return;

        await pubnubService.publishOffline(this.driverInfo.uid);

        try {
            const driverRef = doc(db, 'online_drivers', this.driverInfo.uid);
            await setDoc(driverRef, { status: 'offline', updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) { }
    }

    async startBackgroundTracking(callback, driverInfo = null) {
        if (this.watcherId !== null) {
            if (driverInfo) this.setDriverInfo(driverInfo);
            return this.watcherId;
        }

        this.onLocationUpdate = callback;
        this.updateCount = 0;
        if (driverInfo) this.setDriverInfo(driverInfo);

        try {
            this.watcherId = await BackgroundGeolocation.addWatcher(
                {
                    backgroundMessage: "LLEVAME - Conectando pasajeros",
                    backgroundTitle: "🟢 Conductor Activo",
                    requestPermissions: true,
                    stale: false,
                    distanceFilter: 3 // Cada 3 metros
                },
                async (location, error) => {
                    if (error) {
                        console.error('[BGL] Error:', error.code);
                        if (error.code === "NOT_AUTHORIZED") {
                            BackgroundGeolocation.openSettings();
                        }
                        return;
                    }

                    if (location) {
                        const loc = {
                            lat: location.latitude,
                            lng: location.longitude,
                            heading: location.bearing || null,
                            speed: location.speed || null,
                            accuracy: location.accuracy
                        };

                        // 1. PUBNUB: Tiempo real (~50ms) — cada actualización
                        await this.publishToPubNub(loc);

                        // 2. FIRESTORE: Cada 5 actualizaciones (respaldo)
                        this.updateCount++;
                        if (this.updateCount % 5 === 0) {
                            await this.saveToFirestore(loc);
                        }

                        try { this.onLocationUpdate?.(loc); } catch (e) { }
                    }
                }
            );

            return this.watcherId;

        } catch (error) {
            console.error('[BGL] Error iniciando tracking:', error);
            this.watcherId = null;
            throw error;
        }
    }

    async stopBackgroundTracking() {
        if (this.watcherId === null) return;
        try {
            await this.setOffline();
            await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
        } catch (error) {
            console.error('[BGL] Error deteniendo tracking:', error);
        } finally {
            this.watcherId = null;
            this.onLocationUpdate = null;
        }
    }

    isActive() { return this.watcherId !== null; }
    updateTripStatus(hasTrip) { if (this.driverInfo) this.driverInfo.currentTrip = hasTrip; }
}

const backgroundLocationService = new BackgroundLocationService();
export { backgroundLocationService, BackgroundGeolocation };
export default backgroundLocationService;
