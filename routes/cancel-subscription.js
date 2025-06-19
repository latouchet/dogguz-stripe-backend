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

    const canceled = await stripe.subscriptions.del(stripeSubscriptionId);

    // Actualiza Firestore con estado inactivo y marca la fecha de cancelación
    await userRef.update({
      membershipStatus: 'inactive',
      membershipCancelAt: admin.firestore.Timestamp.now(),
    });

    console.log(`🛑 Subscription ${stripeSubscriptionId} canceled for user ${uid}`);
    res.json({ success: true, canceled });

  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

