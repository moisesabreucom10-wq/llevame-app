/**
 * AntifraudEngine.js — Detección de Point Farming
 * 
 * Valida viajes antes de acreditar puntos.
 * Reglas: viajes ultra-cortos, circularidad, velocidad anómala, self-riding.
 */

const admin = require('firebase-admin');

const db = () => admin.firestore();

// Umbrales de fraude
const THRESHOLDS = Object.freeze({
  MIN_FARE_USD: 1.0,           // Tarifa mínima para ganar puntos
  MIN_DISTANCE_METERS: 500,    // Distancia mínima
  MAX_CIRCULAR_TRIPS_24H: 3,   // Máx viajes mismo par rider-driver en 24h
  MAX_TRIPS_PER_HOUR: 15,      // Máx viajes por hora
  MIN_TRIP_DURATION_SEC: 120,   // Duración mínima de viaje (2 min)
});

/**
 * Valida si un viaje es elegible para acreditar puntos.
 * 
 * @param {object} tripData - Datos del viaje completado
 * @returns {Promise<{ eligible: boolean, flags: Array<{rule: string, severity: string, detail?: string}> }>}
 */
async function validateTripForPoints(tripData) {
  const flags = [];
  const { driverId, riderId, fare, distanceValue, durationValue, startedAt, completedAt } = tripData;

  // 1. SELF-RIDING — conductor y pasajero son la misma persona
  if (riderId && driverId && riderId === driverId) {
    flags.push({ rule: 'SELF_RIDE', severity: 'BLOCK', detail: 'Driver and rider are the same user' });
  }

  // 2. TARIFA MÍNIMA — viajes demasiado baratos
  const fareNum = parseFloat(fare) || 0;
  const distNum = parseFloat(distanceValue) || 0;
  if (fareNum < THRESHOLDS.MIN_FARE_USD && distNum < THRESHOLDS.MIN_DISTANCE_METERS) {
    flags.push({
      rule: 'MIN_FARE',
      severity: 'BLOCK',
      detail: `Fare $${fareNum} < $${THRESHOLDS.MIN_FARE_USD} and distance ${distNum}m < ${THRESHOLDS.MIN_DISTANCE_METERS}m`,
    });
  }

  // 3. DURACIÓN MÍNIMA — viajes imposiblemente rápidos
  if (durationValue && durationValue < THRESHOLDS.MIN_TRIP_DURATION_SEC) {
    flags.push({
      rule: 'TOO_FAST',
      severity: 'FLAG',
      detail: `Trip completed in ${durationValue}s, minimum is ${THRESHOLDS.MIN_TRIP_DURATION_SEC}s`,
    });
  }

  // 4. CIRCULARIDAD — mismo par driver-rider demasiadas veces en 24h
  if (driverId && riderId) {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const circularQuery = await db().collection('llevame_trips')
        .where('driverId', '==', driverId)
        .where('riderId', '==', riderId)
        .where('status', '==', 'completed')
        .where('completedAt', '>=', dayAgo)
        .get();

      if (circularQuery.size >= THRESHOLDS.MAX_CIRCULAR_TRIPS_24H) {
        flags.push({
          rule: 'CIRCULAR_RIDES',
          severity: 'BLOCK',
          detail: `${circularQuery.size} trips between same driver-rider pair in 24h`,
        });
      }
    } catch (err) {
      console.warn('[Antifraud] Circular check failed:', err.message);
    }
  }

  // 5. VELOCIDAD ANÓMALA — demasiados viajes por hora
  if (driverId) {
    try {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const velocityQuery = await db().collection('llevame_trips')
        .where('driverId', '==', driverId)
        .where('status', '==', 'completed')
        .where('completedAt', '>=', hourAgo)
        .get();

      if (velocityQuery.size >= THRESHOLDS.MAX_TRIPS_PER_HOUR) {
        flags.push({
          rule: 'VELOCITY_ABUSE',
          severity: 'FLAG',
          detail: `${velocityQuery.size} completed trips in last hour`,
        });
      }
    } catch (err) {
      console.warn('[Antifraud] Velocity check failed:', err.message);
    }
  }

  const blocked = flags.some(f => f.severity === 'BLOCK');

  return {
    eligible: !blocked,
    flags,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  THRESHOLDS,
  validateTripForPoints,
};
