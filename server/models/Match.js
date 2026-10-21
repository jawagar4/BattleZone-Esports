const { Schema, model } = require('mongoose');

const matchSchema = new Schema({
  tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true, index: true },
  round: { type: Number, default: 1 },
  label: String,
  participatingTeams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['scheduled', 'live', 'completed', 'cancelled'], default: 'scheduled' },
  reminderSent: { type: Boolean, default: false },
  result: {
    winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    standings: [{ teamId: { type: Schema.Types.ObjectId, ref: 'Team' }, placement: Number, points: Number }],
    notes: String,
  },
}, { timestamps: true });
module.exports = model('Match', matchSchema);
