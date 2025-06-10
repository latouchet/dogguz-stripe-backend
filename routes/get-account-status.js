// routes/get-account-status.js

const express = require('express');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const router = express.Router();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.get('/get-account-status/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const stripeAccountId = userDoc.data()?.stripeAccountId;

    if (!stripeAccountId) {
      return res.status(404).json({ error: 'No Stripe account ID found' });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);

    const status = {
      card_payments: account.capabilities?.card_payments || 'unknown',
      transfers: account.capabilities?.transfers || 'unknown',
      details_submitted: account.details_submitted || false,
      payouts_enabled: account.payouts_enabled || false,
    };

    res.json({ status });
  } catch (error) {
    console.error('Error fetching Stripe account status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
