const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { asyncHandler } = require('../utils/helpers');

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd ,
  sameSite: config.COOKIE_SAMESITE,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

function signToken(user) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion}, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
}
const setAuthCookie = (res, user) => res.cookie('token', signToken(user), cookieOptions());
const clearAuthCookie = (res) => res.clearCookie('token', { ...cookieOptions(), maxAge: undefined });

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = req.cookies?.token || (header && header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) throw ApiError.unauthorized();
  let payload;
  try { payload = jwt.verify(token, config.JWT_SECRET); } catch { throw ApiError.unauthorized('Your session has expired. Sign in again.'); }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== payload.tv) throw ApiError.unauthorized('Your session has expired. Sign in again.');
  if (user.accountStatus !== 'active') throw ApiError.forbidden('This account is suspended. Contact support.');
  req.user = user;
  next();
});

// Always checked against the database record, never against client-supplied data.
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};
const requireAdmin = [authenticate, requireRole('admin')];

module.exports = { authenticate, requireRole, requireAdmin, setAuthCookie, clearAuthCookie, signToken };
