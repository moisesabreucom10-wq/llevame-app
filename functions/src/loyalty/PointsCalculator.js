/**
 * PointsCalculator.js — Strategy Pattern for Tier Multipliers
 * 
 * Calcula los puntos ganados por viaje basado en el Gross Revenue
 * y el multiplicador del nivel actual del conductor.
 * 
 * Valor: 10 puntos = $1 USD
 */

const TIER_CONFIG = Object.freeze({
  bronce:   { multiplier: 1.0, minTrips: 0,   minRating: 0.0, label: 'Bronce' },
  plata:    { multiplier: 1.2, minTrips: 50,  minRating: 4.7, label: 'Plata' },
  oro:      { multiplier: 1.5, minTrips: 120, minRating: 4.8, label: 'Oro' },
  diamante: { multiplier: 2.0, minTrips: 250, minRating: 4.9, label: 'Diamante' },
});

const POINTS_PER_DOLLAR = 10;

/**
 * Calcula los puntos usando el Gross Revenue ANTES de comisiones.
 * @param {number} grossFare - Tarifa bruta del viaje en USD
 * @param {string} tier - Nivel actual del conductor
 * @returns {{ basePoints: number, bonusPoints: number, totalPoints: number, multiplier: number, tierUsed: string }}
 */
function calculatePoints(grossFare, tier = 'bronce') {
  if (typeof grossFare !== 'number' || grossFare <= 0) {
    return { basePoints: 0, bonusPoints: 0, totalPoints: 0, multiplier: 1.0, tierUsed: 'bronce' };
  }

  const config = TIER_CONFIG[tier] || TIER_CONFIG.bronce;
  const basePoints = Math.floor(grossFare * POINTS_PER_DOLLAR);
  const totalPoints = Math.floor(basePoints * config.multiplier);
  const bonusPoints = totalPoints - basePoints;

  return {
    basePoints,
    bonusPoints,
    totalPoints,
    multiplier: config.multiplier,
    tierUsed: tier,
  };
}

/**
 * Convierte puntos a su equivalente en USD.
 * @param {number} points 
 * @returns {number} USD value
 */
function pointsToUSD(points) {
  return points / POINTS_PER_DOLLAR;
}

/**
 * Convierte USD a puntos.
 * @param {number} usd 
 * @returns {number} points
 */
function usdToPoints(usd) {
  return Math.floor(usd * POINTS_PER_DOLLAR);
}

module.exports = {
  TIER_CONFIG,
  POINTS_PER_DOLLAR,
  calculatePoints,
  pointsToUSD,
  usdToPoints,
};
