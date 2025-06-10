const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const admin = require('firebase-admin');

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let adminConfig;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  console.log('🔥 Initializing Firebase Admin with GOOGLE_CREDENTIALS_JSON');
  adminConfig = admin.credential.cert(JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON));
} else {
  console.log('🔥 Initializing Firebase Admin with service-account.json file');
  const serviceAccountPath = path.resolve(__dirname, 'service-account.json');
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  adminConfig = admin.credential.cert(serviceAccount);
}

admin.initializeApp({
  credential: adminConfig,
});

const createStripeAccount = require('./routes/create-stripe-account');
const getOnboardingLink = require('./routes/get-onboarding-link');
const getUidByStripeAccount = require('./routes/get-uid-by-stripe-account');
const getAccountStatus = require('./routes/get-account-status');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
console.log("🔐 Stripe secret key in use:", process.env.STRIPE_SECRET_KEY);


app.use(cors());
app.use(express.json());
app.use('/', createStripeAccount);
app.use('/', getOnboardingLink);
app.use('/', getUidByStripeAccount);
app.use('/', getAccountStatus);

// Crear PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, providerStripeAccountId, applicationFee } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      capture_method: 'manual',
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: providerStripeAccountId,
      },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Capturar pago
app.post('/capture-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
    res.json({ success: true, paymentIntent });
  } catch (error) {
    console.error('Error capturing payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancelar pago
app.post('/cancel-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    res.json({ success: true, paymentIntent });
  } catch (error) {
    console.error('Error canceling payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crear PaymentIntent para QR Tag (pago directo sin Stripe Connect)
app.post('/create-qr-payment', async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Missing or invalid amount' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: parseInt(amount), // en centavos
      currency: 'usd',
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('❌ Error creating PaymentIntent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

