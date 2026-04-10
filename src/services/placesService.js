/**
 * placesService.js — Places API (New) via REST
 *
 * Reemplaza AutocompleteService + PlacesService del SDK de JS.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';

/**
 * Genera un token de sesión único para agrupar autocomplete + getDetails
 * en una sola sesión de facturación.
 */
export function generateSessionToken() {
    return crypto.randomUUID();
}

/**
 * Obtiene predicciones de autocompletado para un texto de búsqueda.
 *
 * @param {string} input — Texto escrito por el usuario
 * @param {string} sessionToken — Token de sesión (ver generateSessionToken)
 * @param {{ lat: number, lng: number } | null} locationBias — Bias por ubicación del usuario
 * @returns {Promise<Array<{ placeId, mainText, secondaryText, description }>>}
 */
export async function getAutocompleteSuggestions(input, sessionToken, locationBias = null) {
    if (!input || input.trim().length < 2) return [];

    const body = {
        input: input.trim(),
        sessionToken,
        languageCode: 'es',
    };

    if (locationBias) {
        body.locationBias = {
            circle: {
                center: { latitude: locationBias.lat, longitude: locationBias.lng },
                radius: 50000, // 50 km
            },
        };
    }

    try {
        const res = await fetch(AUTOCOMPLETE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': API_KEY,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`Places Autocomplete error: ${res.status}`);

        const data = await res.json();
        const suggestions = data.suggestions || [];

        return suggestions
            .filter(s => s.placePrediction)
            .map(s => {
                const p = s.placePrediction;
                return {
                    placeId: p.placeId,
                    mainText: p.structuredFormat?.mainText?.text || p.text?.text || '',
                    secondaryText: p.structuredFormat?.secondaryText?.text || '',
                    description: p.text?.text || '',
                };
            });
    } catch (error) {
        console.error('[placesService] getAutocompleteSuggestions:', error);
        return [];
    }
}

/**
 * Obtiene detalles de un lugar (coordenadas + dirección) por su placeId.
 *
 * @param {string} placeId
 * @param {string} sessionToken — Mismo token usado en autocomplete (cierra la sesión)
 * @returns {Promise<{ coordinates: { lat, lng }, address: string, name: string } | null>}
 */
export async function getPlaceDetails(placeId, sessionToken) {
    try {
        const url = `${PLACE_DETAILS_URL}/${placeId}`;
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': API_KEY,
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
                'X-Goog-SessionToken': sessionToken,
            },
        });

        if (!res.ok) throw new Error(`Place Details error: ${res.status}`);

        const place = await res.json();
        return {
            coordinates: {
                lat: place.location?.latitude,
                lng: place.location?.longitude,
            },
            address: place.formattedAddress || '',
            name: place.displayName?.text || '',
        };
    } catch (error) {
        console.error('[placesService] getPlaceDetails:', error);
        return null;
    }
}
