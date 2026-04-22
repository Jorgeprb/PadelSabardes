const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db, messaging } = require("./firebase");

const REGION = process.env.FUNCTIONS_REGION || "us-east1";
const APP_URL = process.env.PUBLIC_APP_URL || "https://padelsabardes.onrender.com/";
const ALLOWED_CATEGORIES = new Set([
  "invitations",
  "joins",
  "leaves",
  "assigned",
  "kicked",
  "changes",
  "cancellations",
  "always",
]);
const INVALID_TOKEN_ERRORS = new Set([
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

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

  const uniqueUids = [...new Set(uids)];
  const userRefs = uniqueUids.map((uid) => db.collection("users").doc(uid));
  const userSnapshots = await db.getAll(...userRefs);

  const tokens = [];
  const tokenOwners = [];

  userSnapshots.forEach((snapshot) => {
    if (!snapshot.exists) return;

    const userData = snapshot.data() || {};
    const pushToken = typeof userData.pushToken === "string" ? userData.pushToken : "";
    if (!pushToken) return;

    if (userData.notifPrefs?.pushEnabled === false) return;
    if (category !== "always" && userData.notifPrefs?.[category] === false) return;

    tokens.push(pushToken);
    tokenOwners.push({
      ref: snapshot.ref,
      token: pushToken,
      uid: snapshot.id,
    });
  });

  if (tokens.length === 0) {
    console.log("[Push] No valid recipients for category:", category, "uids:", uniqueUids);
    return { sentCount: 0, skippedCount: uniqueUids.length };
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    data: {
      body,
      category,
      source: "padelsabardes",
      title,
      url: APP_URL,
    },
    webpush: {
      headers: {
        TTL: "300",
        Urgency: "high",
      },
    },
  });

  const cleanupTasks = [];
  response.responses.forEach((entry, index) => {
    if (entry.success) return;
    const errorCode = entry.error?.code;
    console.error("[Push] Delivery failed", {
      uid: tokenOwners[index]?.uid,
      errorCode,
      errorMessage: entry.error?.message,
    });
    if (!INVALID_TOKEN_ERRORS.has(errorCode)) return;

    const owner = tokenOwners[index];
    if (!owner) return;

    cleanupTasks.push(owner.ref.set({ pushToken: null }, { merge: true }));
  });

  if (cleanupTasks.length > 0) {
    await Promise.allSettled(cleanupTasks);
  }

  console.log("[Push] Delivery summary", {
    sentCount: response.successCount,
    failureCount: response.failureCount,
    tokenCount: tokens.length,
    requestedUsers: uniqueUids.length,
    category,
  });

  return {
    sentCount: response.successCount,
    skippedCount: uniqueUids.length - response.successCount,
  };
});

module.exports = {
  sendPushNotifications,
};
