const h = require('./helpers');
const Tournament = require('../models/Tournament');
const Registration = require('../models/Registration');
beforeAll(h.setupDb); afterAll(h.teardownDb); beforeEach(h.clearDb);

describe('tournament registration', () => {
  test('rejects a team whose size is not allowed for the tournament', async () => {
    const t = await h.makeTournament({ allowedTeamSizes: [4] });
    const { agent } = await h.makeUser();
    const team = (await h.makeTeam(agent, 'Duo Squad', 'A', 2)).body.data.team;
    const res = await agent.post(`/api/v1/tournaments/${t._id}/register`).send({ teamId: team._id }).expect(400);
    expect(res.body.error.message).toMatch(/accepts teams of 4/);
  });

  test('team forms are validated (size mismatch, duplicate player IDs, duplicate team names)', async () => {
    const { agent } = await h.makeUser();
    await agent.post('/api/v1/teams').send({ teamName: 'Bad', game: 'BGMI', teamSize: 3, members: h.members(2) }).expect(422);
    const dup = h.members(2); dup[1].playerId = dup[0].playerId;
    await agent.post('/api/v1/teams').send({ teamName: 'Dupes', game: 'BGMI', teamSize: 2, members: dup }).expect(422);
    await h.makeTeam(agent, 'Alpha', 'A'); 
    await h.makeTeam(agent, 'alpha', 'B').then((r) => expect(r.status).toBe(409));
  });

  test('cannot exceed capacity under concurrent registrations', async () => {
    const t = await h.makeTournament({ maxTeams: 3 });
    const users = await Promise.all(Array.from({ length: 8 }, () => h.makeUser()));
    const teams = await Promise.all(users.map(async (u, i) => (await h.makeTeam(u.agent, `Team ${i}`, `T${i}`)).body.data.team));
    const results = await Promise.all(users.map((u, i) => u.agent.post(`/api/v1/tournaments/${t._id}/register`).send({ teamId: teams[i]._id })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    const fresh = await Tournament.findById(t._id);
    expect(fresh.reservedSlots).toBe(3);
    expect(await Registration.countDocuments({ tournamentId: t._id, active: true })).toBe(3);
  });

  test('a player cannot be enrolled twice in one tournament with different teams', async () => {
    const t = await h.makeTournament();
    const a = await h.makeUser(); const b = await h.makeUser();
    const ta = (await h.makeTeam(a.agent, 'Team A', 'SHARED')).body.data.team;
    const tb = (await h.makeTeam(b.agent, 'Team B', 'SHARED')).body.data.team; // same player IDs
    await a.agent.post(`/api/v1/tournaments/${t._id}/register`).send({ teamId: ta._id }).expect(201);
    const res = await b.agent.post(`/api/v1/tournaments/${t._id}/register`).send({ teamId: tb._id }).expect(409);
    expect(res.body.error.message).toMatch(/already enrolled/);
    expect((await Tournament.findById(t._id)).reservedSlots).toBe(1); // failed attempt handed its slot back
  });

  test('registration is blocked outside the registration window and for other captains', async () => {
    const closed = await h.makeTournament({ registrationEnd: new Date(Date.now() - 1000), tournamentStart: new Date(Date.now() + 1e6) });
    const a = await h.makeUser(); const b = await h.makeUser();
    const team = (await h.makeTeam(a.agent, 'Late', 'L')).body.data.team;
    await a.agent.post(`/api/v1/tournaments/${closed._id}/register`).send({ teamId: team._id }).expect(400);
    const open = await h.makeTournament();
    await b.agent.post(`/api/v1/tournaments/${open._id}/register`).send({ teamId: team._id }).expect(403);
  });

  test('expired holds release their slot', async () => {
    const t = await h.makeTournament();
    const a = await h.makeUser();
    const team = (await h.makeTeam(a.agent, 'Slow', 'S')).body.data.team;
    await a.agent.post(`/api/v1/tournaments/${t._id}/register`).send({ teamId: team._id }).expect(201);
    await Registration.updateMany({}, { holdExpiresAt: new Date(Date.now() - 1000) });
    await require('../jobs/scheduler').expireHolds(new Date());
    expect((await Tournament.findById(t._id)).reservedSlots).toBe(0);
  });
});
