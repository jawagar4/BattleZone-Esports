const { Schema, model } = require('mongoose');
const s = new Schema({
  eventId: { type: String, required: true, unique: true },
  type: String,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});
module.exports = model('WebhookEvent', s);
