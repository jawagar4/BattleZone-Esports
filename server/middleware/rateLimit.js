const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const make = (windowMs, max, message) => rateLimit({
  windowMs, max: config.isTest ? 10000 : max, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message } },
});
module.exports = {
  api: make(15 * 60 * 1000, 600, 'Too many requests. Try again in a few minutes.'),
  auth: make(15 * 60 * 1000, 20, 'Too many attempts. Try again in 15 minutes.'),
  payments: make(15 * 60 * 1000, 60, 'Too many payment requests. Try again shortly.'),
};
