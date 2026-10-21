const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Team = require('../models/Team');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { registrationCode } = require('../utils/helpers');
const { computePhase, computeFee } = require('../utils/phase');
const { ACTIVE_REG_STATUSES } = require('../utils/constants');
const { notify } = require('./notify');
const { emitToTournament, emitToAdmins } = require('../sockets');

const broadcastSlots = (t) => emitToTournament(String(t._id), 'tournament:update', {
  id: String(t._id), reservedSlots: t.reservedSlots, availableSlots: Math.max(0, t.maxTeams - t.reservedSlots), phase: computePhase(t),
});

/**
 * Starts a registration. The slot is reserved with a single atomic conditional update
 * ($expr reservedSlots < maxTeams), so concurrent requests can never exceed capacity.
 * Partial unique indexes on Registration stop duplicate teams/players. If the insert fails
 * the reserved slot is handed back.
 */
async function startRegistration(user, tournamentId, teamId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament || tournament.status !== 'published') throw ApiError.notFound('Tournament not found');
  const phase = computePhase(tournament);
  if (phase === 'full') throw ApiError.conflict('This tournament is full');
  if (phase !== 'registration_open') throw ApiError.badRequest(phase === 'upcoming' ? 'Registration has not opened yet' : phase === 'paused' ? 'Registration is paused by the organiser' : 'Registration is closed');

  const team = await Team.findById(teamId);
  if (!team || String(team.captainId) !== String(user._id)) throw ApiError.forbidden('You can only register teams you captain');
  if (team.status !== 'active') throw ApiError.forbidden('This team is suspended');
  if (team.game !== tournament.game) throw ApiError.badRequest(`This tournament is for ${tournament.game}; your team plays ${team.game}`);
  if (!tournament.allowedTeamSizes.includes(team.members.length)) {
    throw ApiError.badRequest(`This tournament accepts teams of ${tournament.allowedTeamSizes.join(' or ')}. Your team has ${team.members.length}.`);
  }

  // Reuse an unpaid registration for the same team instead of failing on the unique index.
  const existing = await Registration.findOne({ tournamentId, teamId, active: true });
  if (existing) {
    if (existing.status === 'pending_payment') return { registration: existing, tournament, reused: true };
    throw ApiError.conflict('This team is already registered for this tournament');
  }

  const reserved = await Tournament.findOneAndUpdate(
    { _id: tournamentId, status: 'published', $expr: { $lt: ['$reservedSlots', '$maxTeams'] } },
    { $inc: { reservedSlots: 1 } }, { returnDocument: 'after' });
  if (!reserved) throw ApiError.conflict('This tournament just filled up');

  const fee = computeFee(tournament.entryFee, config.PLATFORM_FEE_PERCENT, config.TAX_PERCENT);
  const playerKeys = [...team.members, ...(team.substitute ? [team.substitute] : [])].map((m) => m.playerId.toLowerCase());
  let registration;
  try {
    registration = await Registration.create({
      registrationId: registrationCode(), tournamentId, teamId, captainId: user._id, playerKeys, active: true,
      status: 'pending_payment', amountDue: fee.total, teamSnapshot: { teamName: team.teamName, size: team.members.length },
      holdExpiresAt: new Date(Date.now() + config.REGISTRATION_HOLD_MINUTES * 60000),
    });
  } catch (err) {
    await Tournament.updateOne({ _id: tournamentId, reservedSlots: { $gt: 0 } }, { $inc: { reservedSlots: -1 } });
    if (err.code === 11000) {
      const key = Object.keys(err.keyPattern || {});
      throw ApiError.conflict(key.includes('playerKeys') ? 'One of your players is already enrolled in this tournament with another team' : 'This team is already registered for this tournament');
    }
    throw err;
  }
  broadcastSlots(reserved);

  if (fee.total === 0) await finalizeRegistration(registration._id, null); // free tournaments skip payment
  return { registration: await Registration.findById(registration._id), tournament: reserved, reused: false };
}

// Moves a paid (or free) registration forward. Safe to call repeatedly.
async function finalizeRegistration(registrationId, paymentId) {
  const reg = await Registration.findById(registrationId);
  if (!reg) return null;
  const tournament = await Tournament.findById(reg.tournamentId);
  const next = tournament.manualApproval ? 'pending_approval' : 'confirmed';

  let updated = await Registration.findOneAndUpdate(
    { _id: reg._id, status: 'pending_payment', active: true },
    { status: next, ...(paymentId ? { paymentId } : {}), confirmedAt: next === 'confirmed' ? new Date() : undefined, $unset: { holdExpiresAt: 1 } }, { returnDocument: 'after' });

  if (!updated && reg.status === 'expired') {
    // Money arrived after the hold lapsed: take the slot back if one is still free.
    const slot = await Tournament.findOneAndUpdate({ _id: reg.tournamentId, $expr: { $lt: ['$reservedSlots', '$maxTeams'] } }, { $inc: { reservedSlots: 1 } }, { returnDocument: 'after' });
    if (slot) {
      try {
        updated = await Registration.findOneAndUpdate({ _id: reg._id, status: 'expired' },
          { status: next, active: true, ...(paymentId ? { paymentId } : {}), confirmedAt: next === 'confirmed' ? new Date() : undefined, $unset: { holdExpiresAt: 1 } }, { returnDocument: 'after' });
        if (!updated) await Tournament.updateOne({ _id: reg.tournamentId }, { $inc: { reservedSlots: -1 } });
      } catch (err) { await Tournament.updateOne({ _id: reg.tournamentId }, { $inc: { reservedSlots: -1 } }); if (err.code !== 11000) throw err; }
    }
    if (!updated) return { reg, needsRefund: true };
  }
  if (updated) {
    if (paymentId) await Registration.updateOne({ _id: reg._id }, { paymentId });
    const msg = next === 'confirmed'
      ? `${updated.teamSnapshot.teamName} is confirmed for ${tournament.name}. Your registration ID is ${updated.registrationId}.`
      : `Payment received for ${updated.teamSnapshot.teamName}. An organiser will approve your entry for ${tournament.name} soon.`;
    await notify(updated.captainId, next === 'confirmed' ? 'Registration confirmed' : 'Payment received', msg, '/dashboard');
    emitToAdmins('registration:new', { registrationId: updated.registrationId, tournament: tournament.name });
    broadcastSlots(tournament);
  }
  return { reg: updated || reg, needsRefund: false };
}

// Frees the slot exactly once: only the call that flips active true -> false decrements the counter.
async function releaseRegistration(registrationId, newStatus) {
  const reg = await Registration.findOneAndUpdate({ _id: registrationId, active: true }, { status: newStatus, active: false }, { returnDocument: 'after' });
  if (!reg) return null;
  const t = await Tournament.findOneAndUpdate({ _id: reg.tournamentId, reservedSlots: { $gt: 0 } }, { $inc: { reservedSlots: -1 } }, { returnDocument: 'after' });
  if (t) broadcastSlots(t);
  return reg;
}

module.exports = { startRegistration, finalizeRegistration, releaseRegistration, ACTIVE_REG_STATUSES };
