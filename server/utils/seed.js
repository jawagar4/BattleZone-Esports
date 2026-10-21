/* Development seed: node utils/seed.js [--reset] */
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const config = require('../config/env');
const { connectDB } = require('../config/database');
const User = require('../models/User');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Match = require('../models/Match');

const H = 3600 * 1000, D = 24 * H;
const at = (ms) => new Date(Date.now() + ms);

async function run() {
  if (config.isProd) throw new Error('Refusing to seed in production');
  await connectDB();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  if (process.argv.includes('--reset')) {
    await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
    console.log('Collections cleared');
  }

  const upsertUser = async (email, data) => {
    const existing = await User.findOne({ email });
    if (existing) return existing;
    return User.create({ email, emailVerified: true, passwordHash: await bcrypt.hash(data.password, 12), ...data.fields });
  };
  const admin = await upsertUser(config.SEED_ADMIN_EMAIL, { password: config.SEED_ADMIN_PASSWORD, fields: { name: 'Jawagar', phone: '9361056289', role: 'admin' } });
  const player = await upsertUser('jawagar100@gmail.com', { password: 'Jawagar@09', fields: { name: 'Jawagar', phone: '9384056289' } });

  if (await Tournament.countDocuments() === 0) {
    const base = { createdBy: admin._id, status: 'published', timezone: 'Asia/Kolkata' };
    const rules = ['Players must join the custom room 10 minutes before start.', 'Emulators and third-party tools are not allowed.', 'Teams must use the in-game names they registered with.', 'Organiser decisions are final.'];
    const list = await Tournament.insertMany([
      { ...base, name: 'Free Fire Bermuda', game: 'Free Fire', description: 'Four-player squads, six matches, one champion.', rules, gameMode: 'squrad', map: 'Bermuda', allowedTeamSizes: [4], entryFee: 20, prizePool: 500, prizeDistribution: [{ place: '1st', amount: 250 }, { place: '2nd', amount: 150 }, { place: '3rd', amount: 100 }], maxTeams: 25, teamsPerMatch: 25, registrationStart: at(-2 * D), registrationEnd: at(2 * D), tournamentStart: at(3 * D), autoGenerateSchedule: true },
      { ...base, name: 'Free Fire Clash Squrad', game: 'Free Fire', description: 'Fast duo lobbies for weekend grinders.', rules, gameMode: 'Duo', map: 'Bermuda', allowedTeamSizes: [2], entryFee: 50, prizePool: 10000, maxTeams: 24, teamsPerMatch: 12, registrationStart: at(-1 * D), registrationEnd: at(1 * D), tournamentStart: at(1.5 * D) },
      { ...base, name: 'Free Fire Kalahari', game: 'Free Fire', description: 'Single-elimination bracket for five-stack teams.', rules, gameMode: 'Standard', map: 'Bind, Haven, Ascent', allowedTeamSizes: [5, 6], entryFee: 500, prizePool: 100000, maxTeams: 16, registrationStart: at(2 * D), registrationEnd: at(9 * D), tournamentStart: at(10 * D), manualApproval: true },
      { ...base, name: 'CODM Solo Sprint', game: 'Call of Duty Mobile', description: 'Free-to-enter solo qualifier.', rules, gameMode: 'Battle Royale Solo', map: 'Isolated', allowedTeamSizes: [1], entryFee: 0, prizePool: 5000, maxTeams: 100, teamsPerMatch: 50, registrationStart: at(-1 * D), registrationEnd: at(4 * D), tournamentStart: at(5 * D) },
      { ...base, name: 'Free Fire Lone Wolf (Live)', game: 'Free Fire', description: 'Solo lobbies, happening now.', rules, gameMode: 'Solo', map: 'Purgatory', allowedTeamSizes: [1], entryFee: 30, prizePool: 3000, maxTeams: 48, teamsPerMatch: 12, registrationStart: at(-5 * D), registrationEnd: at(-1 * D), tournamentStart: at(-1 * H) },
      { ...base, name: 'BGMI Winter Cup', game: 'BGMI', description: 'Last season\'s champions cup.', rules, gameMode: 'TPP Squad', map: 'Erangel', allowedTeamSizes: [4], entryFee: 150, prizePool: 30000, maxTeams: 25, teamsPerMatch: 25, registrationStart: at(-30 * D), registrationEnd: at(-20 * D), tournamentStart: at(-18 * D), status: 'completed' },
    ]);

    const squad = (prefix, n) => Array.from({ length: n }, (_, i) => ({ name: `${prefix} Player ${i + 1}`, inGameName: `${prefix}_${i + 1}`, playerId: `${prefix.toUpperCase()}${5000 + i}`, isCaptain: i === 0 }));
    const demoTeam = await Team.create({ teamName: 'Coimbatore Kings', game: 'BGMI', captainId: player._id, members: squad('Kings', 4) });
    const bgmi = list[0];
    const reg = await Registration.create({ registrationId: 'BZ-DEMO0001', tournamentId: bgmi._id, teamId: demoTeam._id, captainId: player._id, status: 'confirmed', active: true,
      playerKeys: demoTeam.members.map((m) => m.playerId.toLowerCase()), teamSnapshot: { teamName: demoTeam.teamName, size: 4 }, amountDue: 20000, confirmedAt: new Date() });
    const pay = await Payment.create({ registrationId: reg._id, tournamentId: bgmi._id, userId: player._id, amount: 20000, breakdown: { entryFee: 20000, platformFee: 0, tax: 0 }, gatewayOrderId: 'order_seed_demo', gatewayPaymentId: 'pay_seed_demo', status: 'success', receiptNo: 'RCPT-SEED-0001', verifiedVia: 'reconciliation', verifiedAt: new Date() });
    await Registration.updateOne({ _id: reg._id }, { paymentId: pay._id });
    await Tournament.updateOne({ _id: bgmi._id }, { reservedSlots: 1 });
    await Match.create({ tournamentId: bgmi._id, round: 1, label: 'Round 1 · Match 1', participatingTeams: [demoTeam._id], scheduledAt: bgmi.tournamentStart });
    console.log('Seeded 6 tournaments, 1 team, 1 confirmed registration');
  } else console.log('Tournaments already exist; use --reset to rebuild');

  console.log(`\nAdmin:  ${config.SEED_ADMIN_EMAIL} / ${config.SEED_ADMIN_PASSWORD}\nPlayer: jawagar100@gmail.com / Jawagar@09\n(The demo payment is a seeded record, not a real gateway transaction.)`);
  await mongoose.connection.close();
}
run().catch((e) => { console.error(e); process.exit(1); });
