const { Schema, model } = require('mongoose');
const { GAMES } = require('../utils/constants');

const memberSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 60 },
  inGameName: { type: String, required: true, trim: true, maxlength: 40 },
  playerId: { type: String, required: true, trim: true, maxlength: 40 },
  contact: { type: String, trim: true, maxlength: 100 },
  isCaptain: { type: Boolean, default: false },
});

const teamSchema = new Schema({
  teamName: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
  teamNameKey: { type: String, required: true, unique: true },
  logoUrl: { type: String },
  game: { type: String, required: true, enum: GAMES.map((g) => g.name) },
  captainId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: { type: [memberSchema], validate: [(v) => v.length >= 1 && v.length <= 6, 'A team needs 1 to 6 members'] },
  substitute: { type: memberSchema, default: undefined },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
}, { timestamps: true });

teamSchema.pre('validate', function () {
  this.teamNameKey = (this.teamName || '').trim().toLowerCase();
  const all = [...this.members, ...(this.substitute ? [this.substitute] : [])];
  const ids = all.map((m) => m.playerId.toLowerCase());
  if (new Set(ids).size !== ids.length) this.invalidate('members', 'Each player ID must be unique within the team');
  if (this.members.filter((m) => m.isCaptain).length !== 1) this.invalidate('members', 'Exactly one member must be the captain');
});
teamSchema.index({ teamName: 'text' });
module.exports = model('Team', teamSchema);
