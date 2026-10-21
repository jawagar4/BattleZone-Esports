const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Match = require('../models/Match');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const { asyncHandler, paginate, escapeRegex } = require('../utils/helpers');
const { computeFee } = require('../utils/phase');
const regService = require('../services/registrationService');
const { GAMES } = require('../utils/constants');

const PUBLIC_STATUSES = ['published', 'completed'];

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, search, game, status, sort, maxFee } = req.validatedQuery;
  const filter = { status: { $in: PUBLIC_STATUSES } };
  if (game) filter.game = game;
  if (search) filter.name = new RegExp(escapeRegex(search), 'i');
  if (maxFee != null) filter.entryFee = { $lte: maxFee };
  const now = new Date();
  // Phase filters are expressed as date/slot conditions so pagination stays accurate.
  const phaseFilters = {
    upcoming: { status: 'published', registrationStart: { $gt: now } },
    registration_open: { status: 'published', registrationStart: { $lte: now }, registrationEnd: { $gt: now }, tournamentStart: { $gt: now }, isPaused: false, $expr: { $lt: ['$reservedSlots', '$maxTeams'] } },
    full: { status: 'published', tournamentStart: { $gt: now }, $expr: { $gte: ['$reservedSlots', '$maxTeams'] } },
    live: { status: 'published', tournamentStart: { $lte: now } },
    completed: { status: 'completed' },
  };
  if (status && phaseFilters[status]) Object.assign(filter, phaseFilters[status]);
  const sortMap = { date: { tournamentStart: 1 }, fee: { entryFee: 1 }, prize: { prizePool: -1 }, newest: { createdAt: -1 } };
  const { items, meta } = await paginate(Tournament, filter, { page, limit, sort: sortMap[sort] || { tournamentStart: 1 } });
  res.json({ success: true, data: { items }, meta });
});

exports.get = asyncHandler(async (req, res) => {
  const t = await Tournament.findOne({ _id: req.params.id, status: { $in: [...PUBLIC_STATUSES, 'cancelled'] } });
  if (!t) throw ApiError.notFound('Tournament not found');
  const matches = await Match.find({ tournamentId: t._id }).sort({ scheduledAt: 1 }).populate('participatingTeams', 'teamName logoUrl').lean();
  res.json({ success: true, data: { tournament: t, matches, fee: computeFee(t.entryFee, config.PLATFORM_FEE_PERCENT, config.TAX_PERCENT), serverTime: new Date() } });
});

exports.games = (_req, res) => res.json({ success: true, data: { items: GAMES } });

// Public showcase: confirmed teams for a tournament (names only).
exports.publicTeams = asyncHandler(async (req, res) => {
  const regs = await Registration.find({ tournamentId: req.params.id, status: 'confirmed' }).populate('teamId', 'teamName logoUrl').lean();
  res.json({ success: true, data: { items: regs.map((r) => ({ teamName: r.teamId?.teamName, logoUrl: r.teamId?.logoUrl })) } });
});

exports.register = asyncHandler(async (req, res) => {
  const { registration, tournament, reused } = await regService.startRegistration(req.user, req.params.id, req.body.teamId);
  res.status(reused ? 200 : 201).json({ success: true, data: { registration, requiresPayment: registration.status === 'pending_payment', fee: computeFee(tournament.entryFee, config.PLATFORM_FEE_PERCENT, config.TAX_PERCENT) } });
});

// Admin-only list of registrations for a tournament.
exports.registrations = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.validatedQuery;
  const filter = { tournamentId: req.params.id, ...(status ? { status } : {}) };
  const { items, meta } = await paginate(Registration, filter, { page, limit, sort: { createdAt: -1 }, populate: [{ path: 'teamId', select: 'teamName members' }, { path: 'captainId', select: 'name email phone' }, { path: 'paymentId', select: 'status amount receiptNo' }] });
  res.json({ success: true, data: { items }, meta });
});
