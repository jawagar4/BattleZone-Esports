const Notification = require('../models/Notification');
const { emitToUser } = require('../sockets');

async function notify(userId, title, message, link) {
  const n = await Notification.create({ userId, title, message, link });
  emitToUser(userId, 'notification', n);
  return n;
}
async function notifyMany(userIds, title, message, link) {
  const unique = [...new Set(userIds.map(String))];
  await Promise.all(unique.map((id) => notify(id, title, message, link)));
}
module.exports = { notify, notifyMany };
