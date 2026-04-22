const { sendPushNotifications } = require("./src/sendPushNotifications");
const { sendAutomaticMatchReminders } = require("./src/sendAutomaticMatchReminders");
const { deleteUserAsAdmin } = require("./src/deleteUserAsAdmin");

exports.sendPushNotifications = sendPushNotifications;
exports.sendAutomaticMatchReminders = sendAutomaticMatchReminders;
exports.deleteUserAsAdmin = deleteUserAsAdmin;
