const { Schema, model } = require('mongoose');

const paymentSchema = new Schema({
  registrationId: { type: Schema.Types.ObjectId, ref: 'Registration', required: true, index: true },
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true },             // paise
  currency: { type: String, default: 'INR' },
  breakdown: { entryFee: Number, platformFee: Number, tax: Number },
  gatewayOrderId: { type: String, required: true, unique: true },
  gatewayPaymentId: { type: String, unique: true, sparse: true },
  gatewayRefundId: String,
  status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending', index: true },
  receiptNo: String,
  verifiedVia: { type: String, enum: ['checkout', 'webhook', 'reconciliation'] },
  verifiedAt: Date,
  refundedAt: Date,
  refundReason: String,
  failureReason: String,
}, { timestamps: true });
paymentSchema.index({ createdAt: -1 });
module.exports = model('Payment', paymentSchema);
