const express = require("express");
const { prisma } = require("../db");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");

const router = express.Router();
router.use(requireAuth);

const FLAGS = [
  "canView",
  "canCreate",
  "canEdit",
  "canDelete",
  "canUpload",
  "canExport",
];

const flagsOf = (p) => Object.fromEntries(FLAGS.map((f) => [f, p[f]]));

// The whole matrix: roles, modules and one row per role x module.
router.get("/", requirePermission("system", "view"), async (req, res) => {
  const [roles, modules, permissions] = await Promise.all([
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.module.findMany({ orderBy: { id: "asc" } }),
    prisma.permission.findMany(),
  ]);
  res.json({ roles, modules, permissions });
});

// Change one cell of the matrix: PUT /api/permissions/:roleId/:moduleId
// Body: any of canView, canCreate, canEdit, canDelete, canUpload, canExport (booleans).
router.put(
  "/:roleId/:moduleId",
  requirePermission("system", "edit"),
  async (req, res) => {
    const roleId = Number(req.params.roleId);
    const moduleId = Number(req.params.moduleId);

    const [role, module] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId } }),
      prisma.module.findUnique({ where: { id: moduleId } }),
    ]);
    if (!role || !module)
      return res.status(404).json({ error: "Role or module not found" });

    const body = req.body || {};
    const data = {};
    for (const flag of FLAGS) {
      if (body[flag] === undefined) continue;
      if (typeof body[flag] !== "boolean") {
        return res.status(400).json({ error: `${flag} must be true or false` });
      }
      data[flag] = body[flag];
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    // Lockout protection: admin must always keep full access to the system module,
    // otherwise nobody could edit permissions or users again.
    if (role.name === "admin" && module.name === "system") {
      if (Object.values(data).some((v) => v === false)) {
        return res
          .status(400)
          .json({ error: "Admin must keep full access to the system module" });
      }
    }

    const where = { roleId_moduleId: { roleId, moduleId } };
    const before = await prisma.permission.findUnique({ where });

    const updated = await prisma.permission.upsert({
      where,
      update: data,
      create: { roleId, moduleId, ...data },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "update",
        entity: "Permission",
        entityId: updated.id,
        before: before
          ? { role: role.name, module: module.name, ...flagsOf(before) }
          : null,
        after: { role: role.name, module: module.name, ...flagsOf(updated) },
      },
    });

    res.json({ permission: updated });
  },
);

module.exports = router;
