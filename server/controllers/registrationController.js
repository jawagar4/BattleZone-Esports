const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const { asyncHandler } = require('../utils/helpers');
const { computeFee } = require('../utils/phase');
const regService = require('../services/registrationService');

const populate = [{ path: 'tournamentId', select: 'name game bannerUrl entryFee prizePool tournamentStart registrationEnd refundPolicy' }, { path: 'teamId', select: 'teamName logoUrl members' }, { path: 'paymentId', select: 'status amount receiptNo gatewayPaymentId' }];

exports.mine = asyncHandler(async (req, res) => {
  const items = await Registration.find({ captainId: req.user._id }).sort({ createdAt: -1 }).populate(populate).lean();
  res.json({ success: true, data: { items } });
});

exports.get = asyncHandler(async (req, res) => {
  const r = await Registration.findOne({ _id: req.params.id, ...(req.user.role === 'admin' ? {} : { captainId: req.user._id }) }).populate(populate).lean();
  if (!r) throw ApiError.notFound('Registration not found');
  const fee = computeFee(r.tournamentId.entryFee, config.PLATFORM_FEE_PERCENT, config.TAX_PERCENT);
  const payments = await Payment.find({ registrationId: r._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { registration: r, fee, payments } });
});

// A captain can drop an unpaid registration to free the slot immediately.
exports.cancelUnpaid = asyncHandler(async (req, res) => {
  const r = await Registration.findOne({ _id: req.params.id, captainId: req.user._id });
  if (!r) throw ApiError.notFound('Registration not found');
  if (r.status !== 'pending_payment') throw ApiError.conflict('Only unpaid registrations can be cancelled here. Contact the organiser about refunds.');
  if (await Payment.exists({ registrationId: r._id, status: 'success' })) throw ApiError.conflict('This registration has a successful payment');
  await regService.releaseRegistration(r._id, 'cancelled');
  res.json({ success: true, data: {} });
});
