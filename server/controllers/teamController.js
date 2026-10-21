const Team = require('../models/Team');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');
const svc = require('../services/teamService');

async function ownedTeam(req) {
  const team = await Team.findById(req.params.id);
  if (!team) throw ApiError.notFound('Team not found');
  if (String(team.captainId) !== String(req.user._id) && req.user.role !== 'admin') throw ApiError.forbidden('Only the team captain can do that');
  return team;
}

exports.create = asyncHandler(async (req, res) => {
  const { teamName, game, members, substitute } = req.body;
  const norm = svc.normaliseMembers(members, substitute);
  const team = await Team.create({ teamName, game, captainId: req.user._id, ...norm });
  res.status(201).json({ success: true, data: { team } });
});

exports.mine = asyncHandler(async (req, res) => {
  const teams = await Team.find({ captainId: req.user._id }).sort({ createdAt: -1 }).lean();
  const regs = await Registration.find({ teamId: { $in: teams.map((t) => t._id) }, active: true }).populate('tournamentId', 'name game tournamentStart').lean();
  teams.forEach((t) => { t.registrations = regs.filter((r) => String(r.teamId) === String(t._id)); });
  res.json({ success: true, data: { items: teams } });
});

exports.get = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  const regs = await Registration.find({ teamId: team._id }).populate('tournamentId', 'name game tournamentStart status').populate('paymentId', 'status amount receiptNo').lean();
  res.json({ success: true, data: { team, registrations: regs } });
});

exports.update = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  await svc.assertTeamEditable(team, { isAdmin: req.user.role === 'admin' });
  if (req.body.teamName) team.teamName = req.body.teamName;
  await team.save();
  res.json({ success: true, data: { team } });
});

exports.remove = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  if (await Registration.exists({ teamId: team._id, active: true })) throw ApiError.conflict('Cancel this team\'s tournament registrations before deleting it');
  await team.deleteOne();
  res.json({ success: true, data: {} });
});

exports.uploadLogo = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  team.logoUrl = `/uploads/${req.file.filename}`;
  await team.save();
  res.json({ success: true, data: { team } });
});

exports.addMember = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  if (team.members.length >= 6) throw ApiError.badRequest('A team can have at most 6 members');
  const regs = await svc.assertTeamEditable(team, { isAdmin: req.user.role === 'admin', nextSize: team.members.length + 1 });
  team.members.push({ ...req.body, contact: req.body.contact || undefined, isCaptain: false });
  await team.save();
  await svc.syncRegistrationKeys(team, regs);
  res.status(201).json({ success: true, data: { team } });
});

exports.updateMember = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  const regs = await svc.assertTeamEditable(team, { isAdmin: req.user.role === 'admin' });
  const m = team.members.id(req.params.memberId);
  if (!m) throw ApiError.notFound('Member not found');
  const { name, inGameName, playerId, contact } = req.body;
  Object.assign(m, { name, inGameName, playerId, contact: contact || undefined });
  await team.save();
  await svc.syncRegistrationKeys(team, regs);
  res.json({ success: true, data: { team } });
});

exports.removeMember = asyncHandler(async (req, res) => {
  const team = await ownedTeam(req);
  const m = team.members.id(req.params.memberId);
  if (!m) throw ApiError.notFound('Member not found');
  if (m.isCaptain) throw ApiError.badRequest('Make another member captain before removing the captain');
  if (team.members.length <= 1) throw ApiError.badRequest('A team needs at least one member');
  const regs = await svc.assertTeamEditable(team, { isAdmin: req.user.role === 'admin', nextSize: team.members.length - 1 });
  m.deleteOne();
  await team.save();
  await svc.syncRegistrationKeys(team, regs);
  res.json({ success: true, data: { team } });
});
