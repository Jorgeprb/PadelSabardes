const { sendPushNotifications } = require("./src/sendPushNotifications");
const { deleteUserAsAdmin } = require("./src/deleteUserAsAdmin");

exports.sendPushNotifications = sendPushNotifications;
exports.deleteUserAsAdmin = deleteUserAsAdmin;
