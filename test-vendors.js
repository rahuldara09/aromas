const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json'); // Let's guess if it exists

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
db.collection('vendors').get().then(snap => {
    snap.forEach(doc => {
        console.log(doc.id, doc.data());
    });
}).catch(console.error);

