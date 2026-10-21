const http = require('http');
const mongoose = require('mongoose');
const config = require('./config/env');
const logger = require('./utils/logger');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSockets } = require('./sockets');
const { startScheduler, stopScheduler } = require('./jobs/scheduler');

(async () => {
  await connectDB();
  // Make sure unique/partial indexes exist before accepting traffic: capacity and duplicate protection depend on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const server = http.createServer(app);
  initSockets(server);
  await startScheduler();
  server.listen(config.PORT, () => logger.info(`${config.APP_NAME} API listening on :${config.PORT} (${config.NODE_ENV})`));

  const shutdown = async (sig) => {
    logger.info(`${sig} received, shutting down`);
    server.close();
    await stopScheduler();
    await mongoose.connection.close();
    process.exit(0);
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
})().catch((err) => { logger.error({ err }, 'Failed to start'); process.exit(1); });
