// routes/get-uid-by-stripe-account.js
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.get('/get-uid-by-stripe-account/:accountId', async (req, res) => {
  const { accountId } = req.params;

  try {
    const snapshot = await admin.firestore().collection('users')
      .where('stripeAccountId', '==', accountId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'UID not found for that Stripe account' });
    }

    const doc = snapshot.docs[0];
    res.json({ uid: doc.id });
  } catch (error) {
    console.error('Error fetching UID:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

