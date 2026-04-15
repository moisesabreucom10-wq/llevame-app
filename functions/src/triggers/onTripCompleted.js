/**
 * onTripCompleted.js — Firestore Trigger
 * 
 * Se dispara cuando un viaje cambia a status 'completed'.
 * Flujo: Antifraud → Calculate Points → Credit Wallet → Evaluate Promotion
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { validateTripForPoints } = require('../loyalty/AntifraudEngine');
const { creditTripPoints } = require('../loyalty/WalletService');
const { evaluatePromotion, TIER_MULTIPLIERS } = require('../loyalty/TierEngine');

const FieldValue = admin.firestore.FieldValue;

exports.onTripCompleted = functions.firestore
  .document('llevame_trips/{tripId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const tripId = context.params.tripId;

    // Only trigger when status changes TO 'completed'
    if (before.status === 'completed' || after.status !== 'completed') {
      return null;
    }

    const driverId = after.driverId;
    const grossFare = parseFloat(after.fare) || 0;

    if (!driverId || grossFare <= 0) {
      console.log(`[onTripCompleted] Skipping trip ${tripId}: no driver or zero fare`);
      return null;
    }

    console.log(`[onTripCompleted] Processing trip ${tripId} for driver ${driverId}, fare: $${grossFare}`);

    const db = admin.firestore();

    try {
      // === STEP 1: ANTI-FRAUD VALIDATION ===
      const fraudCheck = await validateTripForPoints(after);

      if (!fraudCheck.eligible) {
        console.warn(`[onTripCompleted] Trip ${tripId} BLOCKED by antifraud:`, fraudCheck.flags);

        // Log the blocked attempt for auditing
        await db.collection('points_audit_log').add({
          tripId,
          driverId,
          action: 'BLOCKED',
          flags: fraudCheck.flags,
          grossFare,
          createdAt: FieldValue.serverTimestamp(),
        });

        return null;
      }

      // Log any non-blocking flags
      if (fraudCheck.flags.length > 0) {
        await db.collection('points_audit_log').add({
          tripId,
          driverId,
          action: 'FLAGGED',
          flags: fraudCheck.flags,
          grossFare,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // === STEP 2: GET DRIVER'S CURRENT TIER ===
      const tierRef = db.doc(`driver_tier/${driverId}`);
      const tierSnap = await tierRef.get();

      let currentTier = 'bronce';
      let tripsThisMonth = 0;
      let ratingAvg = 5.0;
      let ratingCount = 0;

      if (tierSnap.exists) {
        const tierData = tierSnap.data();
        currentTier = tierData.currentTier || 'bronce';
        tripsThisMonth = tierData.tripsThisMonth || 0;
        ratingAvg = tierData.ratingAvg || 5.0;
        ratingCount = tierData.ratingCount || 0;
      }

      // === STEP 3: CREDIT POINTS (IDEMPOTENT) ===
      const creditResult = await creditTripPoints(driverId, tripId, grossFare, currentTier);
      console.log(`[onTripCompleted] Credit result:`, creditResult);

      // === STEP 4: INCREMENT TRIP COUNT + UPDATE TIER DOC ===
      const newTripsCount = tripsThisMonth + 1;

      // Calculate new rolling rating average
      const tripRating = after.driverRating || after.rating || null;
      let newRatingAvg = ratingAvg;
      let newRatingCount = ratingCount;

      if (tripRating && typeof tripRating === 'number') {
        newRatingCount = ratingCount + 1;
        newRatingAvg = ((ratingAvg * ratingCount) + tripRating) / newRatingCount;
      }

      const tierUpdateData = {
        driverId,
        currentTier,
        multiplier: TIER_MULTIPLIERS[currentTier] || 1.0,
        tripsThisMonth: newTripsCount,
        ratingAvg: Math.round(newRatingAvg * 100) / 100,
        ratingCount: newRatingCount,
        lastTripAt: FieldValue.serverTimestamp(),
        evaluatedAt: FieldValue.serverTimestamp(),
      };

      // === STEP 5: EVALUATE PROMOTION (IMMEDIATE) ===
      const promoResult = evaluatePromotion(currentTier, newTripsCount, newRatingAvg);

      if (promoResult.action === 'PROMOTE') {
        console.log(`[onTripCompleted] 🎉 PROMOTION: ${driverId} ${currentTier} → ${promoResult.newTier}`);

        tierUpdateData.previousTier = currentTier;
        tierUpdateData.currentTier = promoResult.newTier;
        tierUpdateData.multiplier = TIER_MULTIPLIERS[promoResult.newTier] || 1.0;
        tierUpdateData.promotedAt = FieldValue.serverTimestamp();
        tierUpdateData.promotionReason = promoResult.reason;

        // Log promotion event
        await db.collection('tier_events').add({
          driverId,
          event: 'PROMOTION',
          fromTier: currentTier,
          toTier: promoResult.newTier,
          reason: promoResult.reason,
          tripId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Write tier update (create or merge)
      await tierRef.set(tierUpdateData, { merge: true });

      console.log(`[onTripCompleted] ✅ Trip ${tripId} processed successfully`);
      return { tripId, creditResult, promoResult };

    } catch (err) {
      console.error(`[onTripCompleted] ❌ Error processing trip ${tripId}:`, err);

      // Log error for debugging
      await db.collection('points_audit_log').add({
        tripId,
        driverId,
        action: 'ERROR',
        error: err.message,
        createdAt: FieldValue.serverTimestamp(),
      }).catch(() => {});

      throw err;
    }
  });
