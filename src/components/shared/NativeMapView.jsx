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

        const init = async () => {
            const bounds = getBounds();
            if (!bounds) return;

            try {
                await NavigationPlugin.initMap(bounds);
                initializedRef.current = true;

                // Registrar event listeners nativos → React
                const listeners = [
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
                ];
                listenersRef.current = listeners;

                // ResizeObserver: sincroniza bounds si el layout cambia
                resizeObserver = new ResizeObserver(() => {
                    const newBounds = getBounds();
                    if (newBounds && initializedRef.current) {
                        NavigationPlugin.updateMapBounds(newBounds);
                    }
                });
                resizeObserver.observe(containerRef.current);

            } catch (err) {
                console.error('[NativeMapView] init error:', err);
            }
        };

        // Esperar al siguiente frame para que el DOM esté pintado y getBoundingClientRect sea preciso
        const raf = requestAnimationFrame(init);

        return () => {
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();

            // Remover listeners nativos
            listenersRef.current.forEach(l => l?.remove?.());
            listenersRef.current = [];

            // Destruir la vista nativa
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
