const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
async function audit(adminId, action, entityType, entityId, changes) {
  try { await AuditLog.create({ adminId, action, entityType, entityId: String(entityId), changes }); }
  catch (err) { logger.error({ err }, 'audit log write failed'); }
}
module.exports = { audit };
