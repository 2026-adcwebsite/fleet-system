// The logged-in user's own permissions, for the frontend (hide/disable what the user cannot do).
//
//   GET /api/me/permissions
//   -> { permissions: { fleet: { canView, canCreate, canEdit, canDelete, canUpload, canExport }, maintenance: {...}, ... } }
//
// Keyed by module name (system, dashboard, fleet, maintenance, rollout). A module the role has no row for
// is returned with every flag false. Works while a password change is pending, so the app can still start.
const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../auth/session');

const router = express.Router();
router.use(requireAuth);

const FLAGS = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canUpload', 'canExport'];

router.get('/permissions', async (req, res) => {
  const [modules, rows] = await Promise.all([
    prisma.module.findMany({ orderBy: { id: 'asc' } }),
    prisma.permission.findMany({ where: { roleId: req.user.roleId } }),
  ]);
  const byModule = new Map(rows.map((p) => [p.moduleId, p]));

  const permissions = {};
  for (const m of modules) {
    const p = byModule.get(m.id);
    permissions[m.name] = Object.fromEntries(FLAGS.map((f) => [f, p ? Boolean(p[f]) : false]));
  }
  res.json({ permissions });
});

module.exports = router;
