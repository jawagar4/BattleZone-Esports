const User = require('../models/User');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Match = require('../models/Match');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const { asyncHandler, paginate, escapeRegex, toCsv } = require('../utils/helpers');
const { audit } = require('../services/audit');
const { notify } = require('../services/notify');
const regService = require('../services/registrationService');
const paymentService = require('../services/paymentService');
const teamService = require('../services/teamService');
const { generateSchedule } = require('../services/scheduleService');
const { emitToTournament } = require('../sockets');

const dateRange = (from, to) => (from || to) ? { createdAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {};

exports.dashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const [users, teams, tournaments, successPayments, pendingPayments, revenueAgg, upcoming, live, recent, occupancy] = await Promise.all([
    User.countDocuments({ role: 'player' }), Team.countDocuments(), Tournament.countDocuments(),
    Payment.countDocuments({ status: 'success' }), Payment.countDocuments({ status: 'pending' }),
    Payment.aggregate([{ $match: { status: { $in: ['success', 'refunded'] } } }, { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Tournament.find({ status: 'published', tournamentStart: { $gt: now } }).sort({ tournamentStart: 1 }).limit(5),
    Tournament.find({ status: 'published', tournamentStart: { $lte: now } }).sort({ tournamentStart: -1 }).limit(5),
    Registration.find().sort({ createdAt: -1 }).limit(8).populate('tournamentId', 'name').populate('captainId', 'name').lean(),
    Tournament.find({ status: 'published' }).select('name reservedSlots maxTeams').sort({ tournamentStart: 1 }).limit(8).lean(),
  ]);
  const rev = Object.fromEntries(revenueAgg.map((r) => [r._id, r]));
  res.json({ success: true, data: {
    totals: { users, teams, tournaments, successfulPayments: successPayments, pendingPayments },
    revenue: { gross: rev.success?.total || 0, refunded: rev.refunded?.total || 0, net: (rev.success?.total || 0) },
    upcoming, live, recentRegistrations: recent, occupancy,
  } });
});

/* ---------- Tournaments ---------- */
exports.listTournaments = asyncHandler(async (req, res) => {
  const { page, limit, search, game, status } = req.validatedQuery;
  const filter = { ...(game ? { game } : {}), ...(status ? { status } : {}), ...(search ? { name: new RegExp(escapeRegex(search), 'i') } : {}) };
  const { items, meta } = await paginate(Tournament, filter, { page, limit, sort: { createdAt: -1 } });
  res.json({ success: true, data: { items }, meta });
});

exports.getTournament = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw ApiError.notFound('Tournament not found');
  res.json({ success: true, data: { tournament: t } });
});

exports.createTournament = asyncHandler(async (req, res) => {
  const t = await Tournament.create({ ...req.body, createdBy: req.user._id, reservedSlots: 0 });
  await audit(req.user._id, 'tournament.create', 'Tournament', t._id, { name: t.name });
  res.status(201).json({ success: true, data: { tournament: t } });
});

exports.updateTournament = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw ApiError.notFound('Tournament not found');
  const before = t.toObject();
  if (req.body.maxTeams != null && req.body.maxTeams < t.reservedSlots) throw ApiError.badRequest(`${t.reservedSlots} teams already hold slots; capacity cannot go below that`);
  if (req.body.allowedTeamSizes && t.reservedSlots > 0) {
    const bad = await Registration.exists({ tournamentId: t._id, active: true, 'teamSnapshot.size': { $nin: req.body.allowedTeamSizes } });
    if (bad) throw ApiError.badRequest('Registered teams already use a team size you are removing');
  }
  const { status, ...rest } = req.body;
  Object.assign(t, rest);
  if (status) t.status = status;
  if (req.body.tournamentStart || req.body.registrationEnd) t.remindersSent = []; // rescheduled: reminders fire again
  await t.save();
  const changes = {};
  for (const k of Object.keys(req.body)) if (String(before[k]) !== String(t[k])) changes[k] = { from: before[k], to: t[k] };
  await audit(req.user._id, 'tournament.update', 'Tournament', t._id, changes);
  emitToTournament(String(t._id), 'tournament:update', { id: String(t._id), phase: t.phase, reservedSlots: t.reservedSlots, availableSlots: t.availableSlots, tournamentStart: t.tournamentStart, registrationEnd: t.registrationEnd });
  if (changes.tournamentStart || changes.isPaused) {
    const regs = await Registration.find({ tournamentId: t._id, status: { $in: ['confirmed', 'pending_approval'] } }).select('captainId');
    const msg = changes.isPaused ? (t.isPaused ? `${t.name} registration is paused.` : `${t.name} registration has resumed.`) : `${t.name} has been rescheduled to ${t.tournamentStart.toLocaleString('en-IN', { timeZone: t.timezone })}.`;
    await Promise.all([...new Set(regs.map((r) => String(r.captainId)))].map((id) => notify(id, 'Tournament update', msg, `/tournaments/${t._id}`)));
  }
  res.json({ success: true, data: { tournament: t } });
});

exports.deleteTournament = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw ApiError.notFound('Tournament not found');
  if (await Registration.exists({ tournamentId: t._id, active: true })) throw ApiError.conflict('This tournament has active registrations. Cancel it instead so entrants are notified.');
  await Match.deleteMany({ tournamentId: t._id });
  await t.deleteOne();
  await audit(req.user._id, 'tournament.delete', 'Tournament', t._id, { name: t.name });
  res.json({ success: true, data: {} });
});

exports.uploadBanner = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image to upload');
  const t = await Tournament.findByIdAndUpdate(req.params.id, { bannerUrl: `/uploads/${req.file.filename}` }, { returnDocument: 'after' });
  if (!t) throw ApiError.notFound('Tournament not found');
  await audit(req.user._id, 'tournament.banner', 'Tournament', t._id, { bannerUrl: t.bannerUrl });
  res.json({ success: true, data: { tournament: t } });
});

/* ---------- Matches ---------- */
exports.listMatches = asyncHandler(async (req, res) => {
  const items = await Match.find({ tournamentId: req.params.id }).sort({ scheduledAt: 1 }).populate('participatingTeams', 'teamName').lean();
  res.json({ success: true, data: { items } });
});
exports.createMatch = asyncHandler(async (req, res) => {
  if (!req.body.scheduledAt) throw ApiError.badRequest('scheduledAt is required');
  const m = await Match.create({ ...req.body, tournamentId: req.params.id });
  await audit(req.user._id, 'match.create', 'Match', m._id, req.body);
  res.status(201).json({ success: true, data: { match: m } });
});
exports.updateMatch = asyncHandler(async (req, res) => {
  const m = await Match.findOneAndUpdate({ _id: req.params.matchId, tournamentId: req.params.id }, { $set: req.body, ...(req.body.scheduledAt ? { reminderSent: false } : {}) }, { returnDocument: 'after', runValidators: true });
  if (!m) throw ApiError.notFound('Match not found');
  await audit(req.user._id, 'match.update', 'Match', m._id, req.body);
  res.json({ success: true, data: { match: m } });
});
exports.generateMatches = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(req.params.id);
  if (!t) throw ApiError.notFound('Tournament not found');
  const count = await generateSchedule(t, { force: true });
  await audit(req.user._id, 'match.generate', 'Tournament', t._id, { created: count });
  res.json({ success: true, data: { created: count } });
});

/* ---------- Registrations ---------- */
exports.approveRegistration = asyncHandler(async (req, res) => {
  const r = await Registration.findOneAndUpdate({ _id: req.params.id, status: 'pending_approval' }, { status: 'confirmed', confirmedAt: new Date() }, { returnDocument: 'after' }).populate('tournamentId', 'name');
  if (!r) throw ApiError.conflict('Only paid registrations awaiting approval can be approved');
  await audit(req.user._id, 'registration.approve', 'Registration', r._id);
  await notify(r.captainId, 'Registration confirmed', `${r.teamSnapshot.teamName} is confirmed for ${r.tournamentId.name}.`, '/dashboard');
  res.json({ success: true, data: { registration: r } });
});

async function cancelOrReject(req, res, newStatus) {
  const r = await Registration.findById(req.params.id).populate('tournamentId', 'name');
  if (!r) throw ApiError.notFound('Registration not found');
  if (!r.active) throw ApiError.conflict('This registration is already closed');
  const wantsRefund = newStatus === 'rejected' || req.body.refund === true;
  const payment = await Payment.findOne({ registrationId: r._id, status: 'success' });
  if (wantsRefund && payment) await paymentService.refund(payment, req.body.reason || `Registration ${newStatus}`, req.user._id);
  await regService.releaseRegistration(r._id, newStatus);
  await audit(req.user._id, `registration.${newStatus}`, 'Registration', r._id, { reason: req.body.reason, refunded: !!(wantsRefund && payment) });
  await notify(r.captainId, `Registration ${newStatus}`, `Your entry for ${r.tournamentId.name} was ${newStatus}.${wantsRefund && payment ? ' A refund has been initiated.' : ''}${req.body.reason ? ' Reason: ' + req.body.reason : ''}`, '/dashboard');
  res.json({ success: true, data: {} });
}
exports.rejectRegistration = asyncHandler((req, res) => cancelOrReject(req, res, 'rejected'));
exports.cancelRegistration = asyncHandler((req, res) => cancelOrReject(req, res, 'cancelled'));

/* ---------- Teams ---------- */
const teamFilter = async (q) => {
  const filter = {};
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    const captains = await User.find({ name: rx }).select('_id').limit(50);
    filter.$or = [{ teamName: rx }, { captainId: { $in: captains.map((c) => c._id) } }];
  }
  if (q.game) filter.game = q.game;
  if (q.tournamentId) {
    const ids = await Registration.find({ tournamentId: q.tournamentId, active: true }).distinct('teamId');
    filter._id = { $in: ids };
  }
  return filter;
};
exports.listTeams = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const { items, meta } = await paginate(Team, await teamFilter(req.validatedQuery), { page, limit, populate: { path: 'captainId', select: 'name email phone' } });
  res.json({ success: true, data: { items }, meta });
});
exports.exportTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find(await teamFilter(req.validatedQuery)).populate('captainId', 'name email phone').limit(10000).lean();
  const csv = toCsv(teams, [
    { header: 'Team', value: (t) => t.teamName }, { header: 'Game', value: (t) => t.game }, { header: 'Status', value: (t) => t.status },
    { header: 'Captain', value: (t) => t.captainId?.name }, { header: 'Captain email', value: (t) => t.captainId?.email }, { header: 'Captain phone', value: (t) => t.captainId?.phone },
    { header: 'Members', value: (t) => t.members.map((m) => `${m.name} (${m.inGameName} / ${m.playerId})`).join('; ') },
  ]);
  res.type('text/csv').attachment('teams.csv').send(csv);
});
exports.getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id).populate('captainId', 'name email phone');
  if (!team) throw ApiError.notFound('Team not found');
  const registrations = await Registration.find({ teamId: team._id }).populate('tournamentId', 'name').lean();
  res.json({ success: true, data: { team, registrations } });
});
exports.updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw ApiError.notFound('Team not found');
  const before = team.toObject();
  const { teamName, status, members, substitute } = req.body;
  let regs = [];
  if (members) {
    regs = await teamService.assertTeamEditable(team, { isAdmin: true, nextSize: members.length });
    const norm = teamService.normaliseMembers(members, substitute === undefined ? team.substitute?.toObject() : substitute);
    team.members = norm.members; team.substitute = norm.substitute;
  } else if (substitute !== undefined) team.substitute = substitute || undefined;
  if (teamName) team.teamName = teamName;
  if (status && status !== team.status) {
    team.status = status;
    await Registration.updateMany({ teamId: team._id, status: status === 'suspended' ? 'confirmed' : 'suspended' }, { status: status === 'suspended' ? 'suspended' : 'confirmed' });
    await notify(team.captainId, status === 'suspended' ? 'Team suspended' : 'Team reinstated', `Your team ${team.teamName} was ${status === 'suspended' ? 'suspended for a rule violation' : 'reinstated'}.`);
  }
  await team.save();
  if (members) await teamService.syncRegistrationKeys(team, regs);
  await audit(req.user._id, 'team.update', 'Team', team._id, { before: { teamName: before.teamName, status: before.status, members: before.members }, after: { teamName: team.teamName, status: team.status, members: team.members } });
  res.json({ success: true, data: { team } });
});

/* ---------- Payments ---------- */
const paymentFilter = async (q) => {
  const filter = { ...(q.status ? { status: q.status } : {}), ...(q.tournamentId ? { tournamentId: q.tournamentId } : {}), ...dateRange(q.from, q.to) };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    const ids = await Registration.find({ $or: [{ 'teamSnapshot.teamName': rx }, { registrationId: rx }] }).distinct('_id');
    filter.registrationId = { $in: ids };
  }
  return filter;
};
exports.listPayments = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const { items, meta } = await paginate(Payment, await paymentFilter(req.validatedQuery), { page, limit, populate: [{ path: 'userId', select: 'name email' }, { path: 'tournamentId', select: 'name' }, { path: 'registrationId', select: 'registrationId teamSnapshot' }] });
  res.json({ success: true, data: { items }, meta });
});
exports.exportPayments = asyncHandler(async (req, res) => {
  const rows = await Payment.find(await paymentFilter(req.validatedQuery)).populate('userId', 'name email').populate('tournamentId', 'name').populate('registrationId', 'registrationId teamSnapshot').limit(20000).lean();
  const csv = toCsv(rows, [
    { header: 'Date', value: (p) => new Date(p.createdAt).toISOString() }, { header: 'Receipt', value: (p) => p.receiptNo }, { header: 'Registration', value: (p) => p.registrationId?.registrationId },
    { header: 'Team', value: (p) => p.registrationId?.teamSnapshot?.teamName }, { header: 'Tournament', value: (p) => p.tournamentId?.name }, { header: 'Player', value: (p) => p.userId?.name },
    { header: 'Amount (INR)', value: (p) => (p.amount / 100).toFixed(2) }, { header: 'Status', value: (p) => p.status }, { header: 'Order ID', value: (p) => p.gatewayOrderId }, { header: 'Payment ID', value: (p) => p.gatewayPaymentId },
  ]);
  res.type('text/csv').attachment('payments.csv').send(csv);
});
// Reconciliation: asks the gateway what really happened to an order and applies the result.
exports.reconcilePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'success' || payment.status === 'refunded') return res.json({ success: true, data: { payment, changed: false } });
  const gw = await paymentService.fetchOrderPayments(payment.gatewayOrderId);
  const captured = gw.find((p) => p.status === 'captured' && Number(p.amount) === payment.amount);
  if (!captured) { await audit(req.user._id, 'payment.reconcile', 'Payment', payment._id, { result: 'no captured payment at gateway' }); return res.json({ success: true, data: { payment, changed: false, message: 'The gateway has no captured payment for this order.' } }); }
  const result = await paymentService.markPaid(payment, captured.id, 'reconciliation');
  await audit(req.user._id, 'payment.reconcile', 'Payment', payment._id, { gatewayPaymentId: captured.id });
  res.json({ success: true, data: { payment: result.payment, changed: true } });
});
exports.refundPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound('Payment not found');
  const updated = await paymentService.refund(payment, req.body.reason, req.user._id);
  if (req.body.cancelRegistration) await regService.releaseRegistration(payment.registrationId, 'cancelled');
  await audit(req.user._id, 'payment.refund', 'Payment', payment._id, { reason: req.body.reason, amount: payment.amount });
  res.json({ success: true, data: { payment: updated } });
});

/* ---------- Users ---------- */
exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, status, role } = req.validatedQuery;
  const rx = search && new RegExp(escapeRegex(search), 'i');
  const filter = { ...(status ? { accountStatus: status } : {}), ...(role ? { role } : {}), ...(rx ? { $or: [{ name: rx }, { email: rx }, { phone: rx }] } : {}) };
  const { items, meta } = await paginate(User, filter, { page, limit });
  res.json({ success: true, data: { items }, meta });
});
exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const [teams, registrations, payments] = await Promise.all([
    Team.find({ captainId: user._id }).select('teamName game status').lean(),
    Registration.find({ captainId: user._id }).sort({ createdAt: -1 }).limit(20).populate('tournamentId', 'name').lean(),
    Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  res.json({ success: true, data: { user, teams, registrations, payments } });
});
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+tokenVersion');
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own role or status');
  const changes = {};
  for (const k of ['accountStatus', 'role']) if (req.body[k] && req.body[k] !== user[k]) { changes[k] = { from: user[k], to: req.body[k] }; user[k] = req.body[k]; }
  if (changes.accountStatus || changes.role) user.tokenVersion += 1; // force re-authentication
  await user.save();
  await audit(req.user._id, 'user.update', 'User', user._id, changes);
  res.json({ success: true, data: { user } });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const { items, meta } = await paginate(AuditLog, {}, { page, limit, populate: { path: 'adminId', select: 'name email' } });
  res.json({ success: true, data: { items }, meta });
});
