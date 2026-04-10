import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * NavigationPlugin — Interfaz JavaScript para el Navigation SDK nativo.
 *
 * En plataforma Android: llama al NavigationPlugin.java via Capacitor bridge.
 * En Web (desarrollo en browser): usa stubs que loguean para no romper.
 */

const webStub = {
    // Ciclo de vida
    initMap: async (opts) => {
        console.log('[NavPlugin Web] initMap', opts);
        return { initialized: true };
    },
    updateMapBounds: async (opts) => console.log('[NavPlugin Web] updateMapBounds', opts),
    destroyMap: async () => console.log('[NavPlugin Web] destroyMap'),

    // Cámara
    animateCamera: async (opts) => console.log('[NavPlugin Web] animateCamera', opts),
    setMapType: async (opts) => console.log('[NavPlugin Web] setMapType', opts),

    // Marcadores
    addMarker: async (opts) => console.log('[NavPlugin Web] addMarker', opts),
    removeMarker: async (opts) => console.log('[NavPlugin Web] removeMarker', opts),
    clearMarkers: async () => console.log('[NavPlugin Web] clearMarkers'),

    // Navegación
    setRoute: async (opts) => {
        console.log('[NavPlugin Web] setRoute', opts);
        return { status: 'OK', success: true };
    },
    startNavigation: async () => console.log('[NavPlugin Web] startNavigation'),
    stopNavigation: async () => console.log('[NavPlugin Web] stopNavigation'),
    setAudioGuidance: async (opts) => console.log('[NavPlugin Web] setAudioGuidance', opts),

    // Listeners (no-op en web)
    addListener: (event, cb) => {
        console.log('[NavPlugin Web] addListener:', event);
        return { remove: () => {} };
    },
    removeAllListeners: async () => {},
};

const NavigationPlugin = Capacitor.isNativePlatform()
    ? registerPlugin('NavigationPlugin')
    : webStub;

export default NavigationPlugin;

// ─────────────────────────────────────────────
// Constantes de eventos
// ─────────────────────────────────────────────
export const NAV_EVENTS = {
    LOCATION_UPDATE:  'onLocationUpdate',
    ARRIVAL:          'onArrival',
    REROUTE:          'onReroute',
    NAVIGATION_EVENT: 'onNavigationEvent',
    SPEED_ALERT:      'onSpeedAlert',
    CAMERA_MOVE:      'onCameraMove',
};
