// list-stripe-users.js
const admin = require('firebase-admin');

// Carga el archivo de credenciales de Firebase
const serviceAccount = require('./firebase-key.json'); // Asegúrate de que este archivo exista y tenga el nombre correcto

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Función para listar los usuarios con stripeAccountId
async function listStripeUsers() {
  try {
    const snapshot = await admin.firestore().collection('users')
      .where('stripeAccountId', '!=', null)
      .get();

    if (snapshot.empty) {
      console.log('⚠️ No se encontraron usuarios con stripeAccountId.');
      return;
    }

    console.log('📝 Usuarios con stripeAccountId:\n');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`UID: ${doc.id} | StripeAccountId: ${data.stripeAccountId}`);
    });

  } catch (error) {
    console.error('❌ Error al listar usuarios:', error);
  }
}

listStripeUsers();
