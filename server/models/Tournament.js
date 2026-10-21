const { Schema, model } = require('mongoose');
const { GAMES } = require('../utils/constants');
const { computePhase } = require('../utils/phase');

const tournamentSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  game: { type: String, required: true, enum: GAMES.map((g) => g.name), index: true },
  bannerUrl: String,
  description: { type: String, maxlength: 4000 },
  rules: { type: [String], default: [] },
  gameMode: String,
  map: String,
  allowedTeamSizes: { type: [Number], required: true, validate: [(v) => v.length > 0 && v.every((n) => Number.isInteger(n) && n >= 1 && n <= 6), 'Team sizes must be between 1 and 6'] },
  entryFee: { type: Number, required: true, min: 0 },      // rupees
  prizePool: { type: Number, required: true, min: 0 },     // rupees
  prizeDistribution: [{ place: String, amount: Number }],
  maxTeams: { type: Number, required: true, min: 2, max: 5000 },
  reservedSlots: { type: Number, default: 0, min: 0 },     // active registrations (pending + confirmed)
  registrationStart: { type: Date, required: true },
  registrationEnd: { type: Date, required: true },
  tournamentStart: { type: Date, required: true, index: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  refundPolicy: { type: String, default: 'Entry fees are refundable only if the organiser cancels the tournament.' },
  manualApproval: { type: Boolean, default: false },
  autoGenerateSchedule: { type: Boolean, default: false },
  teamsPerMatch: { type: Number, default: 2, min: 2 },
  matchIntervalMinutes: { type: Number, default: 45, min: 5 },
  scheduleGenerated: { type: Boolean, default: false },
  reminderMinutes: { type: [Number], default: [60, 15] },
  remindersSent: { type: [Number], default: [] },
  isPaused: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'published', 'cancelled', 'completed'], default: 'draft', index: true },
  lastPhase: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

tournamentSchema.virtual('phase').get(function () { return computePhase(this); });
tournamentSchema.virtual('availableSlots').get(function () { return Math.max(0, this.maxTeams - this.reservedSlots); });
tournamentSchema.pre('validate', function () {
  if (this.registrationEnd <= this.registrationStart) this.invalidate('registrationEnd', 'Registration must close after it opens');
  if (this.tournamentStart < this.registrationEnd) this.invalidate('tournamentStart', 'Tournament must start after registration closes');
});
tournamentSchema.index({ status: 1, registrationEnd: 1 });
tournamentSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { delete r.__v; delete r.id; return r; } });
module.exports = model('Tournament', tournamentSchema);
