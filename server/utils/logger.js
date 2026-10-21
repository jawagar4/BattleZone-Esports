const pino = require('pino');
const config = require('../config/env');
module.exports = pino({
  level: config.isTest ? 'silent' : config.isProd ? 'info' : 'debug',
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', '*.password', '*.passwordHash'],
});
