const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Ruta POST para cancelar la suscripción desde Flutter
router.post('/cancel-subscription', async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ error: 'Missing subscriptionId' });
    }

    const canceled = await stripe.subscriptions.del(subscriptionId);

    console.log(`🛑 Subscription ${subscriptionId} canceled successfully.`);
    res.json({ success: true, canceled });
  } catch (error) {
    console.error('❌ Error canceling subscription:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
