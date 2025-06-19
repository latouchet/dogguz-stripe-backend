const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const admin = require('firebase-admin');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📩 Webhook event received: ${event.type}`);
  const usersRef = admin.firestore().collection('users');

  // ✅ 1. Pago confirmado
  if (event.type === 'invoice.payment_succeeded') {
    const subscriptionId = event.data.object.subscription;
    if (!subscriptionId) return res.status(200).send('No subscription ID');

    const querySnapshot = await usersRef.where('stripeSubscriptionId', '==', subscriptionId).get();
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userRef = userDoc.ref;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEndUnix = subscription.current_period_end;
      const periodEndMs = Math.floor(periodEndUnix * 1000);
      const periodEndTimestamp = admin.firestore.Timestamp.fromMillis(periodEndMs);

      await userRef.update({
        membershipStatus: 'premium',
        membershipStartDate: admin.firestore.FieldValue.serverTimestamp(),
        membershipCancelAt: periodEndTimestamp,
      });

      console.log(`✅ User ${userDoc.id} upgraded to premium. Ends at ${new Date(periodEndMs).toISOString()}`);
    } else {
      console.warn(`⚠️ No user found with subscriptionId: ${subscriptionId}`);
    }
  }

  // ✅ 2. Actualización de estado de suscripción
  else if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const subscriptionId = subscription.id;
    const status = subscription.status;

    const mappedStatus = (status === 'active') ? 'premium' : status;
    const querySnapshot = await usersRef.where('stripeSubscriptionId', '==', subscriptionId).get();

    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      const userRef = userDoc.ref;

      const updateData = { membershipStatus: mappedStatus };

      if (mappedStatus === 'premium') {
        const periodEndUnix = subscription.current_period_end;
        const periodEndMs = Math.floor(periodEndUnix * 1000);
        updateData.membershipCancelAt = admin.firestore.Timestamp.fromMillis(periodEndMs);

        const userData = userDoc.data();
        if (!userData.membershipStartDate) {
          updateData.membershipStartDate = admin.firestore.FieldValue.serverTimestamp();
        }
      }

      await userRef.update(updateData);
      console.log(`🔄 User ${userDoc.id} subscription status updated to ${mappedStatus}`);
    } else {
      console.warn(`⚠️ No user found with subscriptionId: ${subscriptionId}`);
    }
  }

  // ✅ 3. Suscripción cancelada
  else if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const subscriptionId = subscription.id;
    const periodEndUnix = subscription.current_period_end;

    if (typeof periodEndUnix !== 'number' || isNaN(periodEndUnix)) {
      console.warn(`⚠️ Invalid period_end for subscription ${subscriptionId}`);
    } else {
      const periodEndMs = Math.floor(periodEndUnix * 1000);
      const periodEndTimestamp = admin.firestore.Timestamp.fromMillis(periodEndMs);

      const querySnapshot = await usersRef.where('stripeSubscriptionId', '==', subscriptionId).get();

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await userDoc.ref.update({
          membershipCancelAt: periodEndTimestamp,
          membershipStatus: 'inactive',
        });

        console.log(`❌ User ${userDoc.id} subscription canceled, valid until ${new Date(periodEndMs).toISOString()}`);
      } else {
        console.warn(`⚠️ No user found with subscriptionId: ${subscriptionId}`);
      }
    }
  }

  // ✅ 4. Pago fallido
  else if (event.type === 'invoice.payment_failed') {
    const subscriptionId = event.data.object.subscription;
    if (!subscriptionId) return res.status(200).send('No subscription ID');

    const querySnapshot = await usersRef.where('stripeSubscriptionId', '==', subscriptionId).get();
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      await userDoc.ref.update({
        membershipStatus: 'past_due',
      });
      console.log(`⚠️ User ${userDoc.id} payment failed. Status set to past_due.`);
    } else {
      console.warn(`⚠️ No user found with subscriptionId: ${subscriptionId}`);
    }
  }

  // ✅ 5. Factura pagada (opcional)
  else if (event.type === 'invoice.paid') {
    console.log('💰 Invoice paid. No action taken.');
  }

  // Otros eventos no manejados
  else {
    console.log(`ℹ️ Unhandled event: ${event.type}`);
  }

  res.status(200).json({ received: true });
});

module.exports = router;

