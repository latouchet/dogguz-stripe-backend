const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const admin = require('firebase-admin');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Ruta POST para cancelar la suscripción por UID
router.post('/cancel-subscription', async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }

    const userRef = admin.firestore().collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { stripeSubscriptionId } = userDoc.data();

    if (!stripeSubscriptionId) {
      return res.status(400).json({ error: 'Missing subscription ID in user data' });
    }

    // Cancelar la suscripción en Stripe
    const canceled = await stripe.subscriptions.del(stripeSubscriptionId);

    // Obtener el final del periodo de facturación
    const periodEndUnix = canceled.current_period_end;

    if (typeof periodEndUnix !== 'number' || isNaN(periodEndUnix)) {
      console.warn(`⚠️ Invalid period_end for subscription ${stripeSubscriptionId}`);
      return res.status(500).json({ error: 'Invalid period_end returned from Stripe' });
    }

    const periodEndDate = new Date(periodEndUnix * 1000); // convertir a Date

    // ✅ No cambiar membershipStatus aquí
    await userRef.update({
      membershipCancelAt: admin.firestore.Timestamp.fromDate(periodEndDate),
    });

    const isoDate = periodEndDate.toISOString();
    console.log(`🗓️ Subscription will remain active until ${isoDate} for user ${uid}`);
    console.log(`🛑 Stripe subscription ${stripeSubscriptionId} canceled for user ${uid}`);

    res.json({ success: true, canceled });
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

