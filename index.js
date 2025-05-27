// stripe_backend_node/index.js

const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// 1. Crear PaymentIntent (captura manual)
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, providerStripeAccountId, applicationFee, paymentMethodId } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      capture_method: 'manual',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: providerStripeAccountId,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Capturar pago cuando proveedor acepta
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

// 3. Cancelar pago si proveedor rechaza o dueño cancela
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

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
