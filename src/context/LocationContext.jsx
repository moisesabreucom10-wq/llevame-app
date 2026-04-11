import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import backgroundLocationService from '../services/BackgroundLocationService';

const LocationContext = createContext();

export const useLocation = () => useContext(LocationContext);

export const LocationProvider = ({ children }) => {
    const [currentLocation, setCurrentLocation] = useState(null);
    const [error, setError] = useState(null);
    const [isBackgroundTrackingActive, setIsBackgroundTrackingActive] = useState(false);
    const foregroundWatchId = useRef(null);

    const getCurrentPosition = async () => {
        try {
            const permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
                const request = await Geolocation.requestPermissions();
                if (request.location !== 'granted') {
                    throw new Error('Location permission denied');
                }
            }

            const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                heading: position.coords.heading,
                speed: position.coords.speed
            };
            setCurrentLocation(location);
            return location;
        } catch (err) {
            console.error('[LocationContext] ❌ Error getting location:', err);
            setError(err.message);
            return null;
        }
    };

    // Iniciar tracking en segundo plano (para conductores online)
    const startBackgroundTracking = useCallback(async () => {
        // Solo funciona en dispositivos nativos
        if (!Capacitor.isNativePlatform()) {
            // En web, seguir usando el watcher de foreground
            return false;
        }

        try {
            // Detener el watcher de foreground si existe (para evitar duplicados)
            if (foregroundWatchId.current) {
                try {
                    await Geolocation.clearWatch({ id: foregroundWatchId.current });
                    foregroundWatchId.current = null;
                } catch (e) {
                    console.warn('[LocationContext] Error deteniendo foreground watcher:', e);
                }
            }

            await backgroundLocationService.startBackgroundTracking((newLocation) => {
                setCurrentLocation(newLocation);
            });

            setIsBackgroundTrackingActive(true);
            return true;
        } catch (err) {
            console.error('[LocationContext] ❌ Error iniciando background tracking:', err);
            setError(err.message);
            // Reactivar foreground watcher si falla el background
            startForegroundWatcher();
            return false;
        }
    }, []);

    // Detener tracking en segundo plano
    const stopBackgroundTracking = useCallback(async () => {
        try {
            await backgroundLocationService.stopBackgroundTracking();
            setIsBackgroundTrackingActive(false);
            // Reactivar el watcher de foreground
            startForegroundWatcher();
        } catch (err) {
            console.error('[LocationContext] Error deteniendo background tracking:', err);
        }
    }, []);

    // Función para iniciar watcher de foreground
    const startForegroundWatcher = async () => {
        if (foregroundWatchId.current) return; // Ya existe uno

        try {
            foregroundWatchId.current = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 1000
            }, (position, err) => {
                if (err) {
                    console.error('[LocationContext] Foreground watch error:', err);
                    return;
                }
                if (position && !backgroundLocationService.isActive()) {
                    const newLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        heading: position.coords.heading,
                        speed: position.coords.speed
                    };
                    setCurrentLocation(newLocation);
                }
            });
        } catch (err) {
            console.error('[LocationContext] Error starting foreground watch:', err);
        }
    };

    useEffect(() => {
        const initLocation = async () => {
            // 1. Obtener posición inicial
            const initialLoc = await getCurrentPosition();
            if (!initialLoc) {
                console.warn('[LocationContext] No se pudo obtener posición inicial');
            }

            // 2. Iniciar watcher de foreground (solo si no hay background activo)
            if (!backgroundLocationService.isActive()) {
                await startForegroundWatcher();
            }
        };

        initLocation();

        return () => {
            // Limpiar al desmontar
            if (foregroundWatchId.current) {
                Geolocation.clearWatch({ id: foregroundWatchId.current }).catch(() => { });
            }
            backgroundLocationService.stopBackgroundTracking().catch(() => { });
        };
    }, []);

    // Permite a componentes externos (ej. DriverHome con Navigation SDK) inyectar
    // una ubicación más precisa (road-snapped) durante la navegación activa.
    const updateLocation = useCallback((lat, lng, heading = null, speed = null) => {
        setCurrentLocation(prev => ({
            ...prev,
            lat,
            lng,
            ...(heading !== null && { heading }),
            ...(speed !== null && { speed }),
        }));
    }, []);

    return (
        <LocationContext.Provider value={{
            currentLocation,
            error,
            getCurrentPosition,
            startBackgroundTracking,
            stopBackgroundTracking,
            isBackgroundTrackingActive,
            updateLocation,
        }}>
            {children}
        </LocationContext.Provider>
    );
};
