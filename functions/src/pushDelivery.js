const { db, messaging } = require("./firebase");

const APP_URL = process.env.PUBLIC_APP_URL || "https://padelsabardes.onrender.com/";

const ALLOWED_CATEGORIES = new Set([
  "invitations",
  "joins",
  "assigned",
  "leaves",
  "kicked",
  "reminders",
  "changes",
  "cancellations",
  "always",
]);

const INVALID_TOKEN_ERRORS = new Set([
  "messaging/invalid-argument",
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const dispatchPushToUsers = async ({
  uids,
  title,
  body,
  category = "always",
  url = APP_URL,
}) => {
  const uniqueUids = Array.isArray(uids)
    ? [...new Set(uids.filter((entry) => typeof entry === "string" && entry.trim()))]
    : [];

  if (uniqueUids.length === 0 || typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
    return { sentCount: 0, skippedCount: uniqueUids.length, deliveredUids: [] };
  }

  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error(`Categoría de notificación no permitida: ${category}`);
  }

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
    return { sentCount: 0, skippedCount: uniqueUids.length, deliveredUids: [] };
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    data: {
      body: body.trim(),
      category,
      source: "padelsabardes",
      title: title.trim(),
      url,
    },
    webpush: {
      headers: {
        TTL: "300",
        Urgency: "high",
      },
    },
  });

  const cleanupTasks = [];
  const deliveredUids = [];

  response.responses.forEach((entry, index) => {
    const owner = tokenOwners[index];
    if (entry.success) {
      if (owner?.uid) deliveredUids.push(owner.uid);
      return;
    }

    const errorCode = entry.error?.code;
    console.error("[Push] Delivery failed", {
      uid: owner?.uid,
      errorCode,
      errorMessage: entry.error?.message,
    });

    if (!INVALID_TOKEN_ERRORS.has(errorCode) || !owner) return;
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
    deliveredUids,
  };
};

module.exports = {
  ALLOWED_CATEGORIES,
  dispatchPushToUsers,
};
