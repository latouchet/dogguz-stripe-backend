const express = require('express');
const admin = require('firebase-admin');
const Stripe = require('stripe');
const router = express.Router();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-stripe-account', async (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.status(400).json({ error: 'UID is required' });

  try {
    // 1. Crear cuenta express en Stripe
    const account = await stripe.accounts.create({ type: 'express' });

    // 2. Guardar el account.id en Firestore
    await admin.firestore().collection('users').doc(uid).update({
      stripeAccountId: account.id,
    });

    // 3. Crear link de onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: 'https://dogguz.app/stripe/refresh', // Cambia esto por tu URL real
      return_url: 'https://dogguz.app/stripe/return',   // Cambia esto por tu URL real
      type: 'account_onboarding',
    });

    res.json({ onboardingUrl: accountLink.url });
  } catch (error) {
    console.error('Stripe account error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

