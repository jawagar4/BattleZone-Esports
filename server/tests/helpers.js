const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Tournament = require('../models/Tournament');

let mongod;
async function setupDb() {
  // TEST_MONGODB_URI lets you run against a local mongod / throwaway Atlas database instead of downloading a MongoDB binary.
  // NEVER point it at real data: every collection is wiped between tests.
  if (process.env.TEST_MONGODB_URI) await mongoose.connect(process.env.TEST_MONGODB_URI);
  else { mongod = await MongoMemoryServer.create(); await mongoose.connect(mongod.getUri()); }
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build unique + partial indexes
}
async function teardownDb() { await mongoose.disconnect(); if (mongod) await mongod.stop(); }
async function clearDb() { await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({}))); }

let n = 0;
async function makeUser(role = 'player') {
  n += 1;
  const email = `user${n}_${Date.now()}@test.dev`;
  const passwordHash = await bcrypt.hash('Passw0rd!', 4);
  const user = await User.create({ name: `Test User ${n}`, email, phone: '9876543210', passwordHash, role, emailVerified: true });
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({ email, password: 'Passw0rd!' }).expect(200);
  return { user, agent };
}

const members = (n, prefix = 'P') => Array.from({ length: n }, (_, i) => ({ name: `Player ${i}`, inGameName: `${prefix}${i}`, playerId: `${prefix}-${1000 + i}`, isCaptain: i === 0 }));

async function makeTournament(overrides = {}) {
  const now = Date.now();
  return Tournament.create({
    name: 'Test Cup', game: 'BGMI', allowedTeamSizes: [2], entryFee: 100, prizePool: 1000, maxTeams: 3, status: 'published',
    registrationStart: new Date(now - 3600e3), registrationEnd: new Date(now + 86400e3), tournamentStart: new Date(now + 2 * 86400e3), ...overrides,
  });
}
async function makeTeam(agent, name, prefix, size = 2, game = 'BGMI') {
  const res = await agent.post('/api/v1/teams').send({ teamName: name, game, teamSize: size, members: members(size, prefix) });
  return res;
}
module.exports = { app, request, setupDb, teardownDb, clearDb, makeUser, makeTournament, makeTeam, members };
