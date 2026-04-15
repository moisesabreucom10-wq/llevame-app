/**
 * Cloud Functions Entry Point — Llevame Loyalty & Rewards Engine
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

// Initialize Firebase Admin SDK
admin.initializeApp();

// === FIRESTORE TRIGGERS ===
const { onTripCompleted } = require('./src/triggers/onTripCompleted');
exports.onTripCompleted = onTripCompleted;

// === SCHEDULED FUNCTIONS ===
const { monthlyTierEvaluation } = require('./src/triggers/onMonthlyEvaluation');
exports.monthlyTierEvaluation = monthlyTierEvaluation;

// === HTTP API ===
const { redeemPoints } = require('./src/loyalty/WalletService');
const { getAvailableRewards, validateRedemption, REWARDS_CATALOG } = require('./src/loyalty/RedemptionService');
const { getTierProgress } = require('./src/loyalty/TierEngine');

/**
 * GET /api/wallet/{driverId}
 * Returns wallet balance, tier info, and progress toward next tier.
 */
exports.getWalletInfo = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const driverId = data.driverId || context.auth.uid;
  const db = admin.firestore();

  const [walletSnap, tierSnap] = await Promise.all([
    db.doc(`driver_wallet/${driverId}`).get(),
    db.doc(`driver_tier/${driverId}`).get(),
  ]);

  const wallet = walletSnap.exists ? walletSnap.data() : { balance: 0, lifetimeEarned: 0, lifetimeRedeemed: 0, lifetimeExpired: 0 };
  const tier = tierSnap.exists ? tierSnap.data() : { currentTier: 'bronce', tripsThisMonth: 0, ratingAvg: 5.0 };

  const progress = getTierProgress(tier.currentTier, tier.tripsThisMonth || 0, tier.ratingAvg || 5.0);

  return {
    wallet: {
      balance: wallet.balance || 0,
      balanceUSD: (wallet.balance || 0) / 10,
      lifetimeEarned: wallet.lifetimeEarned || 0,
      lifetimeRedeemed: wallet.lifetimeRedeemed || 0,
      lifetimeExpired: wallet.lifetimeExpired || 0,
    },
    tier: {
      current: tier.currentTier || 'bronce',
      multiplier: tier.multiplier || 1.0,
      tripsThisMonth: tier.tripsThisMonth || 0,
      ratingAvg: tier.ratingAvg || 5.0,
    },
    progress,
  };
});

/**
 * GET /api/rewards
 * Returns the rewards catalog filtered by category and driver tier.
 */
exports.getRewardsCatalog = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const driverId = context.auth.uid;
  const category = data.category || null;

  // Get driver tier
  const tierSnap = await admin.firestore().doc(`driver_tier/${driverId}`).get();
  const driverTier = tierSnap.exists ? tierSnap.data().currentTier : 'bronce';

  const rewards = getAvailableRewards(category, driverTier);

  return { rewards, driverTier };
});

/**
 * POST /api/redeem
 * Redeems a reward from the catalog.
 */
exports.redeemReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const driverId = context.auth.uid;
  const { rewardId } = data;

  if (!rewardId) {
    throw new functions.https.HttpsError('invalid-argument', 'rewardId is required');
  }

  const reward = REWARDS_CATALOG[rewardId];
  if (!reward) {
    throw new functions.https.HttpsError('not-found', 'Reward not found');
  }

  // Get current wallet balance and tier
  const db = admin.firestore();
  const [walletSnap, tierSnap] = await Promise.all([
    db.doc(`driver_wallet/${driverId}`).get(),
    db.doc(`driver_tier/${driverId}`).get(),
  ]);

  const currentBalance = walletSnap.exists ? walletSnap.data().balance : 0;
  const driverTier = tierSnap.exists ? tierSnap.data().currentTier : 'bronce';

  // Validate redemption
  const validation = validateRedemption(rewardId, currentBalance, driverTier);
  if (!validation.canRedeem) {
    throw new functions.https.HttpsError('failed-precondition', validation.reason);
  }

  // Execute redemption
  const redemptionId = `${driverId}_${rewardId}_${Date.now()}`;
  const result = await redeemPoints(
    driverId,
    reward.pointsCost,
    reward.category,
    { rewardId, rewardName: reward.name, usdValue: reward.usdValue },
    redemptionId
  );

  // Create redemption record for admin tracking
  await db.collection('redemptions').add({
    driverId,
    rewardId,
    rewardName: reward.name,
    category: reward.category,
    pointsCost: reward.pointsCost,
    usdValue: reward.usdValue,
    status: 'pending_fulfillment', // Admin needs to fulfill (deliver gas, data, etc.)
    redemptionId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    ...result,
    rewardName: reward.name,
    message: `Has canjeado "${reward.name}" por ${reward.pointsCost} puntos`,
  };
});

/**
 * GET /api/history
 * Returns transaction history for a driver.
 */
exports.getPointsHistory = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const driverId = context.auth.uid;
  const limitCount = Math.min(data.limit || 20, 100);

  const historySnap = await admin.firestore()
    .collection('points_ledger')
    .where('driverId', '==', driverId)
    .where('amount', '>', 0)
    .orderBy('amount')
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();

  const history = historySnap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      type: d.type,
      amount: d.amount,
      tripId: d.tripId || null,
      metadata: d.metadata || {},
      createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
    };
  });

  return { history, total: history.length };
});
