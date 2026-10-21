class ApiError extends Error {
  constructor(status, message, code = 'ERROR', details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(m, d) { return new ApiError(400, m, 'BAD_REQUEST', d); }
  static unauthorized(m = 'Please sign in to continue') { return new ApiError(401, m, 'UNAUTHORIZED'); }
  static forbidden(m = 'You do not have permission to do that') { return new ApiError(403, m, 'FORBIDDEN'); }
  static notFound(m = 'Not found') { return new ApiError(404, m, 'NOT_FOUND'); }
  static conflict(m, d) { return new ApiError(409, m, 'CONFLICT', d); }
}
module.exports = ApiError;
