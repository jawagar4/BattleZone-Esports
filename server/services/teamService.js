const Team = require('../models/Team');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const ApiError = require('../utils/ApiError');
const { ACTIVE_REG_STATUSES } = require('../utils/constants');

// Normalises client input into schema-shaped members (exactly one captain).
function normaliseMembers(members, substitute) {
  const list = members.map((m, i) => ({ ...m, contact: m.contact || undefined, isCaptain: m.isCaptain === true }));
  if (!list.some((m) => m.isCaptain)) list[0].isCaptain = true;
  let seen = false;
  list.forEach((m) => { if (m.isCaptain && seen) m.isCaptain = false; if (m.isCaptain) seen = true; });
  return { members: list, substitute: substitute ? { ...substitute, contact: substitute.contact || undefined, isCaptain: false } : undefined };
}

// Returns the active registrations (with tournaments) that constrain edits to this team.
async function activeRegistrations(teamId) {
  return Registration.find({ teamId, active: true }).populate('tournamentId');
}

// Members can change only while registration is open for every tournament the team is entered in
// and the result must still be a legal team size. Admins bypass the time lock via `isAdmin`.
async function assertTeamEditable(team, { isAdmin = false, nextSize } = {}) {
  const regs = await activeRegistrations(team._id);
  for (const r of regs) {
    const t = r.tournamentId;
    if (!t) continue;
    if (!isAdmin && (new Date() >= t.registrationEnd || new Date() >= t.tournamentStart)) {
      throw ApiError.forbidden(`Registration for "${t.name}" is closed, so this team can no longer be edited. Contact an admin for changes.`);
    }
    if (nextSize != null && !t.allowedTeamSizes.includes(nextSize)) {
      throw ApiError.badRequest(`"${t.name}" allows team sizes of ${t.allowedTeamSizes.join(', ')}. This change would make the team ${nextSize}.`);
    }
  }
  return regs;
}

// Keeps registration duplicate-protection keys in sync after the roster changes.
async function syncRegistrationKeys(team, regs) {
  const keys = [...team.members, ...(team.substitute ? [team.substitute] : [])].map((m) => m.playerId.toLowerCase());
  for (const r of regs) {
    try {
      await Registration.updateOne({ _id: r._id }, { playerKeys: keys, 'teamSnapshot.size': team.members.length });
    } catch (err) {
      if (err.code === 11000) throw ApiError.conflict('One of these players is already enrolled in this tournament with another team');
      throw err;
    }
  }
}

async function assertGameMatchesTournament(team, tournamentId) {
  const t = await Tournament.findById(tournamentId);
  if (!t) throw ApiError.notFound('Tournament not found');
  if (t.game !== team.game) throw ApiError.badRequest(`This tournament is for ${t.game}; your team plays ${team.game}`);
  return t;
}

module.exports = { normaliseMembers, assertTeamEditable, syncRegistrationKeys, assertGameMatchesTournament, ACTIVE_REG_STATUSES };
