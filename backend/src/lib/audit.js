const { prisma } = require("../db");

// JSON-safe copy (Dates become strings, Decimals become strings). null/undefined are
// left out of the row entirely: Prisma rejects a literal null for a Json column.
const plain = (v) =>
  v === null || v === undefined ? undefined : JSON.parse(JSON.stringify(v));

// Insert one AuditLog row for the logged-in user.
// audit(req, 'update', 'Vehicle', vehicle.id, beforeObj, afterObj)
// Pass `db` (a transaction client) as the last argument to write inside a transaction.
function audit(
  req,
  action,
  entity,
  entityId,
  before = null,
  after = null,
  db = prisma,
) {
  return db.auditLog.create({
    data: {
      userId: req.user ? req.user.id : null,
      action,
      entity,
      entityId: entityId ?? null,
      before: plain(before),
      after: plain(after),
    },
  });
}

module.exports = { audit };
