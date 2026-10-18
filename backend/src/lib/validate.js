// Request validation with zod.
//
//   const { z } = require('zod');
//   const { validate } = require('../lib/validate');
//
//   router.post('/', validate({ body: z.object({ plate: z.string().min(1) }) }), (req, res) => {
//     const { plate } = req.valid.body;   // parsed, trimmed, converted values
//   });
//
// Accepts any of: body, query, params. On failure: 400 with a list of field errors.
// Parsed values land in req.valid.* (req.query is read-only in Express 5).
function validate(schemas) {
  return (req, res, next) => {
    req.valid = {};

    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;

      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: result.error.issues.map((i) => ({
            field: [part === 'body' ? null : part, ...i.path].filter((p) => p !== null).join('.'),
            message: i.message,
          })),
        });
      }
      req.valid[part] = result.data;
    }

    next();
  };
}

module.exports = { validate };
