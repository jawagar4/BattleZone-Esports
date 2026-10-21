const h = require('./helpers');
beforeAll(h.setupDb); afterAll(h.teardownDb); beforeEach(h.clearDb);

const body = { name: 'Asha Devi', email: 'asha@test.dev', phone: '9876543210', password: 'Passw0rd!', confirmPassword: 'Passw0rd!', acceptTerms: true };

describe('authentication', () => {
  test('registers a player, sets an httpOnly cookie, ignores a client-supplied role', async () => {
    const res = await h.request(h.app).post('/api/v1/auth/register').send({ ...body, role: 'admin' }).expect(201);
    expect(res.body.data.user.role).toBe('player');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/token=.*HttpOnly/i);
  });
  test('rejects duplicate emails and weak passwords', async () => {
    await h.request(h.app).post('/api/v1/auth/register').send(body).expect(201);
    await h.request(h.app).post('/api/v1/auth/register').send(body).expect(409);
    await h.request(h.app).post('/api/v1/auth/register').send({ ...body, email: 'b@test.dev', password: 'short', confirmPassword: 'short' }).expect(422);
  });
  test('login fails with a wrong password and works with the right one', async () => {
    await h.request(h.app).post('/api/v1/auth/register').send(body).expect(201);
    await h.request(h.app).post('/api/v1/auth/login').send({ email: body.email, password: 'Wrong123!' }).expect(401);
    const agent = h.request.agent(h.app);
    await agent.post('/api/v1/auth/login').send({ email: body.email, password: body.password }).expect(200);
    await agent.get('/api/v1/auth/me').expect(200);
  });
  test('protected routes need a session', async () => { await h.request(h.app).get('/api/v1/users/dashboard').expect(401); });
  test('suspended accounts lose access immediately', async () => {
    const { user, agent } = await h.makeUser();
    await require('../models/User').updateOne({ _id: user._id }, { accountStatus: 'suspended' });
    await agent.get('/api/v1/auth/me').expect(403);
  });
});

describe('admin permissions', () => {
  test('players cannot reach admin APIs; admins can', async () => {
    const player = await h.makeUser('player'); const admin = await h.makeUser('admin');
    for (const path of ['/dashboard', '/teams', '/payments', '/users', '/tournaments']) {
      await player.agent.get(`/api/v1/admin${path}`).expect(403);
      await h.request(h.app).get(`/api/v1/admin${path}`).expect(401);
      await admin.agent.get(`/api/v1/admin${path}`).expect(200);
    }
    await player.agent.post('/api/v1/admin/tournaments').send({}).expect(403);
  });
  test('admin role changes are audited and revoke old sessions', async () => {
    const admin = await h.makeUser('admin'); const target = await h.makeUser('player');
    await admin.agent.patch(`/api/v1/admin/users/${target.user._id}`).send({ role: 'admin' }).expect(200);
    await target.agent.get('/api/v1/auth/me').expect(401);
    const logs = await admin.agent.get('/api/v1/admin/audit-logs').expect(200);
    expect(logs.body.data.items[0].action).toBe('user.update');
  });
});
