const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send welcome email after successful Dogguz Premium subscription
 * @param {string} toEmail - Recipient email
 */
const sendPremiumWelcomeEmail = async (toEmail) => {
  const msg = {
    to: toEmail,
    from: process.env.FROM_EMAIL, // must be a verified sender
    subject: 'Welcome to Dogguz Premium!',
    text: `Hi ${toEmail},

Thank you for becoming a Premium Member of Dogguz! 🐾

As a Premium Member, you now have access to:
- The Health Module
- Your dog's Digital Passport
- The GPS Dog Locator

We're excited to have you in our premium community.

🐶 The Dogguz Team`,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 Premium welcome email sent to ${toEmail}`);
  } catch (error) {
    console.error(`❌ Error sending premium welcome email to ${toEmail}:`, error.message);
  }
};

module.exports = sendPremiumWelcomeEmail;
