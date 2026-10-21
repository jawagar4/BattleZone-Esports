const { Schema, model } = require('mongoose');
const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  link: String,
  readAt: Date,
}, { timestamps: { createdAt: true, updatedAt: false } });
notificationSchema.index({ userId: 1, createdAt: -1 });
module.exports = model('Notification', notificationSchema);
