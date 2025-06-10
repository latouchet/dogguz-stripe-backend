// routes/get-onboarding-link.js

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/get-onboarding-link', async (req, res) => {
  const { stripeAccountId } = req.body;

  if (!stripeAccountId) {
    return res.status(400).json({ error: 'Missing stripeAccountId' });
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: 'https://dogguz.app/stripe/refresh',
      return_url: 'https://dogguz.app/stripe/return',
      type: 'account_onboarding',
    });

    console.log(`✅ Onboarding link generated for ${stripeAccountId}: ${accountLink.url}`);

    res.json({
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error('Error generating onboarding link:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

