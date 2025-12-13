// Cloud Functions para LLEVAME
// Envía push notifications automáticamente

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Inicializar Firebase Admin
initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// Función para enviar notificación push
async function sendPushNotification(userId, title, body, data = {}) {
    if (!userId) return;

    try {
        // Obtener el token del usuario
        const tokenDoc = await db.collection('user_tokens').doc(userId).get();

        if (!tokenDoc.exists) {
            console.log(`No token found for user ${userId}`);
            return;
        }

        const token = tokenDoc.data().token;
        if (!token) {
            console.log(`Token is null for user ${userId}`);
            return;
        }

        // Enviar notificación
        const message = {
            notification: {
                title: title,
                body: body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'trips',
                    priority: 'high',
                    defaultSound: true,
                    defaultVibrateTimings: true
                }
            },
            token: token
        };

        const response = await messaging.send(message);
        console.log(`Push sent to ${userId}:`, response);
        return response;
    } catch (error) {
        console.error(`Error sending push to ${userId}:`, error);
        // Si el token es inválido, eliminarlo
        if (error.code === 'messaging/registration-token-not-registered') {
            await db.collection('user_tokens').doc(userId).update({ token: null });
        }
    }
}

// ===========================================
// TRIGGER: Nuevo viaje solicitado
// Notifica a TODOS los conductores online
// ===========================================
exports.onNewTripRequest = onDocumentCreated('llevame_trips/{tripId}', async (event) => {
    const trip = event.data.data();

    if (trip.status !== 'requested') return;

    console.log('New trip requested:', event.params.tripId);

    try {
        // Obtener todos los conductores online
        const driversSnapshot = await db.collection('online_drivers')
            .where('status', 'in', ['online'])
            .get();

        if (driversSnapshot.empty) {
            console.log('No online drivers found');
            return;
        }

        // Enviar notificación a cada conductor
        const promises = driversSnapshot.docs.map(async (driverDoc) => {
            const driverId = driverDoc.id;
            const pickup = trip.pickup?.address || 'Ubicación cercana';
            const fare = trip.fare || '0';

            return sendPushNotification(
                driverId,
                '🚗 ¡Nuevo viaje disponible!',
                `Recogida: ${pickup} • $${fare}`,
                { type: 'new_ride', tripId: event.params.tripId }
            );
        });

        await Promise.all(promises);
        console.log(`Notified ${promises.length} drivers`);
    } catch (error) {
        console.error('Error notifying drivers:', error);
    }
});

// ===========================================
// TRIGGER: Viaje actualizado (aceptado, en curso, completado, conductor cerca)
// ===========================================
exports.onTripStatusChange = onDocumentUpdated('llevame_trips/{tripId}', async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const tripId = event.params.tripId;

    try {
        // ========== CONDUCTOR ACEPTÓ EL VIAJE ==========
        if (before.status === 'requested' && after.status === 'accepted') {
            console.log(`Trip ${tripId}: Conductor aceptó`);

            const driverName = after.driverName || 'Tu conductor';
            const vehicle = after.driverVehicle || '';

            await sendPushNotification(
                after.riderId,
                '🎉 ¡Conductor en camino!',
                `${driverName} aceptó tu viaje. ${vehicle}`,
                { type: 'driver_accepted', tripId }
            );
        }

        // ========== CONDUCTOR ESTÁ CERCA (driverNearby flag) ==========
        if (!before.driverNearby && after.driverNearby === true) {
            console.log(`Trip ${tripId}: Conductor está cerca`);

            await sendPushNotification(
                after.riderId,
                '📍 ¡Tu conductor está cerca!',
                `${after.driverName || 'El conductor'} llegará en menos de 1 minuto`,
                { type: 'driver_nearby', tripId }
            );
        }

        // ========== CONDUCTOR LLEGÓ ==========
        if (!before.driverArrived && after.driverArrived === true) {
            console.log(`Trip ${tripId}: Conductor llegó`);

            await sendPushNotification(
                after.riderId,
                '🚗 ¡Tu conductor llegó!',
                `${after.driverName || 'El conductor'} te está esperando`,
                { type: 'driver_arrived', tripId }
            );
        }

        // ========== VIAJE INICIADO ==========
        if (before.status === 'accepted' && after.status === 'in_progress') {
            console.log(`Trip ${tripId}: Viaje iniciado`);

            await sendPushNotification(
                after.riderId,
                '🚗 ¡Viaje iniciado!',
                'Tu viaje ha comenzado. ¡Disfruta el trayecto!',
                { type: 'trip_started', tripId }
            );
        }

        // ========== VIAJE COMPLETADO ==========
        if (after.status === 'completed' && before.status !== 'completed') {
            console.log(`Trip ${tripId}: Viaje completado`);

            const fare = after.fare || '0';

            // Notificar al pasajero
            await sendPushNotification(
                after.riderId,
                '✅ ¡Viaje completado!',
                `Gracias por viajar con LLEVAME. Total: $${fare}`,
                { type: 'trip_completed', tripId }
            );

            // Notificar al conductor
            await sendPushNotification(
                after.driverId,
                '✅ ¡Viaje completado!',
                `Has ganado $${fare}. ¡Buen trabajo!`,
                { type: 'trip_completed', tripId }
            );
        }

        // ========== VIAJE CANCELADO ==========
        if (after.status === 'cancelled' && before.status !== 'cancelled') {
            console.log(`Trip ${tripId}: Viaje cancelado`);

            const cancelledBy = after.cancelledBy;

            if (cancelledBy === after.riderId && after.driverId) {
                // Pasajero canceló -> Notificar al conductor
                await sendPushNotification(
                    after.driverId,
                    '❌ Viaje cancelado',
                    'El pasajero ha cancelado el viaje.',
                    { type: 'trip_cancelled', tripId }
                );
            } else if (cancelledBy === after.driverId) {
                // Conductor canceló -> Notificar al pasajero
                await sendPushNotification(
                    after.riderId,
                    '❌ Viaje cancelado',
                    'El conductor ha cancelado. Busca otro conductor.',
                    { type: 'trip_cancelled', tripId }
                );
            }
        }
    } catch (error) {
        console.error('Error processing trip update:', error);
    }
});

// ===========================================
// TRIGGER: Nuevo mensaje en el chat
// ===========================================
exports.onNewMessage = onDocumentCreated('llevame_trips/{tripId}/messages/{messageId}', async (event) => {
    const message = event.data.data();
    const tripId = event.params.tripId;

    console.log(`New message in trip ${tripId}`);

    try {
        // Obtener el viaje para saber quién es el destinatario
        const tripDoc = await db.collection('llevame_trips').doc(tripId).get();

        if (!tripDoc.exists) return;

        const trip = tripDoc.data();
        const senderId = message.senderId;

        // Determinar el destinatario
        const recipientId = senderId === trip.riderId ? trip.driverId : trip.riderId;

        if (!recipientId) return;

        const senderName = message.senderName || 'Nuevo mensaje';
        const messagePreview = (message.text || '').substring(0, 50);

        await sendPushNotification(
            recipientId,
            `💬 ${senderName}`,
            messagePreview,
            { type: 'message', tripId }
        );
    } catch (error) {
        console.error('Error processing new message:', error);
    }
});
