const express = require('express');
const router = express.Router();
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

// 👉 POST /validate-receipt
router.post('/validate-receipt', async (req, res) => {
  const { receipt, uid } = req.body;

  if (!receipt || !uid) {
    return res.status(400).json({ success: false, message: 'Missing receipt or uid' });
  }

  const payload = {
    'receipt-data': receipt,
    'password': SHARED_SECRET,
    'exclude-old-transactions': true
  };

  try {
  console.log('✅ Validación exitosa. Guardando en Firestore...');
  console.log('🕒 Fecha de expiración:', expirationDate.toISOString());

  // 1️⃣ Intentar validar contra producción
  let response = await axios.post(APPLE_PRODUCTION_URL, payload);
  let data = response.data;

  // 2️⃣ Si el recibo es sandbox, intentar validar con sandbox
  if (data.status === 21007) {
    console.warn('🔄 Receipt is from SANDBOX, retrying validation...');
    response = await axios.post(APPLE_SANDBOX_URL, payload);
    data = response.data;
  }

  // 3️⃣ Validación fallida
  if (data.status !== 0) {
    return res.status(400).json({ success: false, message: `Apple validation failed with status ${data.status}` });
  }

  // 4️⃣ Extraer info de la compra
  const latestReceiptInfo = data.latest_receipt_info?.[0];
  if (!latestReceiptInfo) {
    return res.status(400).json({ success: false, message: 'No receipt info found' });
  }

  const productId = latestReceiptInfo.product_id;
  const purchaseDateMs = parseInt(latestReceiptInfo.purchase_date_ms || Date.now());
  const purchaseDate = new Date(purchaseDateMs);

  // 5️⃣ Calcular expiración
  const expirationDate = new Date(
    productId === '	dogguz.appstore.annuall'
      ? purchaseDate.setFullYear(purchaseDate.getFullYear() + 1)
      : purchaseDate.setMonth(purchaseDate.getMonth() + 1)
  );

  // 6️⃣ Guardar en Firestore
  const userRef = admin.firestore().collection('users').doc(uid);
  await userRef.set({
    membershipStatus: 'premium',
    membershipCancelAt: admin.firestore.Timestamp.fromDate(expirationDate),
    membershipValidatedBy: 'apple',
    membershipProductId: productId,
  }, { merge: true });
  
  console.log('✅ Firestore actualizado para UID: ' + uid);

  return res.json({ success: true });

 } catch (err) {
   console.error('❌ Error validating receipt:', err.message);
   return res.status(500).json({ success: false, message: 'Server error' });
 }
  
});

module.exports = router;
