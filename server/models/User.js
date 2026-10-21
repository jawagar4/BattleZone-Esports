const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, match: /^[6-9]\d{9}$/ },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['player', 'admin'], default: 'player', index: true },
  accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  emailVerified: { type: Boolean, default: false },
  emailVerifyTokenHash: { type: String, select: false },
  emailVerifyExpires: { type: Date, select: false },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

userSchema.index({ name: 'text', email: 'text' });
userSchema.set('toJSON', {
  transform: (_d, ret) => { delete ret.passwordHash; delete ret.__v; return ret; },
});
module.exports = model('User', userSchema);
