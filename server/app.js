const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');
const config = require('./config/env');
const logger = require('./utils/logger');
const rl = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');
const { uploadsDir } = require('./middleware/upload');
const paymentController = require('./controllers/paymentController');
const routes = require('./routes');

const app = express();
app.set('trust proxy', config.TRUST_PROXY);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
 const allowedOrigins = [
  "https://battle-zone-esports.vercel.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(compression());
if (!config.isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

// Health checks (before rate limiting so orchestrators are never throttled).
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/ready', (_req, res) => (mongoose.connection.readyState === 1 ? res.json({ status: 'ready' }) : res.status(503).json({ status: 'database unavailable' })));

// Webhook needs the raw bytes for signature verification, so it is registered before express.json().
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.webhook);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', index: false }));
app.use('/api/v1', rl.api, routes);
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Battle Zone API is running!",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack || err);

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});


app.use(notFound);
app.use(errorHandler);
module.exports = app;
