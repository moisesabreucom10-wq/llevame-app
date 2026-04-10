/**
 * directionsService.js — Directions API via REST
 *
 * Usado para obtener distancia/duración/polyline de una ruta
 * ANTES de que empiece la navegación nativa (para mostrar al usuario).
 * Docs: https://developers.google.com/maps/documentation/directions/get-directions
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';

/**
 * Calcula la ruta entre dos puntos.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{
 *   distance: { text: string, value: number },
 *   duration: { text: string, value: number },
 *   overviewPolyline: string,
 *   steps: Array<{ instruction: string, distance: string, duration: string }>
 * } | null>}
 */
export async function getRoute(origin, destination) {
    try {
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = `${destination.lat},${destination.lng}`;
        const url = `${BASE_URL}?origin=${originStr}&destination=${destStr}&mode=driving&language=es&key=${API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Directions error: ${res.status}`);

        const data = await res.json();
        if (data.status !== 'OK' || !data.routes.length) {
            console.warn('[directionsService] No route found:', data.status);
            return null;
        }

        const route = data.routes[0];
        const leg = route.legs[0];

        return {
            distance: leg.distance,        // { text: '3.2 km', value: 3200 }
            duration: leg.duration,        // { text: '8 mins', value: 480 }
            overviewPolyline: route.overview_polyline.points,
            steps: leg.steps.map(step => ({
                instruction: step.html_instructions.replace(/<[^>]+>/g, ''),
                distance: step.distance.text,
                duration: step.duration.text,
            })),
        };
    } catch (error) {
        console.error('[directionsService] getRoute:', error);
        return null;
    }
}
