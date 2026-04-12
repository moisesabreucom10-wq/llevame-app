import { registerPlugin, Capacitor } from '@capacitor/core';

/**
 * NavigationPlugin — Interfaz JavaScript para el Navigation SDK nativo.
 *
 * En plataforma Android: llama al NavigationPlugin.java via Capacitor bridge.
 * En Web (desarrollo en browser): usa stubs que loguean para no romper.
 *
 * SERIALIZACIÓN: initMap y destroyMap corren en serie (cola de Promesas)
 * para evitar que un destroyMap en vuelo y un initMap inmediato colisionen
 * en el hilo nativo de Android.
 */

const webStub = {
    initMap: async (opts) => {
        console.log('[NavPlugin Web] initMap', opts);
        return { initialized: true };
    },
    updateMapBounds: async (opts) => console.log('[NavPlugin Web] updateMapBounds', opts),
    destroyMap: async () => console.log('[NavPlugin Web] destroyMap'),
    animateCamera: async (opts) => console.log('[NavPlugin Web] animateCamera', opts),
    setMapType: async (opts) => console.log('[NavPlugin Web] setMapType', opts),
    addMarker: async (opts) => console.log('[NavPlugin Web] addMarker', opts),
    removeMarker: async (opts) => console.log('[NavPlugin Web] removeMarker', opts),
    clearMarkers: async () => console.log('[NavPlugin Web] clearMarkers'),
    setRoute: async (opts) => {
        console.log('[NavPlugin Web] setRoute', opts);
        return { status: 'OK', success: true };
    },
    startNavigation: async () => console.log('[NavPlugin Web] startNavigation'),
    stopNavigation: async () => console.log('[NavPlugin Web] stopNavigation'),
    setAudioGuidance: async (opts) => console.log('[NavPlugin Web] setAudioGuidance', opts),
    setNightMode: async (opts) => console.log('[NavPlugin Web] setNightMode', opts),
    addListener: (event, cb) => {
        console.log('[NavPlugin Web] addListener:', event);
        return { remove: () => {} };
    },
    removeAllListeners: async () => {},
};

// ─────────────────────────────────────────────
// Cola serie para operaciones init/destroy
// Garantiza que nunca haya dos llamadas concurrent en el hilo de UI nativo.
// ─────────────────────────────────────────────
let _serialQueue = Promise.resolve();

function enqueue(fn) {
    _serialQueue = _serialQueue.then(() => fn().catch(err => {
        console.warn('[NavPlugin] queued op error:', err);
    }));
    return _serialQueue;
}

const nativePlugin = Capacitor.isNativePlatform()
    ? registerPlugin('NavigationPlugin')
    : webStub;

const NavigationPlugin = {
    // Operaciones serializadas (cycle-safe)
    initMap:    (opts) => enqueue(() => nativePlugin.initMap(opts)),
    destroyMap: ()     => enqueue(() => nativePlugin.destroyMap()),

    // Resto pasan directo (el nativo ya es thread-safe para estas)
    updateMapBounds:  (opts) => nativePlugin.updateMapBounds(opts),
    animateCamera:    (opts) => nativePlugin.animateCamera(opts),
    setMapType:       (opts) => nativePlugin.setMapType(opts),
    addMarker:        (opts) => nativePlugin.addMarker(opts),
    removeMarker:     (opts) => nativePlugin.removeMarker(opts),
    clearMarkers:     ()     => nativePlugin.clearMarkers(),
    setRoute:         (opts) => nativePlugin.setRoute(opts),
    startNavigation:  ()     => nativePlugin.startNavigation(),
    stopNavigation:   ()     => nativePlugin.stopNavigation(),
    setAudioGuidance: (opts) => nativePlugin.setAudioGuidance(opts),
    setNightMode:     (opts) => nativePlugin.setNightMode(opts),
    addListener:      (event, cb) => nativePlugin.addListener(event, cb),
    removeAllListeners: () => nativePlugin.removeAllListeners(),
};

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
