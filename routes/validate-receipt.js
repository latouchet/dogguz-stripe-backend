const express = require('express');
const router = express.Router();
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const SHARED_SECRET = process.env.APPLE_SHARED_SECRET;

router.post('/validate-receipt', async (req, res) => {
  const { receipt, uid } = req.body;

  console.log('📥 Petición recibida en /validate-receipt');
  console.log('👤 UID:', uid);
  console.log('🧾 Recibo (truncado):', receipt?.substring(0, 60) + '...');

  if (!receipt || !uid) {
    console.warn('⚠️ Faltan datos requeridos');
    return res.status(400).json({ success: false, message: 'Missing receipt or uid' });
  }

  const payload = {
    'receipt-data': receipt,
    'password': SHARED_SECRET,
    'exclude-old-transactions': true
  };

  try {
    // 1️⃣ Intentar producción
    console.log('🌐 Enviando recibo a Apple (PRODUCCIÓN)...');
    let response = await axios.post(APPLE_PRODUCTION_URL, payload);
    let data = response.data;
    console.log('🔢 Código de respuesta de Apple (PRODUCCIÓN):', data.status);

    // 2️⃣ Si es sandbox, reintentar
    if (data.status === 21007) {
      console.warn('🔄 Recibo es SANDBOX. Reintentando con URL de sandbox...');
      response = await axios.post(APPLE_SANDBOX_URL, payload);
      data = response.data;
      console.log('🔢 Código de respuesta de Apple (SANDBOX):', data.status);
    }

    // 3️⃣ Error en validación
    if (data.status !== 0) {
      console.error('❌ Validación fallida con Apple. Status:', data.status);
      return res.status(400).json({ success: false, message: `Apple validation failed with status ${data.status}` });
    }

    // 4️⃣ Extraer datos del recibo
    const latestReceiptInfo = data.latest_receipt_info?.[0];
    if (!latestReceiptInfo) {
      console.warn('⚠️ No se encontró información de recibo en la respuesta de Apple');
      return res.status(400).json({ success: false, message: 'No receipt info found' });
    }

    const productId = latestReceiptInfo.product_id;
    const purchaseDateMs = parseInt(latestReceiptInfo.purchase_date_ms || Date.now());
    const purchaseDate = new Date(purchaseDateMs);

    console.log('🛍️ Producto comprado:', productId);
    console.log('🕓 Fecha de compra:', purchaseDate.toISOString());

    // 5️⃣ Calcular expiración
    const expirationDate = new Date(
      productId === 'dogguz.appstore.annuall'
        ? purchaseDate.setFullYear(purchaseDate.getFullYear() + 1)
        : purchaseDate.setMonth(purchaseDate.getMonth() + 1)
    );
    console.log('📅 Fecha de expiración calculada:', expirationDate.toISOString());

    // 6️⃣ Guardar en Firestore
    console.log('💾 Guardando datos en Firestore...');
    const userRef = admin.firestore().collection('users').doc(uid);
    await userRef.set({
      membershipStatus: 'premium',
      membershipCancelAt: admin.firestore.Timestamp.fromDate(expirationDate),
      membershipValidatedBy: 'apple',
      membershipProductId: productId,
    }, { merge: true });

    console.log('✅ Firestore actualizado correctamente para UID:', uid);
    return res.json({ success: true });

  } catch (err) {
    console.error('❌ Error procesando la validación del recibo:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

