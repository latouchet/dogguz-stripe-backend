const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/get-account-status', async (req, res) => {
  const { stripeAccountId } = req.body;

  if (!stripeAccountId) {
    return res.status(400).json({ error: 'Missing stripeAccountId' });
  }

  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);

    console.log(`✅ Stripe account status for ${stripeAccountId}: details_submitted = ${account.details_submitted}`);

    res.json({
      details_submitted: account.details_submitted,
    });
  } catch (error) {
    console.error('Error getting Stripe account status:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

