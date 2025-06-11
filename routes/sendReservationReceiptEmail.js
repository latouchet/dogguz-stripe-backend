// routes/sendReservationReceiptEmail.js

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendReservationReceiptEmail({
  ownerEmail,
  ownerName,
  providerName,
  selectedService,
  startDate,
  endDate,
  startTime,
  endTime,
  dogName,
  dogAge,
  dogWeight,
  notes,
  totalPrice,
  reservationId,
}) {
  const msg = {
    to: ownerEmail,
    from: 'noreply@dogguz.com', // ✅ Ahora ya puedes usar esto
    subject: `🐾 Your Dogguz Reservation Receipt — Order #${reservationId}`,
    html: `
      <p>Hello ${ownerName},</p>
      <p>Thank you for your reservation on <strong>Dogguz</strong>!</p>
      <p><strong>Service:</strong> ${selectedService}</p>
      <p><strong>Provider:</strong> ${providerName}</p>
      <p><strong>Dates:</strong> ${formatDate(startDate)} → ${formatDate(endDate)}</p>
      <p><strong>Pick-up Time:</strong> ${startTime}</p>
      <p><strong>Drop-off Time:</strong> ${endTime}</p>
      <p><strong>Dog:</strong> ${dogName || 'Your dog'}, Age: ${dogAge}, Weight: ${dogWeight}</p>
      <p><strong>Notes:</strong> ${notes || 'None'}</p>
      <p><strong>Total Paid:</strong> $${totalPrice}</p>
      <br>
      <p>This amount has been securely processed via Stripe.</p>
      <p>🐾 Thank you for using Dogguz!</p>
    `,
  };

  await sgMail.send(msg);
  console.log(`📧 Receipt email sent to ${ownerEmail} for reservation ${reservationId}`);
}

// Helper to format Firestore Timestamp or Date
function formatDate(input) {
  if (!input) return '';
  const date = input.toDate ? input.toDate() : new Date(input);
  return date.toLocaleDateString();
}

module.exports = sendReservationReceiptEmail;

