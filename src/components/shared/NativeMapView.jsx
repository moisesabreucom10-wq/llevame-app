import React, { useEffect, useRef, useCallback } from 'react';
import NavigationPlugin, { NAV_EVENTS } from '../../plugins/NavigationPlugin';

/**
 * NativeMapView — Componente React que controla el Navigation SDK nativo.
 *
 * Cómo funciona:
 * 1. Al montarse, mide su posición en el DOM y crea la NavigationView nativa
 *    exactamente detrás de este div (que es transparente).
 * 2. Un ResizeObserver mantiene la vista nativa sincronizada si el layout cambia.
 * 3. Al desmontarse, destruye la vista nativa y restaura el WebView.
 *
 * Props:
 * - onLocationUpdate(lat, lng, speed, bearing): callback de posición GPS
 * - onArrival(waypoint): callback cuando el conductor llega al destino
 * - onReroute(): callback cuando el SDK recalcula la ruta
 * - onNavigationEvent(event, data): callback de eventos generales de navegación
 * - onSpeedAlert(currentSpeed, speedLimit, isOver): callback de alerta de velocidad
 * - mapType: 'normal' | 'satellite' | 'terrain' | 'hybrid'
 * - className: clases CSS adicionales
 */
const NativeMapView = ({
    onLocationUpdate,
    onArrival,
    onReroute,
    onNavigationEvent,
    onSpeedAlert,
    onCameraMove,
    mapType = 'normal',
    className = '',
}) => {
    const containerRef = useRef(null);
    const initializedRef = useRef(false);
    const listenersRef = useRef([]);

    // ─────────────────────────────────────────────
    // Calcula bounds del contenedor en coordenadas de pantalla
    // ─────────────────────────────────────────────
    const getBounds = useCallback(() => {
        if (!containerRef.current) return null;
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };
    }, []);

    // ─────────────────────────────────────────────
    // Inicialización
    // ─────────────────────────────────────────────
    useEffect(() => {
        let resizeObserver;
        let mounted = true; // Guard: impide que initMap complete si ya nos desmontamos

        const init = async () => {
            const bounds = getBounds();
            if (!bounds || !mounted) return;

            try {
                await NavigationPlugin.initMap(bounds);

                // Si nos desmontamos mientras esperábamos, destruir inmediatamente
                if (!mounted) {
                    NavigationPlugin.destroyMap();
                    return;
                }

                initializedRef.current = true;

                // Registrar event listeners nativos → React.
                // addListener() en Capacitor nativo devuelve una Promise<PluginListenerHandle>.
                // Usar Promise.all para obtener los handles resueltos antes de guardarlos,
                // de lo contrario el cleanup llama .remove() sobre Promises (no-op).
                const listenerHandles = await Promise.all([
                    NavigationPlugin.addListener(NAV_EVENTS.LOCATION_UPDATE, (data) => {
                        onLocationUpdate?.(data.lat, data.lng, data.speed, data.bearing);
                    }),
                    NavigationPlugin.addListener(NAV_EVENTS.ARRIVAL, (data) => {
                        onArrival?.(data.waypoint);
                    }),
                    NavigationPlugin.addListener(NAV_EVENTS.REROUTE, () => {
                        onReroute?.();
                    }),
                    NavigationPlugin.addListener(NAV_EVENTS.NAVIGATION_EVENT, (data) => {
                        onNavigationEvent?.(data.event, data.data);
                    }),
                    NavigationPlugin.addListener(NAV_EVENTS.SPEED_ALERT, (data) => {
                        onSpeedAlert?.(data.currentSpeed, data.speedLimit, data.isOver);
                    }),
                    NavigationPlugin.addListener(NAV_EVENTS.CAMERA_MOVE, (data) => {
                        onCameraMove?.(data.lat, data.lng);
                    }),
                ]);
                listenersRef.current = listenerHandles;

                // ResizeObserver: sincroniza bounds si el layout cambia
                resizeObserver = new ResizeObserver(() => {
                    const newBounds = getBounds();
                    if (newBounds && initializedRef.current) {
                        NavigationPlugin.updateMapBounds(newBounds);
                    }
                });
                if (containerRef.current) {
                    resizeObserver.observe(containerRef.current);
                }

            } catch (err) {
                console.error('[NativeMapView] init error:', err);
            }
        };

        // Esperar al siguiente frame para que el DOM esté pintado y getBoundingClientRect sea preciso
        const raf = requestAnimationFrame(init);

        return () => {
            mounted = false;
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();

            // Remover listeners nativos
            listenersRef.current.forEach(l => l?.remove?.());
            listenersRef.current = [];

            // Destruir la vista nativa (serializado: espera a que initMap complete si está en vuelo)
            if (initializedRef.current) {
                NavigationPlugin.destroyMap();
                initializedRef.current = false;
            }
        };
    }, []); // Solo al montar/desmontar

    // ─────────────────────────────────────────────
    // Cambio de tipo de mapa
    // ─────────────────────────────────────────────
    useEffect(() => {
        if (initializedRef.current) {
            NavigationPlugin.setMapType({ mapType });
        }
    }, [mapType]);

    // ─────────────────────────────────────────────
    // Modo nocturno automático según hora del día
    // Noche: 18:00 – 06:00
    // ─────────────────────────────────────────────
    useEffect(() => {
        const applyNightMode = () => {
            if (!initializedRef.current) return;
            const hour = new Date().getHours();
            const isNight = hour >= 18 || hour < 6;
            NavigationPlugin.setNightMode({ enabled: isNight });
        };

        // Aplicar al inicializar el mapa (el evento mapReady dispara antes de este efecto)
        // Usar un pequeño delay para asegurar que el mapa ya respondió a initMap
        const timeout = setTimeout(applyNightMode, 500);

        // Revisar cada 10 minutos por si el usuario cruza el umbral horario
        const interval = setInterval(applyNightMode, 10 * 60 * 1000);

        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, []); // Solo al montar

    // ─────────────────────────────────────────────
    // API imperativa expuesta via ref (useNativeMap hook)
    // ─────────────────────────────────────────────

    return (
        <div
            ref={containerRef}
            className={`w-full h-full ${className}`}
            style={{
                // Transparente para que el mapa nativo sea visible detrás
                background: 'transparent',
                // Evitar que eventos de touch sean interceptados por el WebView sobre el mapa
                touchAction: 'none',
            }}
        />
    );
};

export default NativeMapView;
