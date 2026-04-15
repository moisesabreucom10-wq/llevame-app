/**
 * LoyaltyService.js — Frontend service for Loyalty & Rewards Engine
 * 
 * Provides realtime listeners for wallet, tier, and transaction history.
 * Uses Firestore onSnapshot for live updates.
 */

import { db } from './firebase';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';

// Tier configuration (must match backend)
export const TIER_CONFIG = Object.freeze({
  bronce:   { multiplier: 1.0, minTrips: 0,   minRating: 0.0, label: 'Bronce',   color: '#CD7F32', icon: '🥉' },
  plata:    { multiplier: 1.2, minTrips: 50,  minRating: 4.7, label: 'Plata',    color: '#C0C0C0', icon: '🥈' },
  oro:      { multiplier: 1.5, minTrips: 120, minRating: 4.8, label: 'Oro',      color: '#FFD700', icon: '🥇' },
  diamante: { multiplier: 2.0, minTrips: 250, minRating: 4.9, label: 'Diamante', color: '#B9F2FF', icon: '💎' },
});

export const TIER_ORDER = ['bronce', 'plata', 'oro', 'diamante'];

const POINTS_PER_DOLLAR = 10;

class LoyaltyService {
  /**
   * Subscribe to realtime wallet updates.
   * @param {string} driverId
   * @param {function} callback - Receives wallet data or null
   * @returns {function} Unsubscribe function
   */
  subscribeToWallet(driverId, callback) {
    return onSnapshot(
      doc(db, 'driver_wallet', driverId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          callback({
            ...data,
            balanceUSD: (data.balance || 0) / POINTS_PER_DOLLAR,
          });
        } else {
          callback({ balance: 0, balanceUSD: 0, lifetimeEarned: 0, lifetimeRedeemed: 0, lifetimeExpired: 0 });
        }
      },
      (err) => {
        console.error('[LoyaltyService] Wallet listener error:', err);
        callback(null);
      }
    );
  }

  /**
   * Subscribe to realtime tier updates.
   * @param {string} driverId
   * @param {function} callback - Receives tier data or default
   * @returns {function} Unsubscribe function
   */
  subscribeToTier(driverId, callback) {
    return onSnapshot(
      doc(db, 'driver_tier', driverId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const tierInfo = TIER_CONFIG[data.currentTier] || TIER_CONFIG.bronce;
          callback({
            ...data,
            ...tierInfo,
          });
        } else {
          callback({
            currentTier: 'bronce',
            tripsThisMonth: 0,
            ratingAvg: 5.0,
            ...TIER_CONFIG.bronce,
          });
        }
      },
      (err) => {
        console.error('[LoyaltyService] Tier listener error:', err);
      }
    );
  }

  /**
   * Subscribe to transaction history (positive entries only).
   * @param {string} driverId
   * @param {number} limitCount
   * @param {function} callback
   * @returns {function} Unsubscribe function
   */
  subscribeToHistory(driverId, limitCount = 20, callback) {
    const q = query(
      collection(db, 'points_ledger'),
      where('driverId', '==', driverId),
      where('amount', '>', 0),
      orderBy('amount'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(
      q,
      (snap) => {
        const history = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || null,
        }));
        callback(history);
      },
      (err) => {
        console.error('[LoyaltyService] History listener error:', err);
        callback([]);
      }
    );
  }

  /**
   * Calculate progress toward next tier.
   * @param {object} tierData
   * @returns {object}
   */
  getProgress(tierData) {
    if (!tierData) return { isMax: false, nextTier: 'plata', tripsProgress: 0, ratingProgress: 0, tripsRemaining: 50, ratingGap: '4.7' };

    const currentIndex = TIER_ORDER.indexOf(tierData.currentTier || 'bronce');

    if (currentIndex === TIER_ORDER.length - 1) {
      return { isMax: true, currentTier: tierData.currentTier };
    }

    const nextTier = TIER_ORDER[currentIndex + 1];
    const req = TIER_CONFIG[nextTier];
    const trips = tierData.tripsThisMonth || 0;
    const rating = tierData.ratingAvg || 5.0;

    return {
      isMax: false,
      currentTier: tierData.currentTier,
      nextTier,
      nextTierLabel: req.label,
      nextTierIcon: req.icon,
      tripsProgress: Math.min(100, Math.round((trips / req.minTrips) * 100)),
      ratingProgress: Math.min(100, Math.round((rating / req.minRating) * 100)),
      tripsRemaining: Math.max(0, req.minTrips - trips),
      tripsRequired: req.minTrips,
      ratingGap: Math.max(0, req.minRating - rating).toFixed(1),
      ratingRequired: req.minRating,
    };
  }

  /**
   * Convert points to USD display string.
   */
  pointsToUSD(points) {
    return (points / POINTS_PER_DOLLAR).toFixed(2);
  }
}

export const loyaltyService = new LoyaltyService();
export default loyaltyService;
