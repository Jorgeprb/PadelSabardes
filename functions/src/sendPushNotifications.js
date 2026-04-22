const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { dispatchPushToUsers, ALLOWED_CATEGORIES } = require("./pushDelivery");

const REGION = process.env.FUNCTIONS_REGION || "us-east1";

const sendPushNotifications = onCall({ region: REGION }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para enviar notificaciones.");
  }

  const uids = Array.isArray(request.data?.uids) ? request.data.uids.filter((entry) => typeof entry === "string") : [];
  const title = typeof request.data?.title === "string" ? request.data.title.trim() : "";
  const body = typeof request.data?.body === "string" ? request.data.body.trim() : "";
  const category = typeof request.data?.category === "string" ? request.data.category : "always";

  if (uids.length === 0 || !title || !body || !ALLOWED_CATEGORIES.has(category)) {
    throw new HttpsError("invalid-argument", "Faltan datos válidos para enviar la notificación.");
  }

  return dispatchPushToUsers({ uids, title, body, category });
});

module.exports = {
  sendPushNotifications,
};
