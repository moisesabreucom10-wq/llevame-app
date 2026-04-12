import { useCallback } from 'react';
import NavigationPlugin from '../plugins/NavigationPlugin';

/**
 * useNativeMap — Hook para controlar la NavigationView nativa de forma imperativa.
 *
 * Reemplaza todos los refs del Map.jsx anterior (mapRef.current.panTo, setZoom, etc.)
 *
 * Uso:
 *   const map = useNativeMap();
 *   map.animateCamera({ lat, lng, zoom: 16 });
 *   map.addMarker({ id: 'driver', lat, lng, svgBase64: '...' });
 *   await map.setRoute([{ lat, lng, title: 'Destino' }]);
 *   map.startNavigation();
 */
export function useNativeMap() {
    const animateCamera = useCallback((opts) => {
        return NavigationPlugin.animateCamera(opts);
    }, []);

    const setMapType = useCallback((type) => {
        return NavigationPlugin.setMapType({ mapType: type });
    }, []);

    const addMarker = useCallback((opts) => {
        return NavigationPlugin.addMarker(opts);
    }, []);

    const removeMarker = useCallback((id) => {
        return NavigationPlugin.removeMarker({ id });
    }, []);

    const clearMarkers = useCallback(() => {
        return NavigationPlugin.clearMarkers();
    }, []);

    const setRoute = useCallback((waypoints) => {
        return NavigationPlugin.setRoute({ waypoints });
    }, []);

    const startNavigation = useCallback(() => {
        return NavigationPlugin.startNavigation();
    }, []);

    const stopNavigation = useCallback(() => {
        return NavigationPlugin.stopNavigation();
    }, []);

    const setAudioGuidance = useCallback((muted) => {
        return NavigationPlugin.setAudioGuidance({ muted });
    }, []);

    const setNightMode = useCallback((enabled) => {
        return NavigationPlugin.setNightMode({ enabled });
    }, []);

    return {
        animateCamera,
        setMapType,
        addMarker,
        removeMarker,
        clearMarkers,
        setRoute,
        startNavigation,
        stopNavigation,
        setAudioGuidance,
        setNightMode,
    };
}
