/**
 * RedemptionService.js — Catálogo de Canjeo de Puntos
 * 
 * Categorías:
 * - Repuestos de motos
 * - Gasolina
 * - Datos móviles
 * - Financiamiento de moto (alto nivel de puntos requerido)
 */

const { pointsToUSD } = require('./PointsCalculator');

/**
 * Catálogo de recompensas disponibles.
 * Los costos están en PUNTOS (10 pts = $1 USD).
 */
const REWARDS_CATALOG = Object.freeze({
  // --- GASOLINA ---
  gasolina_5: {
    id: 'gasolina_5',
    category: 'gasolina',
    name: 'Bono Gasolina $5',
    description: 'Vale por $5 en gasolina en estaciones aliadas',
    pointsCost: 50,
    usdValue: 5,
    icon: '⛽',
    active: true,
  },
  gasolina_10: {
    id: 'gasolina_10',
    category: 'gasolina',
    name: 'Bono Gasolina $10',
    description: 'Vale por $10 en gasolina en estaciones aliadas',
    pointsCost: 100,
    usdValue: 10,
    icon: '⛽',
    active: true,
  },
  gasolina_20: {
    id: 'gasolina_20',
    category: 'gasolina',
    name: 'Bono Gasolina $20',
    description: 'Vale por $20 en gasolina en estaciones aliadas',
    pointsCost: 200,
    usdValue: 20,
    icon: '⛽',
    active: true,
  },

  // --- REPUESTOS DE MOTOS ---
  repuesto_aceite: {
    id: 'repuesto_aceite',
    category: 'repuestos',
    name: 'Cambio de Aceite',
    description: 'Servicio de cambio de aceite en talleres aliados',
    pointsCost: 80,
    usdValue: 8,
    icon: '🔧',
    active: true,
  },
  repuesto_frenos: {
    id: 'repuesto_frenos',
    category: 'repuestos',
    name: 'Kit de Frenos',
    description: 'Pastillas de freno + instalación en talleres aliados',
    pointsCost: 250,
    usdValue: 25,
    icon: '🔧',
    active: true,
  },
  repuesto_caucho: {
    id: 'repuesto_caucho',
    category: 'repuestos',
    name: 'Caucho de Moto',
    description: 'Caucho nuevo + montaje en tiendas aliadas',
    pointsCost: 350,
    usdValue: 35,
    icon: '🏍️',
    active: true,
  },
  repuesto_bateria: {
    id: 'repuesto_bateria',
    category: 'repuestos',
    name: 'Batería de Moto',
    description: 'Batería nueva + instalación',
    pointsCost: 300,
    usdValue: 30,
    icon: '🔋',
    active: true,
  },

  // --- DATOS MÓVILES ---
  datos_1gb: {
    id: 'datos_1gb',
    category: 'datos_moviles',
    name: '1 GB de Datos',
    description: 'Recarga de 1GB de datos móviles',
    pointsCost: 30,
    usdValue: 3,
    icon: '📱',
    active: true,
  },
  datos_3gb: {
    id: 'datos_3gb',
    category: 'datos_moviles',
    name: '3 GB de Datos',
    description: 'Recarga de 3GB de datos móviles',
    pointsCost: 70,
    usdValue: 7,
    icon: '📱',
    active: true,
  },
  datos_5gb: {
    id: 'datos_5gb',
    category: 'datos_moviles',
    name: '5 GB de Datos',
    description: 'Recarga de 5GB de datos móviles',
    pointsCost: 100,
    usdValue: 10,
    icon: '📶',
    active: true,
  },

  // --- FINANCIAMIENTO DE MOTO ---
  moto_descuento_10: {
    id: 'moto_descuento_10',
    category: 'moto_financiada',
    name: 'Descuento 10% en Moto',
    description: 'Aplica 10% de descuento a la cuota inicial de una moto financiada',
    pointsCost: 5000,
    usdValue: 500,
    icon: '🏍️',
    minTier: 'plata',
    active: true,
  },
  moto_descuento_25: {
    id: 'moto_descuento_25',
    category: 'moto_financiada',
    name: 'Descuento 25% en Moto',
    description: 'Aplica 25% de descuento a la cuota inicial de una moto financiada',
    pointsCost: 12500,
    usdValue: 1250,
    icon: '🏍️',
    minTier: 'oro',
    active: true,
  },
  moto_financiada_completa: {
    id: 'moto_financiada_completa',
    category: 'moto_financiada',
    name: 'Moto Financiada 0% Entrada',
    description: 'Acceso a financiamiento de moto sin cuota inicial. Sujeto a evaluación.',
    pointsCost: 25000,
    usdValue: 2500,
    icon: '🏍️✨',
    minTier: 'diamante',
    active: true,
  },
});

/**
 * Obtiene las recompensas disponibles, filtradas por categoría y tier.
 * 
 * @param {string} [category] - Filtro por categoría
 * @param {string} [driverTier] - Tier actual del conductor (para filtrar por minTier)
 * @returns {Array}
 */
function getAvailableRewards(category = null, driverTier = 'bronce') {
  const TIER_LEVEL = { bronce: 0, plata: 1, oro: 2, diamante: 3 };
  const driverLevel = TIER_LEVEL[driverTier] || 0;

  return Object.values(REWARDS_CATALOG)
    .filter(r => r.active)
    .filter(r => !category || r.category === category)
    .filter(r => {
      if (!r.minTier) return true;
      return driverLevel >= (TIER_LEVEL[r.minTier] || 0);
    })
    .sort((a, b) => a.pointsCost - b.pointsCost);
}

/**
 * Valida si un conductor puede canjear una recompensa.
 * 
 * @param {string} rewardId
 * @param {number} currentBalance
 * @param {string} driverTier
 * @returns {{ canRedeem: boolean, reason?: string }}
 */
function validateRedemption(rewardId, currentBalance, driverTier = 'bronce') {
  const reward = REWARDS_CATALOG[rewardId];

  if (!reward) {
    return { canRedeem: false, reason: 'Recompensa no encontrada' };
  }

  if (!reward.active) {
    return { canRedeem: false, reason: 'Recompensa no disponible' };
  }

  if (reward.minTier) {
    const TIER_LEVEL = { bronce: 0, plata: 1, oro: 2, diamante: 3 };
    if ((TIER_LEVEL[driverTier] || 0) < (TIER_LEVEL[reward.minTier] || 0)) {
      return { canRedeem: false, reason: `Requiere nivel ${reward.minTier} o superior` };
    }
  }

  if (currentBalance < reward.pointsCost) {
    return {
      canRedeem: false,
      reason: `Puntos insuficientes: ${currentBalance} / ${reward.pointsCost} requeridos`,
    };
  }

  return { canRedeem: true };
}

module.exports = {
  REWARDS_CATALOG,
  getAvailableRewards,
  validateRedemption,
};
