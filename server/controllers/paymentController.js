const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const Team = require('../models/Team');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { asyncHandler, paginate } = require('../utils/helpers');
const svc = require('../services/paymentService');

exports.createOrder = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.createOrder(req.user, req.body.registrationId) });
});

exports.verify = asyncHandler(async (req, res) => {
  const { payment, alreadyProcessed } = await svc.verifyCheckout(req.user, req.body);
  const registration = await Registration.findById(payment.registrationId);
  res.json({ success: true, data: { payment, registration, alreadyProcessed } });
});

// Mounted with express.raw() so the HMAC is computed over the exact bytes Razorpay sent.
exports.webhook = asyncHandler(async (req, res) => {
  await svc.handleWebhook(req.body, req.headers['x-razorpay-signature'], req.headers['x-razorpay-event-id']);
  res.json({ received: true });
});

exports.history = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.validatedQuery;
  const { items, meta } = await paginate(Payment, { userId: req.user._id, ...(status ? { status } : {}) }, {
    page, limit, populate: [{ path: 'tournamentId', select: 'name game' }, { path: 'registrationId', select: 'registrationId teamSnapshot status' }] });
  res.json({ success: true, data: { items }, meta });
});

exports.receipt = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment || (String(payment.userId) !== String(req.user._id) && req.user.role !== 'admin')) throw ApiError.notFound('Payment not found');
  if (payment.status === 'pending') throw ApiError.badRequest('Receipts are available once a payment is complete');
  const registration = await Registration.findById(payment.registrationId);
  const [tournament, team, User] = await Promise.all([Tournament.findById(payment.tournamentId), Team.findById(registration?.teamId), require('../models/User').findById(payment.userId)]);
  res.type('html').send(svc.receiptHtml({ payment, registration, tournament, team, user: User, appName: config.APP_NAME }));
});
