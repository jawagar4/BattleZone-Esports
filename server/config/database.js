const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

async function connectDB(uri = config.MONGODB_URI) {
  await mongoose.connect(uri, { maxPoolSize: 50, serverSelectionTimeoutMS: 10000 });
  logger.info('MongoDB connected');
  return mongoose.connection;
}
module.exports = { connectDB };
