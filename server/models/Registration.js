const { Schema, model } = require('mongoose');
const { REG_STATUSES } = require('../utils/constants');

const registrationSchema = new Schema({
  registrationId: { type: String, required: true, unique: true },
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  captainId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
  status: { type: String, enum: REG_STATUSES, default: 'pending_payment', index: true },
  active: { type: Boolean, default: true },          // true while the registration holds a slot
  playerKeys: { type: [String], default: [] },       // lower-cased player IDs, for duplicate-enrolment protection
  teamSnapshot: { teamName: String, size: Number },
  amountDue: Number,                                  // paise
  holdExpiresAt: Date,
  registeredAt: { type: Date, default: Date.now },
  confirmedAt: Date,
}, { timestamps: true });

// One active registration per team per tournament, and one active enrolment per player per tournament.
registrationSchema.index({ tournamentId: 1, teamId: 1 }, { unique: true, partialFilterExpression: { active: true } });
registrationSchema.index({ tournamentId: 1, playerKeys: 1 }, { unique: true, partialFilterExpression: { active: true } });
registrationSchema.index({ status: 1, holdExpiresAt: 1 });
module.exports = model('Registration', registrationSchema);
