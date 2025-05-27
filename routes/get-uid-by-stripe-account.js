const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

router.get('/get-uid/:stripeAccountId', async (req, res) => {
  const { stripeAccountId } = req.params;

  try {
    const snapshot = await admin.firestore().collection('users')
      .where('stripeAccountId', '==', stripeAccountId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'User not found' });
    }

    const doc = snapshot.docs[0];
    return res.json({ uid: doc.id });
  } catch (error) {
    console.error('Error fetching UID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
