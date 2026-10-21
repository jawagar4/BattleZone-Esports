const ApiError = require('../utils/ApiError');
// validate({ body: schema, query: schema, params: schema })
module.exports = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new ApiError(422, details[0] ? `${details[0].field ? details[0].field + ': ' : ''}${details[0].message}` : 'Invalid input', 'VALIDATION_ERROR', details));
    }
    if (part === 'query') { Object.defineProperty(req, 'validatedQuery', { value: result.data }); } else req[part] = result.data;
  }
  next();
};
