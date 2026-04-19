const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();
const { FieldValue } = admin.firestore;

module.exports = {
  admin,
  auth,
  db,
  FieldValue,
  messaging,
};
