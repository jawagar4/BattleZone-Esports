const crypto = require('crypto');
const h = require('./helpers');
const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const paymentService = require('../services/paymentService');
beforeAll(h.setupDb); afterAll(h.teardownDb); beforeEach(h.clearDb);

const sign = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
// Fake Razorpay SDK so tests never touch the network.
function fakeGateway() {
  const payments = {};
  return {
    orders: { create: async ({ amount }) => ({ id: 'order_' + crypto.randomBytes(5).toString('hex'), amount }) },
    payments: {
      fetch: async (id) => payments[id], capture: async (id) => payments[id],
      refund: async () => ({ id: 'rfnd_1' }),
    },
    _set: (id, v) => { payments[id] = v; },
  };
}

async function setup() {
  const gw = fakeGateway(); paymentService.setGatewayClient(gw);
  const t = await h.makeTournament(); const u = await h.makeUser();
  const team = (await h.makeTeam(u.agent, 'Payers', 'PAY')).body.data.team;
  const reg = (await u.agent.post(`/api/v1/tournaments/${t._id}/register`).send({ teamId: team._id }).expect(201)).body.data.registration;
  const order = (await u.agent.post('/api/v1/payments/create-order').send({ registrationId: reg._id }).expect(200)).body.data;
  return { gw, t, u, reg, order };
}

describe('payments', () => {
  test('order amount is computed on the server and create-order is idempotent', async () => {
    const { u, reg, order } = await setup();
    expect(order.amount).toBe(10000);
    const again = (await u.agent.post('/api/v1/payments/create-order').send({ registrationId: reg._id, amount: 1 }).expect(200)).body.data;
    expect(again.orderId).toBe(order.orderId);
    expect(await Payment.countDocuments()).toBe(1);
  });

  test('a forged checkout signature never confirms a registration', async () => {
    const { u, reg, order } = await setup();
    await u.agent.post('/api/v1/payments/verify').send({ razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_fake', razorpay_signature: 'f'.repeat(64) }).expect(400);
    expect((await Registration.findById(reg._id)).status).toBe('pending_payment');
    expect((await Payment.findOne()).status).toBe('pending');
  });

  test('a valid signature confirms once, even if verified repeatedly', async () => {
    const { gw, u, reg, order } = await setup();
    gw._set('pay_ok', { id: 'pay_ok', order_id: order.orderId, amount: order.amount, status: 'captured' });
    const sig = sign(process.env.RAZORPAY_KEY_SECRET, `${order.orderId}|pay_ok`);
    const payload = { razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_ok', razorpay_signature: sig };
    await u.agent.post('/api/v1/payments/verify').send(payload).expect(200);
    const second = await u.agent.post('/api/v1/payments/verify').send(payload).expect(200);
    expect(second.body.data.alreadyProcessed).toBe(true);
    expect((await Registration.findById(reg._id)).status).toBe('confirmed');
  });

  test('a signature for a different amount is rejected', async () => {
    const { gw, u, order } = await setup();
    gw._set('pay_low', { id: 'pay_low', order_id: order.orderId, amount: 100, status: 'captured' });
    const sig = sign(process.env.RAZORPAY_KEY_SECRET, `${order.orderId}|pay_low`);
    await u.agent.post('/api/v1/payments/verify').send({ razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_low', razorpay_signature: sig }).expect(400);
  });

  test('webhooks require a valid signature, confirm payments, and ignore replays', async () => {
    const { reg, order } = await setup();
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_wh', order_id: order.orderId, amount: order.amount } } } });
    await h.request(h.app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'bad').send(raw).expect(400);
    const good = sign(process.env.RAZORPAY_WEBHOOK_SECRET, raw);
    await h.request(h.app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', good).set('x-razorpay-event-id', 'evt_1').send(raw).expect(200);
    await h.request(h.app).post('/api/v1/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', good).set('x-razorpay-event-id', 'evt_1').send(raw).expect(200);
    expect((await Registration.findById(reg._id)).status).toBe('confirmed');
    expect((await Payment.findOne()).verifiedVia).toBe('webhook');
    expect((await Tournament.findOne()).reservedSlots).toBe(1);
  });

  test('players cannot read other players receipts; admins can refund', async () => {
    const { gw, u, order } = await setup();
    gw._set('pay_r', { id: 'pay_r', order_id: order.orderId, amount: order.amount, status: 'captured' });
    await u.agent.post('/api/v1/payments/verify').send({ razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_r', razorpay_signature: sign(process.env.RAZORPAY_KEY_SECRET, `${order.orderId}|pay_r`) }).expect(200);
    const payment = await Payment.findOne();
    await u.agent.get(`/api/v1/payments/${payment._id}/receipt`).expect(200);
    const other = await h.makeUser(); await other.agent.get(`/api/v1/payments/${payment._id}/receipt`).expect(404);
    await other.agent.post(`/api/v1/admin/payments/${payment._id}/refund`).send({ reason: 'x y z' }).expect(403);
    const admin = await h.makeUser('admin');
    await admin.agent.post(`/api/v1/admin/payments/${payment._id}/refund`).send({ reason: 'Organiser cancelled', cancelRegistration: true }).expect(200);
    expect((await Payment.findById(payment._id)).status).toBe('refunded');
    expect((await Tournament.findOne()).reservedSlots).toBe(0);
  });
});
