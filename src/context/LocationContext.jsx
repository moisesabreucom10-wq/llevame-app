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
            console.log('[LocationContext] ℹ️ Background tracking solo disponible en dispositivos nativos');
            // En web, seguir usando el watcher de foreground
            return false;
        }

        try {
            console.log('[LocationContext] 🔔 Iniciando background tracking...');

            // Detener el watcher de foreground si existe (para evitar duplicados)
            if (foregroundWatchId.current) {
                try {
                    await Geolocation.clearWatch({ id: foregroundWatchId.current });
                    foregroundWatchId.current = null;
                    console.log('[LocationContext] ⏹️ Watcher de foreground detenido');
                } catch (e) {
                    console.warn('[LocationContext] ⚠️ Error deteniendo foreground watcher:', e);
                }
            }

            await backgroundLocationService.startBackgroundTracking((newLocation) => {
                console.log('[LocationContext] 📍 Ubicación background recibida:', newLocation.lat?.toFixed(6), newLocation.lng?.toFixed(6));
                setCurrentLocation(newLocation);
            });

            setIsBackgroundTrackingActive(true);
            console.log('[LocationContext] ✅ Background tracking activado');
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
            console.log('[LocationContext] 🔕 Deteniendo background tracking...');
            await backgroundLocationService.stopBackgroundTracking();
            setIsBackgroundTrackingActive(false);
            console.log('[LocationContext] ✅ Background tracking desactivado');

            // Reactivar el watcher de foreground
            startForegroundWatcher();
        } catch (err) {
            console.error('[LocationContext] ❌ Error deteniendo background tracking:', err);
        }
    }, []);

    // Función para iniciar watcher de foreground
    const startForegroundWatcher = async () => {
        if (foregroundWatchId.current) return; // Ya existe uno

        try {
            console.log("[LocationContext] 👁️ Iniciando watcher de foreground...");
            foregroundWatchId.current = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 1000
            }, (position, err) => {
                if (err) {
                    console.error('[LocationContext] ❌ Foreground watch error:', err);
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
            console.log("[LocationContext] ✅ Foreground watcher activo, ID:", foregroundWatchId.current);
        } catch (err) {
            console.error("[LocationContext] ❌ Error starting foreground watch:", err);
        }
    };

    useEffect(() => {
        const initLocation = async () => {
            console.log("[LocationContext] 🚀 Iniciando LocationContext...");

            // 1. Obtener posición inicial
            const initialLoc = await getCurrentPosition();
            if (initialLoc) {
                console.log("[LocationContext] ✅ Posición inicial:", initialLoc.lat?.toFixed(6), initialLoc.lng?.toFixed(6));
            } else {
                console.warn("[LocationContext] ⚠️ No se pudo obtener posición inicial");
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

    return (
        <LocationContext.Provider value={{
            currentLocation,
            error,
            getCurrentPosition,
            startBackgroundTracking,
            stopBackgroundTracking,
            isBackgroundTrackingActive
        }}>
            {children}
        </LocationContext.Provider>
    );
};
