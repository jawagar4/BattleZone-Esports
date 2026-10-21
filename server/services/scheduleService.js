const Registration = require('../models/Registration');
const Match = require('../models/Match');

// Groups confirmed teams into lobbies/matches of `teamsPerMatch`, spaced by `matchIntervalMinutes`.
// This only produces a timetable; results are entered by organisers. Gameplay is not automated.
async function generateSchedule(tournament, { force = false } = {}) {
  if (tournament.scheduleGenerated && !force) return 0;
  const regs = await Registration.find({ tournamentId: tournament._id, status: 'confirmed' }).select('teamId').lean();
  if (regs.length < 2) return 0;
  if (force) await Match.deleteMany({ tournamentId: tournament._id, status: 'scheduled', round: 1 });
  const teams = regs.map((r) => r.teamId).sort(() => Math.random() - 0.5);
  const size = tournament.teamsPerMatch || 2;
  const docs = [];
  for (let i = 0, n = 0; i < teams.length; i += size, n += 1) {
    const group = teams.slice(i, i + size);
    if (group.length < 2 && docs.length) { docs[docs.length - 1].participatingTeams.push(...group); break; }
    docs.push({
      tournamentId: tournament._id, round: 1, label: `Round 1 · Match ${n + 1}`, participatingTeams: group,
      scheduledAt: new Date(tournament.tournamentStart.getTime() + n * tournament.matchIntervalMinutes * 60000),
    });
  }
  await Match.insertMany(docs);
  tournament.scheduleGenerated = true;
  await tournament.save();
  return docs.length;
}
module.exports = { generateSchedule };
