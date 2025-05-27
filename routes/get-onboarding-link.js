// routes/get-onboarding-link.js

const express = require('express');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const router = express.Router();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.get('/onboarding-url/:uid', async (req, res) => {
  const { uid } = req.params;

  try {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    const stripeAccountId = userDoc.data()?.stripeAccountId;

    if (!stripeAccountId) {
      return res.status(404).json({ error: 'No Stripe account ID found' });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: 'https://dogguz.app/stripe/refresh',
      return_url: 'https://dogguz.app/stripe/return',
      type: 'account_onboarding',
    });

    res.json({ onboardingUrl: accountLink.url });
  } catch (error) {
    console.error('Error creating onboarding link:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
