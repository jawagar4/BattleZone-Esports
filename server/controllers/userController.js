const User = require('../models/User');
const Team = require('../models/Team');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const { asyncHandler } = require('../utils/helpers');

exports.getProfile = (req, res) => res.json({ success: true, data: { user: req.user } });

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { $set: req.body }, { returnDocument: 'after', runValidators: true });
  res.json({ success: true, data: { user } });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const uid = req.user._id;
  const [teams, registrations, payments, unread, notifications] = await Promise.all([
    Team.find({ captainId: uid }).select('teamName logoUrl game members status').lean(),
    Registration.find({ captainId: uid }).sort({ createdAt: -1 }).limit(50)
      .populate('tournamentId', 'name game bannerUrl tournamentStart registrationEnd status isPaused reservedSlots maxTeams registrationStart prizePool entryFee')
      .populate('teamId', 'teamName').lean(),
    Payment.find({ userId: uid }).sort({ createdAt: -1 }).limit(5).lean(),
    Notification.countDocuments({ userId: uid, readAt: null }),
    Notification.find({ userId: uid }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const teamIds = teams.map((t) => t._id);
  const upcomingMatches = await Match.find({ participatingTeams: { $in: teamIds }, scheduledAt: { $gte: new Date() }, status: { $in: ['scheduled', 'live'] } })
    .sort({ scheduledAt: 1 }).limit(10).populate('tournamentId', 'name game').populate('participatingTeams', 'teamName').lean();
  const confirmed = registrations.filter((r) => r.status === 'confirmed');
  const nextTournament = confirmed
    .filter((r) => r.tournamentId && new Date(r.tournamentId.tournamentStart) > new Date())
    .sort((a, b) => new Date(a.tournamentId.tournamentStart) - new Date(b.tournamentId.tournamentStart))[0]?.tournamentId || null;
  res.json({ success: true, data: {
    stats: { tournamentsJoined: confirmed.length, teams: teams.length, totalPaid: payments.filter((p) => p.status === 'success').reduce((s, p) => s + p.amount, 0) },
    teams, registrations, recentPayments: payments, upcomingMatches, unreadNotifications: unread, notifications, nextTournament,
  } });
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: { items } });
});
exports.markRead = asyncHandler(async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true, data: {} });
});
exports.markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true, data: {} });
});
