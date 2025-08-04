const express = require('express');
const router = express.Router();
const axios = require('axios');
const admin = require('firebase-admin');
const { google } = require('google-auth-library');
require('dotenv').config();

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

const GOOGLE_PACKAGE_NAME = 'com.dogguz.net'; 

router.post('/validate-receipt', async (req, res) => {
  const { receipt, uid } = req.body;

  if (!receipt || !uid) {
    return res.status(400).json({ success: false, message: 'Missing receipt or uid' });
  }

  // Intentar parsear como JSON → si es Android, contendrá purchaseToken
  let parsedReceipt;
  try {
    parsedReceipt = JSON.parse(receipt);
  } catch (_) {
    parsedReceipt = null;
  }

  if (parsedReceipt && parsedReceipt.purchaseToken) {
    // ✅ FLUJO GOOGLE PLAY
    try {
      const { productId, purchaseToken } = parsedReceipt;

      const auth = new google.auth.GoogleAuth({
        keyFile: 'service-account.json',
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      });

      const accessToken = await auth.getAccessToken();
      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${GOOGLE_PACKAGE_NAME}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = response.data;

      if (data.paymentState !== 1 && data.paymentState !== 2) {
        return res.status(400).json({ success: false, message: 'Subscription not active' });
      }

      const expirationTime = new Date(parseInt(data.expiryTimeMillis));

      await admin.firestore().collection('users').doc(uid).set({
        membershipStatus: 'premium',
        membershipCancelAt: admin.firestore.Timestamp.fromDate(expirationTime),
        membershipValidatedBy: 'google',
        membershipProductId: productId,
      }, { merge: true });

      return res.json({ success: true });

    } catch (err) {
      console.error('❌ Google validation error:', err.message);
      return res.status(500).json({ success: false, message: 'Google validation failed' });
    }
  }

  // ✅ FLUJO APPLE (ya lo tenías)
  const payload = {
    'receipt-data': receipt,
    'password': SHARED_SECRET,
    'exclude-old-transactions': true,
  };

  try {
    let response = await axios.post(APPLE_PRODUCTION_URL, payload);
    let data = response.data;

    if (data.status === 21007) {
      response = await axios.post(APPLE_SANDBOX_URL, payload);
      data = response.data;
    }

    if (data.status !== 0) {
      return res.status(400).json({ success: false, message: `Apple validation failed with status ${data.status}` });
    }

    const latestReceiptInfo = data.latest_receipt_info?.[0];
    if (!latestReceiptInfo) {
      return res.status(400).json({ success: false, message: 'No receipt info found' });
    }

    const productId = latestReceiptInfo.product_id;
    const expiresMs = parseInt(latestReceiptInfo.expires_date_ms);  // 🔥 Fecha real
    const expirationDate = new Date(expiresMs);  // 🔒 Preciso y aprobado por Apple

    await admin.firestore().collection('users').doc(uid).set({
      membershipStatus: 'premium',
      membershipCancelAt: admin.firestore.Timestamp.fromDate(expirationDate),
      membershipValidatedBy: 'apple',
      membershipProductId: productId,
    }, { merge: true });

    return res.json({ success: true });

  } catch (err) {
    console.error('❌ Apple validation error:', err.message);
    return res.status(500).json({ success: false, message: 'Apple validation failed' });
  }
});

module.exports = router;

