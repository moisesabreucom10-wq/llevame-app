/**
 * geocodingService.js — Geocoding API via REST
 *
 * Reemplaza google.maps.Geocoder del SDK de JS.
 * Docs: https://developers.google.com/maps/documentation/geocoding/requests-geocoding
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Convierte coordenadas GPS a dirección textual (reverse geocoding).
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string | null>} Dirección formateada o null si falla
 */
export async function reverseGeocode(lat, lng) {
    try {
        const url = `${BASE_URL}?latlng=${lat},${lng}&key=${API_KEY}&language=es`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Geocoding error: ${res.status}`);

        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
            return data.results[0].formatted_address;
        }
        return null;
    } catch (error) {
        console.error('[geocodingService] reverseGeocode:', error);
        return null;
    }
}

/**
 * Convierte una dirección textual a coordenadas (forward geocoding).
 *
 * @param {string} address
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export async function forwardGeocode(address) {
    try {
        const url = `${BASE_URL}?address=${encodeURIComponent(address)}&key=${API_KEY}&language=es`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Geocoding error: ${res.status}`);

        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
        return null;
    } catch (error) {
        console.error('[geocodingService] forwardGeocode:', error);
        return null;
    }
}
