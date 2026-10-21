const { Schema, model } = require('mongoose');
const auditSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  changes: Schema.Types.Mixed,
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.index({ entityType: 1, entityId: 1 });
auditSchema.index({ createdAt: -1 });
module.exports = model('AuditLog', auditSchema);
