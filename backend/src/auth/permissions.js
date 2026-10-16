const { prisma } = require("../db");

const ACTIONS = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
  upload: "canUpload",
  export: "canExport",
};

// Use after requireAuth: requirePermission('fleet', 'edit')
function requirePermission(moduleName, action) {
  const field = ACTIONS[action];
  if (!field) throw new Error(`Unknown action: ${action}`);

  return async (req, res, next) => {
    if (req.user.mustChangePassword) {
      return res
        .status(403)
        .json({
          error: "Password change required",
          code: "MUST_CHANGE_PASSWORD",
        });
    }

    const perm = await prisma.permission.findFirst({
      where: { roleId: req.user.roleId, module: { name: moduleName } },
    });

    if (!perm || !perm[field])
      return res.status(403).json({ error: "Not allowed" });
    next();
  };
}

module.exports = { requirePermission };
