const bcrypt = require('bcrypt');
const User = require('../models/User');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');
const { asyncHandler, sha256, randomToken } = require('../utils/helpers');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');

const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12); // equalises timing for unknown emails

async function issueVerification(user) {
  const token = randomToken();
  user.emailVerifyTokenHash = sha256(token);
  user.emailVerifyExpires = new Date(Date.now() + 24 * 3600 * 1000);
  await user.save();
  const link = `${config.CLIENT_URL.split(',')[0]}/verify-email?token=${token}`;
  await sendMail({ to: user.email, subject: `Verify your ${config.APP_NAME} email`, text: `Hi ${user.name},\n\nVerify your email: ${link}\n\nThe link expires in 24 hours.` });
}

exports.register = asyncHandler(async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(password, 12);
  // role is never taken from the request: public sign-ups are always players.
  const user = await User.create({ name, email, phone, passwordHash, role: 'player' });
  await issueVerification(user);
  if (!config.REQUIRE_EMAIL_VERIFICATION) setAuthCookie(res, user);
  res.status(201).json({ success: true, data: { user, emailVerificationRequired: config.REQUIRE_EMAIL_VERIFICATION } });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  if (user.accountStatus !== 'active') throw ApiError.forbidden('This account is suspended. Contact support.');
  if (config.REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) throw new ApiError(403, 'Verify your email before signing in', 'EMAIL_NOT_VERIFIED');
  setAuthCookie(res, user);
  res.json({ success: true, data: { user } });
});

exports.logout = (_req, res) => { clearAuthCookie(res); res.json({ success: true, data: { message: 'Signed out' } }); };
exports.me = (req, res) => res.json({ success: true, data: { user: req.user } });

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.accountStatus === 'active') {
    const token = randomToken();
    user.resetTokenHash = sha256(token);
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const link = `${config.CLIENT_URL.split(',')[0]}/reset-password?token=${token}`;
    await sendMail({ to: user.email, subject: `Reset your ${config.APP_NAME} password`, text: `Reset your password: ${link}\n\nThe link expires in 30 minutes. Ignore this email if you did not ask for it.` });
  }
  // Same response either way so emails cannot be enumerated.
  res.json({ success: true, data: { message: 'If that email has an account, a reset link is on its way.' } });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: sha256(req.body.token), resetTokenExpires: { $gt: new Date() } }).select('+resetTokenHash +resetTokenExpires +tokenVersion');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.resetTokenHash = undefined; user.resetTokenExpires = undefined;
  user.tokenVersion += 1; // signs out every existing session
  await user.save();
  clearAuthCookie(res);
  res.json({ success: true, data: { message: 'Password updated. Sign in with your new password.' } });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ emailVerifyTokenHash: sha256(req.body.token), emailVerifyExpires: { $gt: new Date() } }).select('+emailVerifyTokenHash +emailVerifyExpires');
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired');
  user.emailVerified = true; user.emailVerifyTokenHash = undefined; user.emailVerifyExpires = undefined;
  await user.save();
  res.json({ success: true, data: { message: 'Email verified' } });
});

exports.resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user.emailVerified) await issueVerification(user);
  res.json({ success: true, data: { message: 'Verification email sent' } });
});
