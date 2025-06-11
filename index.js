const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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
const captureDuePayments = require('./routes/capture-due-payments');
const sendReservationReceiptEmail = require('./routes/sendReservationReceiptEmail');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
console.log("🔐 Stripe secret key in use:", process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

// Rutas "modulares"
app.use('/', createStripeAccount);
app.use('/', getOnboardingLink);
app.use('/', getUidByStripeAccount);
app.use('/', getAccountStatus);
app.use('/', captureDuePayments); // << ESTE ES TU CRON! ✅

// Crear PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, providerStripeAccountId, applicationFee, reservationId } = req.body;

    console.log('📢 Request data:', req.body);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      capture_method: 'manual',
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: providerStripeAccountId,
      },
    });

    if (reservationId) {
      const reservationRef = admin.firestore().collection('reservations').doc(reservationId);

      await reservationRef.update({
        paymentStatus: 'paid',
        paymentIntentId: paymentIntent.id,
        paymentPaidAt: admin.firestore.FieldValue.serverTimestamp(),
      });     
      console.log(`✅ Reservation ${reservationId} updated with paymentStatus = 'paid'`);
      // Leer la reserva completa
	const reservationSnap = await reservationRef.get();
	const reservation = reservationSnap.data();

	try {
	  await sendReservationReceiptEmail({
	    ownerEmail: reservation.ownerEmail,
	    ownerName: reservation.ownerName,
	    providerName: reservation.providerName,
	    selectedService: reservation.selectedService,
	    startDate: reservation.startDate,
	    endDate: reservation.endDate,
	    startTime: reservation.startTime,
	    endTime: reservation.endTime,
	    dogName: reservation.dogName || '', // opcional, si en el futuro lo agregas
	    dogAge: reservation.dogAge,
	    dogWeight: reservation.dogWeight,
	    notes: reservation.notes,
	    totalPrice: reservation.totalPrice,
	    reservationId,
	  });
	} catch (emailError) {
	  console.error(`❌ Error sending receipt email for reservation ${reservationId}:`, emailError);
	}
    } else {
      console.warn('⚠️ No reservationId provided, paymentStatus not updated');
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Capturar pago (Liberar al proveedor)
app.post('/capture-payment', async (req, res) => {
  try {
    const { paymentIntentId, reservationId } = req.body;

    const reservationRef = admin.firestore().collection('reservations').doc(reservationId);
    const reservationSnap = await reservationRef.get();

    if (!reservationSnap.exists) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = reservationSnap.data();

    // Validaciones
    if (!reservation.checkinPhotoUrl || !reservation.checkoutPhotoUrl) {
      return res.status(400).json({ error: 'Check-in and Check-out must be completed before releasing payment' });
    }

    if (reservation.disputeFiled) {
      return res.status(400).json({ error: 'There is an active dispute, payment cannot be released' });
    }

    const now = new Date();
    const paymentAvailableAt = reservation.paymentAvailableAt?.toDate
      ? reservation.paymentAvailableAt.toDate()
      : new Date(reservation.paymentAvailableAt);

    if (now < paymentAvailableAt) {
      return res.status(400).json({ error: `Payment will be available after ${paymentAvailableAt}` });
    }

    // Todo OK → capturar el pago
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    await reservationRef.update({
      paymentCaptured: true,
      paymentCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

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
      amount: parseInt(amount),
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

