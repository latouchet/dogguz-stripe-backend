// capture-due-payments.js (adaptado final)

const express = require('express');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const router = express.Router();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/capture-due-payments', async (req, res) => {
  try {
    console.log('🕒 Running /capture-due-payments cron job...');
    console.log(`📍 Request received from IP: ${req.headers['x-forwarded-for'] || req.connection.remoteAddress}`);
    console.log(`📍 Headers:`, req.headers);

    const now = admin.firestore.Timestamp.now();

    const snapshot = await admin.firestore().collection('reservations')
      .where('paymentStatus', '==', 'paid')
      .where('paymentCaptured', '!=', true)
      .get();

    let capturedCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id = doc.id;

      // Validaciones
      if (!data.checkinPhotoUrl || !data.checkoutPhotoUrl) {
        console.log(`⏭️ Skipping reservation ${id} → missing check-in/out`);
        continue;
      }

      const paymentAvailableAt = data.paymentAvailableAt?.toDate
        ? data.paymentAvailableAt.toDate()
        : new Date(data.paymentAvailableAt);

      if (now.toDate() < paymentAvailableAt) {
        console.log(`⏭️ Skipping reservation ${id} → paymentAvailableAt not reached yet (${paymentAvailableAt})`);
        continue;
      }

      if (data.disputeFiled) {
        console.log(`⏭️ Skipping reservation ${id} → active dispute`);
        continue;
      }

      const paymentIntentId = data.paymentIntentId;
      if (!paymentIntentId) {
        console.log(`⚠️ Reservation ${id} missing paymentIntentId`);
        continue;
      }

      try {
        console.log(`🚀 Capturing payment for reservation ${id} (PaymentIntent: ${paymentIntentId})...`);

        await stripe.paymentIntents.capture(paymentIntentId);

        await admin.firestore().collection('reservations').doc(id).update({
          paymentCaptured: true,
          paymentCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Payment captured for reservation ${id}`);
        capturedCount++;
      } catch (err) {
        console.error(`❌ Error capturing payment for reservation ${id}:`, err.message);
      }
    }

    console.log(`🏁 Finished capture-due-payments. Total captured: ${capturedCount}`);
    res.json({ success: true, capturedPayments: capturedCount });
  } catch (err) {
    console.error('❌ Error in /capture-due-payments:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

