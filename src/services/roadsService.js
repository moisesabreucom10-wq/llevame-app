/**
 * roadsService.js — Roads API via REST
 *
 * Ajusta coordenadas GPS crudas a la carretera más cercana (snap-to-road).
 * Hace que el ícono del conductor se mueva por la calle, no salte entre edificios.
 * Docs: https://developers.google.com/maps/documentation/roads/snap
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SNAP_URL = 'https://roads.googleapis.com/v1/snapToRoads';

/**
 * Ajusta una lista de puntos GPS a las carreteras más cercanas.
 *
 * @param {Array<{ lat: number, lng: number }>} path — Hasta 100 puntos
 * @param {boolean} interpolate — Si true, agrega puntos intermedios para rutas más suaves
 * @returns {Promise<Array<{ lat: number, lng: number }>>} Puntos ajustados a la carretera
 */
export async function snapToRoads(path, interpolate = false) {
    if (!path || path.length === 0) return path;

    // La API acepta máximo 100 puntos por request
    const chunk = path.slice(0, 100);
    const pathStr = chunk.map(p => `${p.lat},${p.lng}`).join('|');

    try {
        const url = `${SNAP_URL}?path=${encodeURIComponent(pathStr)}&interpolate=${interpolate}&key=${API_KEY}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Roads API error: ${res.status}`);

        const data = await res.json();
        if (!data.snappedPoints || data.snappedPoints.length === 0) return path;

        return data.snappedPoints.map(sp => ({
            lat: sp.location.latitude,
            lng: sp.location.longitude,
        }));
    } catch (error) {
        console.error('[roadsService] snapToRoads:', error);
        // Si falla, devolver los puntos originales para no romper el tracking
        return path;
    }
}

/**
 * Ajusta UNA sola coordenada a la carretera más cercana.
 * Optimizado para el caso de uso de tracking en tiempo real del conductor.
 *
 * @param {{ lat: number, lng: number }} point
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export async function snapSinglePoint(point) {
    const snapped = await snapToRoads([point], false);
    return snapped[0] || point;
}
