const { onSchedule } = require("firebase-functions/v2/scheduler");
const { db } = require("./firebase");
const { dispatchPushToUsers } = require("./pushDelivery");
const { normalizeNotificationTemplates, resolveNotificationTemplate } = require("./notificationTemplates");

const REGION = process.env.FUNCTIONS_REGION || "us-east1";
const REMINDER_COLLECTION = "notificationDeliveries";
const SCHEDULE = "every 5 minutes";
const TRIGGER_WINDOW_MINUTES = 6;

const parseMatchDateTime = (dateString, timeString, baseDate = new Date()) => {
  const [day, month] = String(dateString || "01/01").split("/").map((entry) => parseInt(entry || "1", 10));
  const [hours, minutes] = String(timeString || "00:00").split(":").map((entry) => parseInt(entry || "0", 10));
  const result = new Date(baseDate);
  const matchMonth = (month || 1) - 1;

  result.setHours(hours || 0, minutes || 0, 0, 0);
  if (matchMonth < result.getMonth() - 2) {
    result.setFullYear(result.getFullYear() + 1);
  }
  result.setMonth(matchMonth);
  result.setDate(day || 1);
  return result;
};

const normalizeReminderSettings = (value) => {
  const source = typeof value === "object" && value !== null ? value : {};
  const offsets = Array.isArray(source.reminderOffsetsMinutes)
    ? source.reminderOffsetsMinutes
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry > 0 && entry <= 10080)
    : [60];

  return Array.from(new Set(offsets)).sort((left, right) => left - right);
};

const buildReminderDeliveryId = (matchId, uid, minutesBefore, dateString, timeString) =>
  ["reminder", matchId, uid, minutesBefore, dateString, timeString].join("__").replace(/[/:]/g, "-");

const sendAutomaticMatchReminders = onSchedule({ region: REGION, schedule: SCHEDULE }, async () => {
  const [settingsSnapshot, templatesSnapshot, matchesSnapshot] = await Promise.all([
    db.collection("config").doc("notificationSettings").get(),
    db.collection("config").doc("notificationTemplates").get(),
    db.collection("matches").get(),
  ]);

  const reminderOffsetsMinutes = normalizeReminderSettings(settingsSnapshot.exists ? settingsSnapshot.data() : null);
  if (reminderOffsetsMinutes.length === 0) {
    console.log("[Reminders] No offsets configured. Skipping.");
    return;
  }

  const templates = normalizeNotificationTemplates(templatesSnapshot.exists ? templatesSnapshot.data() : null);
  const now = new Date();
  let deliveredCount = 0;

  for (const matchDoc of matchesSnapshot.docs) {
    const match = matchDoc.data() || {};
    if (!match.fecha || !match.hora || !Array.isArray(match.listaParticipantes) || match.listaParticipantes.length === 0) {
      continue;
    }

    const matchStart = parseMatchDateTime(match.fecha, match.hora, now);
    const minutesUntilMatch = (matchStart.getTime() - now.getTime()) / 60000;
    if (minutesUntilMatch <= 0) continue;

    const participantUids = [...new Set(match.listaParticipantes.filter((entry) => typeof entry === "string" && entry))];
    if (participantUids.length === 0) continue;

    for (const minutesBefore of reminderOffsetsMinutes) {
      const isInWindow = minutesUntilMatch <= minutesBefore && minutesUntilMatch > (minutesBefore - TRIGGER_WINDOW_MINUTES);
      if (!isInWindow) continue;

      const fallbackTitle = "Recordatorio de partido";
      const fallbackBody = `Tu partido empieza en ${minutesBefore} min: ${match.fecha} a las ${match.hora}.`;

      for (const uid of participantUids) {
        const deliveryRef = db.collection(REMINDER_COLLECTION).doc(
          buildReminderDeliveryId(matchDoc.id, uid, minutesBefore, match.fecha, match.hora),
        );
        const deliverySnapshot = await deliveryRef.get();
        if (deliverySnapshot.exists) continue;

        const { title, body } = resolveNotificationTemplate(
          templates,
          "reminders",
          fallbackTitle,
          fallbackBody,
          {
            matchDate: match.fecha,
            matchTime: match.hora,
            location: match.ubicacion || "Sabardes",
            minutesBefore,
          },
        );

        const result = await dispatchPushToUsers({
          uids: [uid],
          title,
          body,
          category: "reminders",
        });

        if (result.deliveredUids.includes(uid)) {
          deliveredCount += 1;
          await deliveryRef.set({
            category: "reminders",
            deliveredAt: new Date().toISOString(),
            matchDate: match.fecha,
            matchId: matchDoc.id,
            matchTime: match.hora,
            minutesBefore,
            uid,
          }, { merge: true });
        }
      }
    }
  }

  console.log("[Reminders] Completed automatic reminder run", { deliveredCount });
});

module.exports = {
  sendAutomaticMatchReminders,
};
