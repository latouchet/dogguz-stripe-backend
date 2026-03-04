const express = require('express');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const router = express.Router();

router.post('/send-reservation-payment-notice', async (req, res) => {
  try {
    const { reservationId } = req.body;

    if (!reservationId) {
      return res.status(400).json({ error: 'Missing reservationId' });
    }

    const reservationRef = admin.firestore().collection('reservations').doc(reservationId);
    const snap = await reservationRef.get();

    if (!snap.exists) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const r = snap.data();

    // ✅ Solo si el proveedor aceptó
    if (String(r.status || '').toLowerCase() !== 'accepted') {
      return res.status(400).json({ error: `Reservation status is not accepted (current: ${r.status})` });
    }

    // ✅ Evitar duplicados
    if (r.paymentNoticeEmailSentAt) {
      return res.json({ ok: true, skipped: true, reason: 'Already sent' });
    }

    const ownerEmail = r.ownerEmail;
    if (!ownerEmail) {
      return res.status(400).json({ error: 'Reservation has no ownerEmail' });
    }

    const ownerName = r.ownerName || 'Dogguz User';
    const providerName = r.providerName || 'Your provider';
    const selectedService = r.selectedService || 'Service';

    const msg = {
      to: ownerEmail,
      from: 'noreply@dogguz.com',
      subject: '✅ Reservation accepted — Payment required',
      html: `
        <p>Hello ${ownerName},</p>
        <p><strong>${providerName}</strong> accepted your reservation for <strong>${selectedService}</strong>.</p>
        <p>Please open the <strong>Dogguz</strong> app and go to:</p>
        <p><strong>Reservations → Pay Now</strong></p>
        <p>to secure your booking.</p>
        <br/>
        <p>🐾 Thank you for using Dogguz!</p>
      `,
    };

    await sgMail.send(msg);

    await reservationRef.update({
      paymentNoticeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error('❌ send-reservation-payment-notice error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
