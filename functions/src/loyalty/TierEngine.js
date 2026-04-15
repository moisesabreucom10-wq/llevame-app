/**
 * TierEngine.js — State Machine for Driver Tier Recalification
 * 
 * Ascensos: INMEDIATOS (se evalúan tras cada viaje completado)
 * Descensos: FIN DE CICLO MENSUAL (Cloud Scheduler, día 1 de cada mes)
 * Inactividad: 2 meses sin viajes → purga total de puntos
 */

const TIER_ORDER = ['bronce', 'plata', 'oro', 'diamante'];

const TIER_REQUIREMENTS = Object.freeze({
  bronce:   { minTrips: 0,   minRating: 0.0 },
  plata:    { minTrips: 50,  minRating: 4.7 },
  oro:      { minTrips: 120, minRating: 4.8 },
  diamante: { minTrips: 250, minRating: 4.9 },
});

const TIER_MULTIPLIERS = Object.freeze({
  bronce: 1.0,
  plata: 1.2,
  oro: 1.5,
  diamante: 2.0,
});

// Meses de inactividad antes de purga de puntos
const INACTIVITY_MONTHS = 2;

/**
 * Evalúa si el conductor califica para un ascenso INMEDIATO.
 * Permite saltos directos (Bronce → Oro si cumple requisitos).
 * 
 * @param {string} currentTier
 * @param {number} tripsThisMonth
 * @param {number} ratingAvg
 * @returns {{ action: 'PROMOTE' | 'NO_CHANGE', newTier: string, reason?: string }}
 */
function evaluatePromotion(currentTier, tripsThisMonth, ratingAvg) {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex === -1) {
    return { action: 'NO_CHANGE', newTier: 'bronce' };
  }

  // Buscar el tier más alto al que califica (permite salto directo)
  for (let i = TIER_ORDER.length - 1; i > currentIndex; i--) {
    const candidateTier = TIER_ORDER[i];
    const req = TIER_REQUIREMENTS[candidateTier];

    if (tripsThisMonth >= req.minTrips && ratingAvg >= req.minRating) {
      return {
        action: 'PROMOTE',
        newTier: candidateTier,
        reason: `Cumple requisitos de ${candidateTier}: ${tripsThisMonth} viajes (req: ${req.minTrips}), rating ${ratingAvg} (req: ${req.minRating})`,
      };
    }
  }

  return { action: 'NO_CHANGE', newTier: currentTier };
}

/**
 * Evaluación mensual: detecta si debe DESCENDER.
 * Solo baja UN nivel por ciclo (grace period implícito).
 * 
 * @param {string} currentTier
 * @param {number} tripsLastMonth
 * @param {number} ratingAvg
 * @returns {{ action: 'DEMOTE' | 'NO_CHANGE', newTier: string, reason?: string }}
 */
function evaluateDemotion(currentTier, tripsLastMonth, ratingAvg) {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  if (currentIndex <= 0) {
    return { action: 'NO_CHANGE', newTier: 'bronce' };
  }

  const req = TIER_REQUIREMENTS[currentTier];

  if (tripsLastMonth < req.minTrips || ratingAvg < req.minRating) {
    const newTier = TIER_ORDER[currentIndex - 1];
    return {
      action: 'DEMOTE',
      newTier,
      reason: `No cumple ${currentTier}: trips ${tripsLastMonth}/${req.minTrips}, rating ${ratingAvg}/${req.minRating}`,
    };
  }

  return { action: 'NO_CHANGE', newTier: currentTier };
}

/**
 * Evalúa si una cuenta está inactiva (>2 meses sin viajes).
 * Si es así, todos los puntos se purgan.
 * 
 * @param {Date|null} lastTripDate - Fecha del último viaje completado
 * @returns {{ inactive: boolean, monthsInactive: number }}
 */
function evaluateInactivity(lastTripDate) {
  if (!lastTripDate) {
    return { inactive: true, monthsInactive: Infinity };
  }

  const now = new Date();
  const last = lastTripDate instanceof Date ? lastTripDate : new Date(lastTripDate);
  const diffMs = now.getTime() - last.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44); // Approximate months

  return {
    inactive: diffMonths >= INACTIVITY_MONTHS,
    monthsInactive: Math.floor(diffMonths),
  };
}

/**
 * Obtiene el progreso hacia el siguiente nivel.
 * 
 * @param {string} currentTier
 * @param {number} tripsThisMonth
 * @param {number} ratingAvg
 * @returns {{ isMax: boolean, nextTier?: string, tripsProgress: number, ratingProgress: number, tripsRemaining: number, ratingGap: string }}
 */
function getTierProgress(currentTier, tripsThisMonth, ratingAvg) {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  
  if (currentIndex === TIER_ORDER.length - 1) {
    return { isMax: true, currentTier };
  }

  const nextTier = TIER_ORDER[currentIndex + 1];
  const req = TIER_REQUIREMENTS[nextTier];

  return {
    isMax: false,
    currentTier,
    nextTier,
    tripsProgress: Math.min(100, Math.round((tripsThisMonth / req.minTrips) * 100)),
    ratingProgress: Math.min(100, Math.round((ratingAvg / req.minRating) * 100)),
    tripsRemaining: Math.max(0, req.minTrips - tripsThisMonth),
    ratingGap: Math.max(0, req.minRating - ratingAvg).toFixed(1),
  };
}

module.exports = {
  TIER_ORDER,
  TIER_REQUIREMENTS,
  TIER_MULTIPLIERS,
  INACTIVITY_MONTHS,
  evaluatePromotion,
  evaluateDemotion,
  evaluateInactivity,
  getTierProgress,
};
