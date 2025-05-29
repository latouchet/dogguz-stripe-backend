// delete-stripe-id.js
const admin = require('firebase-admin');

// Carga tu archivo de credenciales (reemplaza con el nombre real del archivo .json descargado desde Firebase)
const serviceAccount = require('./firebase-key.json'); // <-- usa el nombre real del archivo

// Inicializa Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Reemplaza este UID con el del usuario/proveedor que deseas resetear
const uid = '8wz87Qs9y3easzcL0JdMfV7Dx6n1'; // <-- cambia por el UID que corresponde si es otro

// Elimina el campo stripeAccountId
admin.firestore().collection('users').doc(uid).update({
  stripeAccountId: admin.firestore.FieldValue.delete()
}).then(() => {
  console.log(`✅ stripeAccountId eliminado para el usuario ${uid}`);
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error al borrar stripeAccountId:', error);
  process.exit(1);
});

