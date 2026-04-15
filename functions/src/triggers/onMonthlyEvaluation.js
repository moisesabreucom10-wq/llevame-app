/**
 * onMonthlyEvaluation.js — Cloud Scheduler (Cron)
 * 
 * Se ejecuta el día 1 de cada mes a las 00:05 hora Venezuela (UTC-4).
 * 
 * Responsabilidades:
 * 1. Evaluar descensos de nivel (demotion)
 * 2. Detectar cuentas inactivas (>2 meses) → purgar puntos
 * 3. Resetear contadores mensuales de KPIs
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { evaluateDemotion, evaluateInactivity, TIER_MULTIPLIERS } = require('../loyalty/TierEngine');
const { purgeInactiveWallet } = require('../loyalty/WalletService');

const FieldValue = admin.firestore.FieldValue;

exports.monthlyTierEvaluation = functions.pubsub
  .schedule('5 0 1 * *')          // Día 1 de cada mes, 00:05
  .timeZone('America/Caracas')     // UTC-4
  .onRun(async () => {
    const db = admin.firestore();
    const now = new Date();
    const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    console.log(`[MonthlyEval] Starting evaluation for ${monthLabel}`);

    let promoted = 0;
    let demoted = 0;
    let purged = 0;
    let unchanged = 0;
    let errors = 0;

    try {
      const tierDocs = await db.collection('driver_tier').get();

      console.log(`[MonthlyEval] Evaluating ${tierDocs.size} drivers`);

      // Process in batches of 500 (Firestore batch limit)
      const BATCH_SIZE = 450;
      let batch = db.batch();
      let batchCount = 0;

      for (const tierDoc of tierDocs.docs) {
        try {
          const data = tierDoc.data();
          const driverId = data.driverId || tierDoc.id;

          // === 1. CHECK INACTIVITY (>2 months) ===
          const lastTripDate = data.lastTripAt?.toDate?.() || null;
          const inactivity = evaluateInactivity(lastTripDate);

          if (inactivity.inactive) {
            console.log(`[MonthlyEval] 💀 Driver ${driverId} inactive for ${inactivity.monthsInactive} months. Purging.`);

            const purgeResult = await purgeInactiveWallet(
              driverId,
              `Inactivo por ${inactivity.monthsInactive} meses (último viaje: ${lastTripDate || 'nunca'})`
            );

            if (purgeResult.status === 'purged') {
              purged++;

              // Log purge event
              await db.collection('tier_events').add({
                driverId,
                event: 'INACTIVITY_PURGE',
                pointsPurged: purgeResult.pointsPurged,
                monthsInactive: inactivity.monthsInactive,
                month: monthLabel,
                createdAt: FieldValue.serverTimestamp(),
              });
            }

            // Demote to Bronce if inactive
            if (data.currentTier !== 'bronce') {
              batch.update(tierDoc.ref, {
                previousTier: data.currentTier,
                currentTier: 'bronce',
                multiplier: 1.0,
                demotionReason: `Inactividad: ${inactivity.monthsInactive} meses`,
                evaluatedAt: FieldValue.serverTimestamp(),
                tripsThisMonth: 0,
              });
              demoted++;
            }

            batchCount++;
            if (batchCount >= BATCH_SIZE) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
            continue;
          }

          // === 2. EVALUATE DEMOTION ===
          const demotionResult = evaluateDemotion(
            data.currentTier,
            data.tripsThisMonth || 0,
            data.ratingAvg || 5.0
          );

          if (demotionResult.action === 'DEMOTE') {
            console.log(`[MonthlyEval] ⬇️ Demotion: ${driverId} ${data.currentTier} → ${demotionResult.newTier}`);

            batch.update(tierDoc.ref, {
              previousTier: data.currentTier,
              currentTier: demotionResult.newTier,
              multiplier: TIER_MULTIPLIERS[demotionResult.newTier] || 1.0,
              demotionReason: demotionResult.reason,
              evaluatedAt: FieldValue.serverTimestamp(),
            });

            // Log demotion event
            await db.collection('tier_events').add({
              driverId,
              event: 'DEMOTION',
              fromTier: data.currentTier,
              toTier: demotionResult.newTier,
              reason: demotionResult.reason,
              month: monthLabel,
              createdAt: FieldValue.serverTimestamp(),
            });

            demoted++;
          } else {
            unchanged++;
          }

          // === 3. RESET MONTHLY KPIs ===
          batch.update(tierDoc.ref, {
            tripsLastMonth: data.tripsThisMonth || 0,
            tripsThisMonth: 0,
            ratingCount: 0,
            // ratingAvg is preserved (rolling lifetime average)
            evaluatedAt: FieldValue.serverTimestamp(),
          });

          batchCount++;
          if (batchCount >= BATCH_SIZE) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }

        } catch (err) {
          console.error(`[MonthlyEval] Error evaluating driver ${tierDoc.id}:`, err);
          errors++;
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }

      const summary = { month: monthLabel, total: tierDocs.size, demoted, purged, unchanged, errors };
      console.log(`[MonthlyEval] ✅ Complete:`, summary);

      // Save evaluation report
      await db.collection('monthly_eval_reports').add({
        ...summary,
        createdAt: FieldValue.serverTimestamp(),
      });

      return summary;

    } catch (err) {
      console.error('[MonthlyEval] ❌ Fatal error:', err);
      throw err;
    }
  });
