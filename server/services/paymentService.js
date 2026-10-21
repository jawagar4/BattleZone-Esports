const crypto = require('crypto');
const Razorpay = require('razorpay');
const config = require('../config/env');
const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Tournament = require('../models/Tournament');
const WebhookEvent = require('../models/WebhookEvent');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { receiptCode, timingSafeEqualHex } = require('../utils/helpers');
const { computeFee } = require('../utils/phase');
const reg = require('./registrationService');
const { notify } = require('./notify');

let client = null;
const gateway = () => {
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new ApiError(503, 'Online payments are not configured yet', 'PAYMENTS_UNAVAILABLE');
  if (!client) client = new Razorpay({ key_id: config.RAZORPAY_KEY_ID, key_secret: config.RAZORPAY_KEY_SECRET });
  return client;
};
const setGatewayClient = (c) => { client = c; }; // test hook

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const verifyCheckoutSignature = (orderId, paymentId, signature) =>
  timingSafeEqualHex(hmac(config.RAZORPAY_KEY_SECRET || '', `${orderId}|${paymentId}`), signature);
const verifyWebhookSignature = (rawBody, signature) =>
  !!config.RAZORPAY_WEBHOOK_SECRET && !!signature && timingSafeEqualHex(hmac(config.RAZORPAY_WEBHOOK_SECRET, rawBody), signature);

async function createOrder(user, registrationId) {
  const r = await Registration.findOne({ _id: registrationId, captainId: user._id });
  if (!r) throw ApiError.notFound('Registration not found');
  if (r.status !== 'pending_payment') throw ApiError.conflict('This registration does not need a payment');
  if (r.holdExpiresAt && r.holdExpiresAt < new Date()) throw new ApiError(410, 'Your slot hold expired. Register again to continue.', 'HOLD_EXPIRED');
  const t = await Tournament.findById(r.tournamentId);
  // The amount is always recomputed on the server; the client never supplies it.
  const fee = computeFee(t.entryFee, config.PLATFORM_FEE_PERCENT, config.TAX_PERCENT);
  if (fee.total <= 0) throw ApiError.badRequest('No payment is required for this tournament');

  const pending = await Payment.findOne({ registrationId: r._id, status: 'pending', amount: fee.total }).sort({ createdAt: -1 });
  let payment = pending;
  if (!payment) {
    const order = await gateway().orders.create({ amount: fee.total, currency: 'INR', receipt: r.registrationId, notes: { registrationId: r.registrationId, tournament: t.name } });
    payment = await Payment.create({
      registrationId: r._id, tournamentId: t._id, userId: user._id, amount: fee.total, currency: 'INR',
      breakdown: { entryFee: fee.entryFee, platformFee: fee.platformFee, tax: fee.tax }, gatewayOrderId: order.id, status: 'pending',
    });
  }
  await Registration.updateOne({ _id: r._id }, { holdExpiresAt: new Date(Date.now() + config.REGISTRATION_HOLD_MINUTES * 60000) });
  return { orderId: payment.gatewayOrderId, amount: payment.amount, currency: payment.currency, keyId: config.RAZORPAY_KEY_ID, paymentRecordId: payment._id,
    prefill: { name: user.name, email: user.email, contact: user.phone }, breakdown: payment.breakdown, registrationId: r.registrationId };
}

// Idempotent: flips pending/failed -> success once, then finalises the registration.
async function markPaid(paymentDoc, gatewayPaymentId, via) {
  const updated = await Payment.findOneAndUpdate(
    { _id: paymentDoc._id, status: { $in: ['pending', 'failed'] } },
    { status: 'success', gatewayPaymentId, verifiedVia: via, verifiedAt: new Date(), receiptNo: paymentDoc.receiptNo || receiptCode(), $unset: { failureReason: 1 } },
    { returnDocument: 'after' });
  const payment = updated || (await Payment.findById(paymentDoc._id));
  if (!updated) return { payment, alreadyProcessed: true };

  const result = await reg.finalizeRegistration(payment.registrationId, payment._id);
  if (result?.needsRefund) {
    logger.warn({ paymentId: payment.id }, 'Payment arrived for an expired, full registration; refunding');
    await refund(payment, 'Slot no longer available after payment hold expired', null, { system: true });
  }
  return { payment, alreadyProcessed: false };
}

async function verifyCheckout(user, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const payment = await Payment.findOne({ gatewayOrderId: razorpay_order_id, userId: user._id });
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'success') return { payment, alreadyProcessed: true };
  if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    throw new ApiError(400, 'Payment signature could not be verified', 'INVALID_SIGNATURE');
  }
  // Cross-check with the gateway so the amount/status are confirmed server-side.
  let gp = await gateway().payments.fetch(razorpay_payment_id);
  if (gp.order_id !== razorpay_order_id || Number(gp.amount) !== payment.amount) throw new ApiError(400, 'Payment details do not match this order', 'PAYMENT_MISMATCH');
  if (gp.status === 'authorized') gp = await gateway().payments.capture(razorpay_payment_id, payment.amount, payment.currency);
  if (gp.status !== 'captured') throw new ApiError(402, 'The payment has not been completed', 'PAYMENT_INCOMPLETE');
  return markPaid(payment, razorpay_payment_id, 'checkout');
}

async function handleWebhook(rawBody, signature, eventIdHeader) {
  if (!verifyWebhookSignature(rawBody, signature)) throw new ApiError(400, 'Invalid webhook signature', 'INVALID_SIGNATURE');
  const event = JSON.parse(rawBody.toString('utf8'));
  const eventId = eventIdHeader || `${event.event}:${event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.id}`;
  try { await WebhookEvent.create({ eventId, type: event.event }); }
  catch (err) { if (err.code === 11000) return { duplicate: true }; throw err; }

  const p = event.payload?.payment?.entity;
  if (event.event === 'payment.captured' && p) {
    const payment = await Payment.findOne({ gatewayOrderId: p.order_id });
    if (payment && Number(p.amount) === payment.amount) await markPaid(payment, p.id, 'webhook');
    else logger.warn({ order: p.order_id }, 'Webhook captured amount mismatch or unknown order');
  } else if (event.event === 'payment.failed' && p) {
    await Payment.updateOne({ gatewayOrderId: p.order_id, status: 'pending' }, { status: 'failed', failureReason: p.error_description || 'Payment failed' });
  } else if (event.event === 'refund.processed') {
    const rf = event.payload?.refund?.entity;
    if (rf) await Payment.updateOne({ gatewayPaymentId: rf.payment_id, status: { $ne: 'refunded' } }, { status: 'refunded', gatewayRefundId: rf.id, refundedAt: new Date() });
  }
  return { duplicate: false };
}

async function refund(paymentDoc, reason, adminId, { system = false } = {}) {
  const payment = await Payment.findById(paymentDoc._id || paymentDoc);
  if (!payment || payment.status !== 'success') throw ApiError.conflict('Only successful payments can be refunded');
  const rf = await gateway().payments.refund(payment.gatewayPaymentId, { amount: payment.amount, notes: { reason, by: system ? 'system' : String(adminId) } });
  const updated = await Payment.findOneAndUpdate({ _id: payment._id, status: 'success' }, { status: 'refunded', gatewayRefundId: rf.id, refundedAt: new Date(), refundReason: reason }, { returnDocument: 'after' });
  if (updated) await notify(updated.userId, 'Refund initiated', `Your payment of ₹${(updated.amount / 100).toFixed(2)} is being refunded. It can take 5-7 working days to reach your account.`, '/payments');
  return updated || payment;
}

function receiptHtml({ payment, registration, tournament, team, user, appName }) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = (p) => '₹' + (p / 100).toFixed(2);
  const b = payment.breakdown || {};
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(payment.receiptNo)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#111}h1{margin:0}table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:8px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}.muted{color:#555;font-size:14px}.total td{font-weight:700;border-top:2px solid #111}@media print{button{display:none}}</style></head><body>
<h1>${esc(appName)}</h1><p class="muted">Payment receipt ${esc(payment.receiptNo || '')}</p>
<p><b>${esc(user.name)}</b><br><span class="muted">${esc(user.email)}</span></p>
<table><tr><td>Tournament</td><td>${esc(tournament?.name)}</td></tr><tr><td>Team</td><td>${esc(team?.teamName || registration?.teamSnapshot?.teamName)}</td></tr>
<tr><td>Registration ID</td><td>${esc(registration?.registrationId)}</td></tr><tr><td>Transaction ID</td><td>${esc(payment.gatewayPaymentId || payment.gatewayOrderId)}</td></tr>
<tr><td>Status</td><td>${esc(payment.status)}</td></tr><tr><td>Date</td><td>${esc(new Date(payment.verifiedAt || payment.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST</td></tr></table>
<table><tr><td>Entry fee</td><td>${rs(b.entryFee || 0)}</td></tr><tr><td>Platform fee</td><td>${rs(b.platformFee || 0)}</td></tr><tr><td>Tax</td><td>${rs(b.tax || 0)}</td></tr><tr class="total"><td>Total paid</td><td>${rs(payment.amount)}</td></tr></table>
<button onclick="window.print()">Print or save as PDF</button></body></html>`;
}

module.exports = { createOrder, verifyCheckout, handleWebhook, refund, markPaid, receiptHtml, verifyCheckoutSignature, verifyWebhookSignature, setGatewayClient };

async function fetchOrderPayments(orderId) {
  const res = await gateway().orders.fetchPayments(orderId);
  return res.items || [];
}
module.exports.fetchOrderPayments = fetchOrderPayments;
