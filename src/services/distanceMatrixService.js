/**
 * distanceMatrixService.js — Distance Matrix API via REST
 *
 * Reemplaza la fórmula Haversine (línea recta) para cálculo de tarifas.
 * Retorna distancia y duración reales por carretera entre múltiples puntos.
 * Docs: https://developers.google.com/maps/documentation/distance-matrix/distance-matrix
 */

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

/**
 * Obtiene distancia y tiempo de viaje entre origen y destino.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @returns {Promise<{
 *   distance: { text: string, value: number },
 *   duration: { text: string, value: number },
 *   durationInTraffic: { text: string, value: number } | null
 * } | null>}
 */
export async function getDistanceMatrix(origin, destination) {
    try {
        const originStr = `${origin.lat},${origin.lng}`;
        const destStr = `${destination.lat},${destination.lng}`;
        const url = `${BASE_URL}?origins=${originStr}&destinations=${destStr}&mode=driving&language=es&departure_time=now&key=${API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Distance Matrix error: ${res.status}`);

        const data = await res.json();
        if (data.status !== 'OK') {
            console.warn('[distanceMatrixService] API status:', data.status);
            return null;
        }

        const element = data.rows[0]?.elements[0];
        if (!element || element.status !== 'OK') return null;

        return {
            distance: element.distance,                          // { text: '4.1 km', value: 4100 }
            duration: element.duration,                          // { text: '10 mins', value: 600 }
            durationInTraffic: element.duration_in_traffic || null, // Con tráfico en tiempo real
        };
    } catch (error) {
        console.error('[distanceMatrixService] getDistanceMatrix:', error);
        return null;
    }
}

/**
 * Calcula la tarifa estimada basada en distancia real por carretera.
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {{ lat: number, lng: number }} destination
 * @param {number} bcvRate — Tasa BCV Bs/USD
 * @param {'moto' | 'carro'} vehicleType
 * @returns {Promise<{ km: number, minutes: number, usd: number, bs: number } | null>}
 */
export async function calculateFare(origin, destination, bcvRate = 60, vehicleType = 'moto') {
    const matrix = await getDistanceMatrix(origin, destination);
    if (!matrix) return null;

    const km = matrix.distance.value / 1000;
    const minutes = matrix.duration.value / 60;

    // Tarifas base (ajustables)
    const BASE_FARE_USD = vehicleType === 'moto' ? 0.50 : 0.75;
    const PER_KM_USD    = vehicleType === 'moto' ? 0.30 : 0.45;
    const PER_MIN_USD   = 0.05;
    const MIN_FARE_USD  = vehicleType === 'moto' ? 1.00 : 1.50;

    const rawUsd = BASE_FARE_USD + (km * PER_KM_USD) + (minutes * PER_MIN_USD);
    const usd = Math.max(rawUsd, MIN_FARE_USD);
    const bs = usd * bcvRate;

    return {
        km: Math.round(km * 10) / 10,
        minutes: Math.round(minutes),
        usd: Math.round(usd * 100) / 100,
        bs: Math.round(bs),
    };
}
