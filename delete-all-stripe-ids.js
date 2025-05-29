// delete-all-stripe-ids.js
const admin = require('firebase-admin');

// Carga tu archivo de credenciales
const serviceAccount = require('./firebase-key.json'); // Asegúrate de que el archivo exista

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function deleteStripeIds() {
  try {
    const snapshot = await admin.firestore().collection('users')
      .where('stripeAccountId', '!=', null)
      .get();

    if (snapshot.empty) {
      console.log('⚠️ No se encontraron usuarios con stripeAccountId.');
      return;
    }

    console.log(`🔍 Se encontraron ${snapshot.size} usuarios. Eliminando stripeAccountId...`);

    const batch = admin.firestore().batch();
    snapshot.forEach(doc => {
      const userRef = admin.firestore().collection('users').doc(doc.id);
      batch.update(userRef, {
        stripeAccountId: admin.firestore.FieldValue.delete()
      });
    });

    await batch.commit();
    console.log('✅ Todos los stripeAccountId han sido eliminados correctamente.');
  } catch (error) {
    console.error('❌ Error al eliminar stripeAccountId:', error);
  }
}

deleteStripeIds();
