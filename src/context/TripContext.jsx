import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    increment,
    setDoc,
    getDoc
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useLocation } from './LocationContext';
import { notificationService } from '../services/NotificationService';

const TripContext = createContext();

export const useTrip = () => useContext(TripContext);

export const TripProvider = ({ children }) => {
    const { currentUser, userProfile } = useAuth();
    const { currentLocation, startBackgroundTracking, stopBackgroundTracking } = useLocation();
    const [currentTrip, setCurrentTrip] = useState(null);
    const [nearbyTrips, setNearbyTrips] = useState([]); // For drivers
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Driver Online State (Global)
    const [isDriverOnline, setIsDriverOnline] = useState(() => {
        try {
            return localStorage.getItem('llevame_driver_online') === 'true';
        } catch (e) { return false; }
    });

    // Persist Online State
    useEffect(() => {
        try {
            localStorage.setItem('llevame_driver_online', isDriverOnline);
        } catch (e) { }
    }, [isDriverOnline]);

    // BACKGROUND TRACKING: Activar/desactivar según estado del conductor
    useEffect(() => {
        if (!currentUser || userProfile?.userType !== 'driver') {
            return;
        }

        const activateBackgroundTracking = async () => {
            console.log('[TripContext] 🔔 Activando background tracking...');

            // Solicitar permiso de notificaciones (requerido en Android 13+)
            try {
                const { LocalNotifications } = await import('@capacitor/local-notifications');
                const permStatus = await LocalNotifications.checkPermissions();
                console.log('[TripContext] 📋 Estado permisos notificaciones:', permStatus.display);

                if (permStatus.display !== 'granted') {
                    console.log('[TripContext] 🔔 Solicitando permisos de notificación...');
                    const result = await LocalNotifications.requestPermissions();
                    console.log('[TripContext] 📋 Resultado permisos:', result.display);
                }
            } catch (e) {
                console.warn('[TripContext] ⚠️ No se pudo verificar permisos de notificación:', e);
            }

            // Preparar info del conductor para el servicio de background
            const driverInfo = {
                uid: currentUser.uid,
                name: userProfile?.name || 'Conductor',
                vehicleInfo: userProfile?.vehicleInfo || { model: 'Vehículo', color: 'Blanco', plate: '---' },
                phoneNumber: userProfile?.phoneNumber || '',
                rating: userProfile?.rating || 5.0,
                photoURL: userProfile?.photoURL || null,
                currentTrip: !!currentTrip
            };

            // Activar el background tracking CON la info del conductor
            try {
                // Importar el servicio directamente para pasar driverInfo
                const { default: backgroundLocationService } = await import('../services/BackgroundLocationService');

                await backgroundLocationService.startBackgroundTracking(
                    (newLocation) => {
                        // Este callback actualiza React state (cuando la app está en primer plano)
                        console.log('[TripContext] 📍 Location callback recibido');
                    },
                    driverInfo // Pasar toda la info del conductor
                );

                console.log('[TripContext] ✅ Background tracking activado con Firebase directo');
            } catch (err) {
                console.warn('[TripContext] ⚠️ Background tracking no disponible:', err);
                // Fallback: intentar con el método del contexto
                try {
                    await startBackgroundTracking?.();
                } catch (e) {
                    console.error('[TripContext] ❌ Fallback también falló:', e);
                }
            }
        };

        if (isDriverOnline) {
            activateBackgroundTracking();
        } else {
            // Conductor offline -> desactivar background tracking
            console.log('[TripContext] 🔕 Desactivando background tracking...');
            import('../services/BackgroundLocationService').then(({ default: service }) => {
                service.stopBackgroundTracking()
                    .then(() => console.log('[TripContext] ✅ Background tracking desactivado'))
                    .catch(err => console.warn('[TripContext] ⚠️ Error desactivando:', err));
            });
        }

        return () => {
            // Limpiar al desmontar
            import('../services/BackgroundLocationService').then(({ default: service }) => {
                service.stopBackgroundTracking().catch(() => { });
            });
        };
    }, [isDriverOnline, currentUser, userProfile, currentTrip, startBackgroundTracking]);

    // Actualizar estado del viaje en el servicio de background cuando cambia
    useEffect(() => {
        if (isDriverOnline && currentUser && userProfile?.userType === 'driver') {
            import('../services/BackgroundLocationService').then(({ default: service }) => {
                service.updateTripStatus(!!currentTrip);
            });
        }
    }, [currentTrip, isDriverOnline, currentUser, userProfile?.userType]);

    // Listen for active trip for the current user
    useEffect(() => {
        if (!currentUser) {
            console.log('[TripContext] No currentUser, skipping trip listener');
            return;
        }

        // Wait for profile to load userType
        if (!userProfile) {
            console.log('[TripContext] No userProfile yet, waiting...');
            return;
        }

        if (!db) {
            console.error("Firestore 'db' not initialized in TripContext");
            return;
        }

        console.log('[TripContext] Setting up listener for:', currentUser.uid, 'Type:', userProfile.userType);

        let q;
        if (userProfile.userType === 'rider') {
            q = query(
                collection(db, 'llevame_trips'),
                where('riderId', '==', currentUser.uid),
                where('status', 'in', ['requested', 'accepted', 'in_progress']),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
        } else if (userProfile.userType === 'driver') {
            q = query(
                collection(db, 'llevame_trips'),
                where('driverId', '==', currentUser.uid),
                where('status', 'in', ['accepted', 'in_progress']),
                // orderBy('acceptedAt', 'desc'), // REMOVED to avoid index requirement errors
                limit(1)
            );
        } else {
            console.warn('[TripContext] Unknown userType:', userProfile.userType);
        }

        if (!q) return;

        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('[TripContext] Snapshot update. Docs found:', snapshot.size);
            if (!snapshot.empty) {
                const tripDoc = snapshot.docs[0];
                const tripData = { id: tripDoc.id, ...tripDoc.data() };
                console.log('[TripContext] Setting currentTrip:', tripData.status, tripData.id);
                setCurrentTrip(tripData);
            } else {
                console.log('[TripContext] No active trip found.');
                setCurrentTrip(null);
            }
        }, (err) => {
            console.error("[TripContext] Error listening to trip:", err);
        });

        return () => unsubscribe();
    }, [currentUser, userProfile]);

    // Driver: Listen for nearby requested trips
    useEffect(() => {
        if (!currentUser || userProfile?.userType !== 'driver') return;
        if (!db) return;

        let previousTripCount = 0;

        // In a real app, we'd use GeoFire or similar for radius query.
        // For MVP, we'll listen to all 'requested' trips.
        const q = query(
            collection(db, 'llevame_trips'),
            where('status', '==', 'requested'),
            // orderBy('createdAt', 'desc'), // Commented out to avoid index requirement for now
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // NOTIFICACIÓN: Si hay más viajes que antes, es uno nuevo
            if (trips.length > previousTripCount && previousTripCount > 0) {
                const newTrip = trips[0]; // El más reciente
                notificationService.notifyNewRide(
                    newTrip.pickup?.address || 'Ubicación',
                    newTrip.fare,
                    newTrip.riderName || 'Pasajero'
                );
            }
            previousTripCount = trips.length;

            setNearbyTrips(trips);
        });

        return () => unsubscribe();
    }, [currentUser, userProfile]);

    // Driver: Broadcast location to 'online_drivers' logic
    useEffect(() => {
        // Debug info - SIEMPRE mostrar para depuración
        console.log('[TripContext] 🔍 Broadcast Check:', {
            hasUser: !!currentUser,
            uid: currentUser?.uid,
            userType: userProfile?.userType,
            isDriverOnline: isDriverOnline,
            hasLocation: !!currentLocation,
            location: currentLocation
        });

        if (!currentUser) {
            console.log('[TripContext] ❌ No hay usuario logueado');
            return;
        }

        if (userProfile?.userType !== 'driver') {
            console.log('[TripContext] ℹ️ Usuario no es conductor, tipo:', userProfile?.userType);
            return;
        }

        if (!db) {
            console.log('[TripContext] ❌ Firebase db no disponible');
            return;
        }

        const onlineRef = doc(db, 'online_drivers', currentUser.uid);

        // If OFFLINE, update status to 'offline' and stop
        if (!isDriverOnline) {
            console.log('[TripContext] 🔴 Conductor OFFLINE, actualizando estado...');
            setDoc(onlineRef, { status: 'offline', updatedAt: serverTimestamp() }, { merge: true })
                .then(() => console.log('[TripContext] ✅ Estado offline guardado'))
                .catch(e => console.error("[TripContext] ❌ Error setting offline:", e));
            return;
        }

        if (!currentLocation) {
            console.log('[TripContext] ⏳ Online pero sin ubicación aún, esperando...');
            return;
        }

        // Determine status (online/in_trip)
        const driverStatus = currentTrip ? 'in_trip' : 'online';
        console.log('[TripContext] 🟢 Conductor ONLINE, status:', driverStatus);

        const updateLocation = async () => {
            try {
                const dataToSave = {
                    driverId: currentUser.uid,
                    name: userProfile.name || 'Conductor',
                    location: currentLocation,
                    status: driverStatus,
                    vehicleInfo: userProfile.vehicleInfo || { model: 'Vehículo', color: 'Blanco', plate: '---' },
                    phoneNumber: userProfile.phoneNumber || '',
                    rating: userProfile.rating || 5.0,
                    photoURL: userProfile.photoURL || null,
                    updatedAt: serverTimestamp()
                };

                console.log('[TripContext] 📤 Guardando ubicación:', {
                    name: dataToSave.name,
                    location: dataToSave.location,
                    status: dataToSave.status
                });

                await setDoc(onlineRef, dataToSave, { merge: true });
                console.log('[TripContext] ✅ Ubicación guardada exitosamente');
            } catch (err) {
                console.error("[TripContext] ❌ Error broadcasting location:", err);
            }
        };

        // Execute immediately
        updateLocation();

        // Loop - Actualizar cada 3 segundos para sincronización más precisa
        const intervalId = setInterval(updateLocation, 3000);
        return () => clearInterval(intervalId);

    }, [currentLocation, currentTrip, currentUser, userProfile, isDriverOnline, db]);

    // Función para calcular distancia entre dos puntos
    const getDistanceInMeters = (lat1, lng1, lat2, lng2) => {
        const R = 6371000; // Radio de la Tierra en metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Driver: Update location in trip + Check if driver is nearby
    useEffect(() => {
        if (!currentUser || userProfile?.userType !== 'driver') return;
        if (!currentTrip || !['accepted', 'in_progress'].includes(currentTrip.status)) return;
        if (!currentLocation) return;

        const timeoutId = setTimeout(async () => {
            try {
                const tripRef = doc(db, 'llevame_trips', currentTrip.id);
                const updateData = { driverLocation: currentLocation };

                // Detectar si el conductor está cerca del punto de recogida (menos de 200 metros)
                if (currentTrip.status === 'accepted' && currentTrip.pickup?.coordinates) {
                    const pickupLat = currentTrip.pickup.coordinates.lat;
                    const pickupLng = currentTrip.pickup.coordinates.lng;
                    const distance = getDistanceInMeters(
                        currentLocation.lat, currentLocation.lng,
                        pickupLat, pickupLng
                    );

                    // Si está a menos de 200 metros y no se ha notificado antes
                    if (distance < 200 && !currentTrip.driverNearby) {
                        updateData.driverNearby = true;
                        console.log('[TripContext] 📍 ¡Conductor cerca del pasajero!', Math.round(distance), 'm');
                    }

                    // Si está a menos de 30 metros, marcar como llegado
                    if (distance < 30 && !currentTrip.driverArrived) {
                        updateData.driverArrived = true;
                        console.log('[TripContext] 🚗 ¡Conductor llegó!');
                    }
                }

                await updateDoc(tripRef, updateData);
            } catch (err) { console.error("Error updating trip driver loc:", err); }
        }, 5000);
        return () => clearTimeout(timeoutId);
    }, [currentLocation, currentTrip?.id, currentTrip?.status, currentUser, userProfile]);

    const requestRide = async (pickup, dropoff, fare, meta = {}) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // Robust photo fetch: Try profile first, then auth user
            const pPhoto = userProfile?.photoURL || currentUser?.photoURL || null;

            await addDoc(collection(db, 'llevame_trips'), {
                riderId: currentUser.uid,
                riderName: userProfile?.name || currentUser?.displayName || 'Pasajero',
                riderPhoto: pPhoto,
                status: 'requested',
                pickup,
                dropoff,
                fare,
                distanceValue: meta.distanceValue || 0,
                distanceText: meta.distanceText || '',
                durationValue: meta.durationValue || 0,
                durationText: meta.durationText || '',
                paymentMethod: meta.paymentMethod || { type: 'cash' },
                createdAt: serverTimestamp(),
                location: currentLocation // Current rider location
            });
        } catch (err) {
            console.error("Error requesting ride:", err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const acceptTrip = async (tripId) => {
        if (!currentUser) return;
        try {
            const vInfo = userProfile?.vehicleInfo;
            const vehicleString = vInfo ? `${vInfo.model} • ${vInfo.plate}` : 'Vehículo';

            // Robust photo fetch
            const dPhoto = userProfile?.photoURL || currentUser?.photoURL || null;

            await updateDoc(doc(db, 'llevame_trips', tripId), {
                status: 'accepted',
                driverId: currentUser.uid,
                driverName: userProfile?.name || currentUser?.displayName || 'Conductor',
                driverPhoto: dPhoto,
                driverVehicle: vehicleString,
                driverVehicleData: vInfo || null,
                acceptedAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Error accepting trip:", err);
            throw err;
        }
    };

    const cancelTrip = async (tripId) => {
        try {
            await updateDoc(doc(db, 'llevame_trips', tripId), {
                status: 'cancelled',
                cancelledBy: currentUser.uid,
                cancelledAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Error cancelling trip:", err);
            throw err;
        }
    };

    const startTrip = async (tripId) => {
        try {
            await updateDoc(doc(db, 'llevame_trips', tripId), {
                status: 'in_progress',
                startedAt: serverTimestamp()
            });
        } catch (err) {
            console.error("Error starting trip:", err);
            throw err;
        }
    };

    const completeTrip = async (tripId, fareAmount = 0) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            // 1. Update Trip
            await updateDoc(doc(db, 'llevame_trips', tripId), {
                status: 'completed',
                completedAt: serverTimestamp()
            });

            // 2. Update Daily Stats for Driver
            const validFare = parseFloat(fareAmount);
            const finalAmount = isNaN(validFare) ? 0 : validFare;

            console.log('[TripContext] Completing trip with fare:', finalAmount);

            if (finalAmount > 0) {
                // Use Local Date to avoid UTC day shift checking
                const d = new Date();
                const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                const statsId = `${currentUser.uid}_${todayStr}`;
                const statsRef = doc(db, 'driver_daily_stats', statsId);

                await setDoc(statsRef, {
                    driverId: currentUser.uid,
                    date: todayStr,
                    trips: increment(1),
                    earnings: increment(finalAmount),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }

            // 3. NOTIFICACIÓN: Viaje completado
            const driverName = currentTrip?.driverName || 'tu conductor';
            notificationService.notifyTripCompleted(finalAmount, driverName);

            setCurrentTrip(null);
        } catch (err) {
            console.error("Error completing trip:", err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return (
        <TripContext.Provider value={{
            currentTrip,
            nearbyTrips,
            requestRide,
            acceptTrip,
            cancelTrip,
            startTrip,
            completeTrip,
            loading,
            error,
            isDriverOnline,
            setIsDriverOnline,
            db // Expose db for custom queries in components if needed
        }}>
            {children}
        </TripContext.Provider>
    );
};
