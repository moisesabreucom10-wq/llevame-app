/**
 * WalletService.js — Atomic Wallet Transactions with Double-Entry Bookkeeping
 * 
 * Every point movement creates an IMMUTABLE ledger entry.
 * Idempotency keys prevent duplicate credits from network retries.
 */

const admin = require('firebase-admin');
const { calculatePoints } = require('./PointsCalculator');

const db = () => admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// Account names for double-entry
const ACCOUNTS = Object.freeze({
  SYSTEM_ISSUANCE: 'SYSTEM_ISSUANCE',   // Source of points
  DRIVER_WALLET: 'DRIVER_WALLET',        // Driver's balance
  REDEMPTION_SINK: 'REDEMPTION_SINK',    // Where redeemed points go
  EXPIRY_SINK: 'EXPIRY_SINK',            // Where purged points go (inactivity)
  BONUS_SOURCE: 'BONUS_SOURCE',          // Promotional bonuses
});

/**
 * Credits trip points to a driver's wallet. IDEMPOTENT.
 * 
 * @param {string} driverId
 * @param {string} tripId
 * @param {number} grossFare - Fare before commissions
 * @param {string} tier - Driver's current tier
 * @returns {Promise<{ status: string, totalPoints?: number }>}
 */
async function creditTripPoints(driverId, tripId, grossFare, tier) {
  const firestore = db();
  const idempotencyKey = `earn_trip_${tripId}`;

  // 1. IDEMPOTENCY CHECK
  const existing = await firestore.collection('points_ledger')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { status: 'already_processed', tripId };
  }

  // 2. CALCULATE
  const calc = calculatePoints(grossFare, tier);
  if (calc.totalPoints <= 0) {
    return { status: 'zero_points', grossFare, tier };
  }

  const transactionGroupId = `txn_earn_${tripId}_${Date.now()}`;

  // 3. ATOMIC TRANSACTION
  return firestore.runTransaction(async (txn) => {
    const walletRef = firestore.doc(`driver_wallet/${driverId}`);
    const walletSnap = await txn.get(walletRef);

    // Create wallet if doesn't exist
    if (!walletSnap.exists) {
      txn.set(walletRef, {
        driverId,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeRedeemed: 0,
        lifetimeExpired: 0,
        createdAt: FieldValue.serverTimestamp(),
        lastTransactionAt: FieldValue.serverTimestamp(),
      });
    }

    // CREDIT ENTRY — Points flow INTO driver wallet
    const creditRef = firestore.collection('points_ledger').doc();
    txn.set(creditRef, {
      transactionGroupId,
      driverId,
      type: 'TRIP_EARN',
      debitAccount: ACCOUNTS.SYSTEM_ISSUANCE,
      creditAccount: ACCOUNTS.DRIVER_WALLET,
      amount: calc.totalPoints,
      tripId,
      idempotencyKey,
      metadata: {
        grossFare,
        tierAtTransaction: tier,
        multiplier: calc.multiplier,
        basePoints: calc.basePoints,
        bonusPoints: calc.bonusPoints,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    // UPDATE wallet balance
    txn.update(walletRef, {
      balance: FieldValue.increment(calc.totalPoints),
      lifetimeEarned: FieldValue.increment(calc.totalPoints),
      lastTransactionAt: FieldValue.serverTimestamp(),
    });

    return {
      status: 'credited',
      totalPoints: calc.totalPoints,
      basePoints: calc.basePoints,
      bonusPoints: calc.bonusPoints,
      multiplier: calc.multiplier,
      tier,
    };
  });
}

/**
 * Redeems points from a driver's wallet. IDEMPOTENT.
 * Points are consumed (removed from balance) upon redemption.
 * 
 * @param {string} driverId
 * @param {number} pointsToRedeem
 * @param {string} redemptionType - 'repuestos' | 'gasolina' | 'moto_financiada' | 'datos_moviles'
 * @param {object} redemptionDetails - Details about the reward
 * @param {string} redemptionId - Unique ID for this redemption request
 * @returns {Promise<{ status: string }>}
 */
async function redeemPoints(driverId, pointsToRedeem, redemptionType, redemptionDetails, redemptionId) {
  const firestore = db();
  const idempotencyKey = `redeem_${redemptionId}`;

  // Idempotency check
  const existing = await firestore.collection('points_ledger')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { status: 'already_processed', redemptionId };
  }

  if (pointsToRedeem <= 0) {
    return { status: 'invalid_amount' };
  }

  const transactionGroupId = `txn_redeem_${redemptionId}_${Date.now()}`;

  return firestore.runTransaction(async (txn) => {
    const walletRef = firestore.doc(`driver_wallet/${driverId}`);
    const walletSnap = await txn.get(walletRef);

    if (!walletSnap.exists) {
      throw new Error('Wallet not found');
    }

    const currentBalance = walletSnap.data().balance || 0;

    if (currentBalance < pointsToRedeem) {
      throw new Error(`Insufficient balance: ${currentBalance} < ${pointsToRedeem}`);
    }

    // DEBIT ENTRY — Points flow OUT of driver wallet
    const debitRef = firestore.collection('points_ledger').doc();
    txn.set(debitRef, {
      transactionGroupId,
      driverId,
      type: 'REDEMPTION',
      debitAccount: ACCOUNTS.DRIVER_WALLET,
      creditAccount: ACCOUNTS.REDEMPTION_SINK,
      amount: pointsToRedeem,
      idempotencyKey,
      metadata: {
        redemptionType,
        redemptionDetails,
        usdValue: pointsToRedeem / 10,
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    // UPDATE wallet — deduct points
    txn.update(walletRef, {
      balance: FieldValue.increment(-pointsToRedeem),
      lifetimeRedeemed: FieldValue.increment(pointsToRedeem),
      lastTransactionAt: FieldValue.serverTimestamp(),
    });

    return {
      status: 'redeemed',
      pointsRedeemed: pointsToRedeem,
      usdValue: pointsToRedeem / 10,
      redemptionType,
      newBalance: currentBalance - pointsToRedeem,
    };
  });
}

/**
 * Purges ALL points from an inactive driver's wallet.
 * Called when a driver has been inactive for >2 months.
 * 
 * @param {string} driverId
 * @param {string} reason - Why the purge happened
 * @returns {Promise<{ status: string, pointsPurged: number }>}
 */
async function purgeInactiveWallet(driverId, reason) {
  const firestore = db();
  const idempotencyKey = `purge_${driverId}_${new Date().toISOString().slice(0, 7)}`; // Monthly granularity

  const existing = await firestore.collection('points_ledger')
    .where('idempotencyKey', '==', idempotencyKey)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { status: 'already_purged' };
  }

  return firestore.runTransaction(async (txn) => {
    const walletRef = firestore.doc(`driver_wallet/${driverId}`);
    const walletSnap = await txn.get(walletRef);

    if (!walletSnap.exists) {
      return { status: 'no_wallet', pointsPurged: 0 };
    }

    const balance = walletSnap.data().balance || 0;

    if (balance <= 0) {
      return { status: 'zero_balance', pointsPurged: 0 };
    }

    // PURGE ENTRY
    const purgeRef = firestore.collection('points_ledger').doc();
    txn.set(purgeRef, {
      transactionGroupId: `txn_purge_${driverId}_${Date.now()}`,
      driverId,
      type: 'INACTIVITY_PURGE',
      debitAccount: ACCOUNTS.DRIVER_WALLET,
      creditAccount: ACCOUNTS.EXPIRY_SINK,
      amount: balance,
      idempotencyKey,
      metadata: { reason, previousBalance: balance },
      createdAt: FieldValue.serverTimestamp(),
    });

    txn.update(walletRef, {
      balance: 0,
      lifetimeExpired: FieldValue.increment(balance),
      lastTransactionAt: FieldValue.serverTimestamp(),
    });

    return { status: 'purged', pointsPurged: balance };
  });
}

module.exports = {
  ACCOUNTS,
  creditTripPoints,
  redeemPoints,
  purgeInactiveWallet,
};
