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
        // Inicializar PubNub con el ID del conductor
        if (info?.uid) {
            pubnubService.init(info.uid);
        }
        console.log('[BGL] 👤 Driver:', info?.name);
    }

    // Publicar a PubNub (tiempo real ~50ms)
    async publishToPubNub(location) {
        if (!this.driverInfo?.uid) return false;

        const data = {
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
        };

        return await pubnubService.publishLocation(data);
    }

    // Guardar en Firestore (respaldo y persistencia)
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

        // Notificar offline via PubNub
        await pubnubService.publishOffline(this.driverInfo.uid);

        // También en Firestore
        try {
            const driverRef = doc(db, 'online_drivers', this.driverInfo.uid);
            await setDoc(driverRef, { status: 'offline', updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) { }

        console.log('[BGL] 🔴 Offline');
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
            console.log('[BGL] 🚀 Iniciando tracking con PubNub...');

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
                        console.error('[BGL] ❌', error.code);
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

                        // 1. PUBNUB: Tiempo real (~50ms) - cada actualización
                        await this.publishToPubNub(loc);

                        // 2. FIRESTORE: Cada 5 actualizaciones (respaldo)
                        this.updateCount++;
                        if (this.updateCount % 5 === 0) {
                            await this.saveToFirestore(loc);
                            console.log(`[BGL] ✅ ${this.updateCount} updates (PubNub + Firestore)`);
                        }

                        // Callback React
                        try { this.onLocationUpdate?.(loc); } catch (e) { }
                    }
                }
            );

            console.log('[BGL] ✅ Activo con PubNub, ID:', this.watcherId);
            return this.watcherId;

        } catch (error) {
            console.error('[BGL] ❌', error);
            this.watcherId = null;
            throw error;
        }
    }

    async stopBackgroundTracking() {
        if (this.watcherId === null) return;
        try {
            await this.setOffline();
            await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
            this.watcherId = null;
            this.onLocationUpdate = null;
            console.log('[BGL] ⏹️ Detenido');
        } catch (error) {
            this.watcherId = null;
        }
    }

    isActive() { return this.watcherId !== null; }
    updateTripStatus(hasTrip) { if (this.driverInfo) this.driverInfo.currentTrip = hasTrip; }
}

const backgroundLocationService = new BackgroundLocationService();
export { backgroundLocationService, BackgroundGeolocation };
export default backgroundLocationService;
