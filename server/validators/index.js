const { z } = require('zod');
const { GAMES } = require('../utils/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const password = z.string().min(8, 'Use at least 8 characters').max(72).regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
const phone = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');
const gameName = z.enum(GAMES.map((g) => g.name));

const member = z.object({
  name: z.string().trim().min(2).max(60),
  inGameName: z.string().trim().min(2).max(40),
  playerId: z.string().trim().min(3, 'Player ID is too short').max(40).regex(/^[A-Za-z0-9_\-#.]+$/, 'Player ID has invalid characters'),
  contact: z.string().trim().max(100).optional().or(z.literal('')),
  isCaptain: z.boolean().optional(),
});

const schemas = {
  id: z.object({ id: objectId }),
  memberParams: z.object({ id: objectId, memberId: objectId }),
  register: z.object({
    name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), phone, password,
    confirmPassword: z.string(), acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Accept the terms to continue' }) }),
  }).refine((d) => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
  forgot: z.object({ email: z.string().trim().toLowerCase().email() }),
  reset: z.object({ token: z.string().min(20), password }),
  verifyEmail: z.object({ token: z.string().min(20) }),
  profile: z.object({ name: z.string().trim().min(2).max(80).optional(), phone: phone.optional() }).strict(),
  member,
  teamCreate: z.object({
    teamName: z.string().trim().min(2).max(40), game: gameName,
    teamSize: z.number().int().min(1).max(6),
    members: z.array(member).min(1).max(6), substitute: member.optional().nullable(),
  }).refine((d) => d.members.length === d.teamSize, { path: ['members'], message: 'Member count must match the selected team size' }),
  teamUpdate: z.object({ teamName: z.string().trim().min(2).max(40).optional() }).strict(),
  registerTeam: z.object({ teamId: objectId }),
  createOrder: z.object({ registrationId: objectId }),
  verifyPayment: z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }),
  listQuery: z.object({
    page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().max(80).optional(), game: z.string().max(40).optional(), status: z.string().max(30).optional(),
    sort: z.enum(['date', 'fee', 'prize', 'newest']).optional(), tournamentId: objectId.optional(),
    from: z.string().optional(), to: z.string().optional(), role: z.string().optional(), maxFee: z.coerce.number().optional(),
  }),
  tournament: z.object({
    name: z.string().trim().min(3).max(100), game: gameName,
    description: z.string().max(4000).optional(), rules: z.array(z.string().max(300)).max(40).optional(),
    gameMode: z.string().max(60).optional(), map: z.string().max(60).optional(),
    allowedTeamSizes: z.array(z.number().int().min(1).max(6)).min(1).max(6),
    entryFee: z.number().min(0).max(100000), prizePool: z.number().min(0).max(100000000),
    prizeDistribution: z.array(z.object({ place: z.string().max(30), amount: z.number().min(0) })).max(20).optional(),
    maxTeams: z.number().int().min(2).max(5000),
    registrationStart: z.coerce.date(), registrationEnd: z.coerce.date(), tournamentStart: z.coerce.date(),
    timezone: z.string().max(60).optional(), refundPolicy: z.string().max(1000).optional(),
    manualApproval: z.boolean().optional(), autoGenerateSchedule: z.boolean().optional(),
    teamsPerMatch: z.number().int().min(2).max(100).optional(), matchIntervalMinutes: z.number().int().min(5).max(600).optional(),
    reminderMinutes: z.array(z.number().int().min(1).max(10080)).max(5).optional(),
    isPaused: z.boolean().optional(), status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional(),
  }),
  match: z.object({
    round: z.number().int().min(1).optional(), label: z.string().max(60).optional(),
    participatingTeams: z.array(objectId).max(100).optional(), scheduledAt: z.coerce.date().optional(),
    status: z.enum(['scheduled', 'live', 'completed', 'cancelled']).optional(),
    result: z.object({
      winnerTeamId: objectId.optional(), notes: z.string().max(500).optional(),
      standings: z.array(z.object({ teamId: objectId, placement: z.number().int().min(1), points: z.number().optional() })).optional(),
    }).optional(),
  }),
  adminTeamUpdate: z.object({
    teamName: z.string().trim().min(2).max(40).optional(), status: z.enum(['active', 'suspended']).optional(),
    members: z.array(member).min(1).max(6).optional(), substitute: member.optional().nullable(),
  }),
  adminUserUpdate: z.object({ accountStatus: z.enum(['active', 'suspended']).optional(), role: z.enum(['player', 'admin']).optional() }),
  refund: z.object({ reason: z.string().trim().min(3).max(200), cancelRegistration: z.boolean().optional() }),
  cancelReg: z.object({ refund: z.boolean().optional(), reason: z.string().max(200).optional() }),
};
module.exports = schemas;
