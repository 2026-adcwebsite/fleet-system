const express = require("express");
const bcrypt = require("bcryptjs");
const { prisma } = require("../db");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { audit: writeAudit } = require("../lib/audit");

const router = express.Router();
router.use(requireAuth);

const STATUSES = ["active", "inactive", "pending"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const view = (u) => ({
  id: u.id,
  name: u.name,
  surname: u.surname,
  email: u.email,
  position: u.position,
  status: u.status,
  roleId: u.roleId,
  role: u.role.name,
  departmentId: u.departmentId,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
});

const isUniqueError = (err) => err && err.code === "P2002";

const audit = (req, action, user, before, after) =>
  writeAudit(req, action, "User", user.id, before, after);

// True if this change would leave the system without an active admin.
async function losesLastAdmin(target, next) {
  const isAdminNow =
    target.role.name === "admin" &&
    target.status === "active" &&
    !target.deletedAt;
  if (!isAdminNow) return false;
  if (next.roleName === "admin" && next.status === "active") return false;

  const others = await prisma.user.count({
    where: {
      id: { not: target.id },
      deletedAt: null,
      status: "active",
      role: { name: "admin" },
    },
  });
  return others === 0;
}

// Roles and departments for the create/edit form.
router.get(
  "/options",
  requirePermission("system", "view"),
  async (req, res) => {
    const [roles, departments] = await Promise.all([
      prisma.role.findMany({ orderBy: { id: "asc" } }),
      prisma.department.findMany({ orderBy: { name: "asc" } }),
    ]);
    res.json({ roles, departments, statuses: STATUSES });
  },
);

router.get("/", requirePermission("system", "view"), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { role: true },
    orderBy: [{ surname: "asc" }, { name: "asc" }],
  });
  res.json({ users: users.map(view) });
});

router.get("/:id", requirePermission("system", "view"), async (req, res) => {
  const user = await prisma.user.findFirst({
    where: { id: Number(req.params.id), deletedAt: null },
    include: { role: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: view(user) });
});

router.post("/", requirePermission("system", "create"), async (req, res) => {
  const { name, surname, email, position, roleId, departmentId, password } =
    req.body || {};

  if (!name || !surname || !email || !roleId || !password) {
    return res
      .status(400)
      .json({
        error: "name, surname, email, roleId and password are required",
      });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail))
    return res.status(400).json({ error: "Invalid email" });
  if (String(password).length < 10) {
    return res
      .status(400)
      .json({ error: "Temporary password must be at least 10 characters" });
  }

  const role = await prisma.role.findUnique({ where: { id: Number(roleId) } });
  if (!role) return res.status(400).json({ error: "Unknown role" });

  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: Number(departmentId) },
    });
    if (!dept) return res.status(400).json({ error: "Unknown department" });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        surname: String(surname).trim(),
        email: cleanEmail,
        position: position ? String(position).trim() : null,
        passwordHash: await bcrypt.hash(String(password), 12),
        mustChangePassword: true,
        status: "active",
        roleId: role.id,
        departmentId: departmentId ? Number(departmentId) : null,
      },
      include: { role: true },
    });
    await audit(req, "create", user, null, view(user));
    res.status(201).json({ user: view(user) });
  } catch (err) {
    if (isUniqueError(err))
      return res.status(409).json({ error: "Email already in use" });
    throw err;
  }
});

router.patch("/:id", requirePermission("system", "edit"), async (req, res) => {
  const id = Number(req.params.id);
  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { role: true },
  });
  if (!target) return res.status(404).json({ error: "User not found" });

  const body = req.body || {};
  const data = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.surname !== undefined) data.surname = String(body.surname).trim();
  if (body.position !== undefined)
    data.position = body.position ? String(body.position).trim() : null;

  if (body.email !== undefined) {
    const cleanEmail = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail))
      return res.status(400).json({ error: "Invalid email" });
    data.email = cleanEmail;
  }

  if (body.departmentId !== undefined) {
    if (body.departmentId === null) {
      data.departmentId = null;
    } else {
      const dept = await prisma.department.findUnique({
        where: { id: Number(body.departmentId) },
      });
      if (!dept) return res.status(400).json({ error: "Unknown department" });
      data.departmentId = dept.id;
    }
  }

  let nextRoleName = target.role.name;
  if (body.roleId !== undefined && Number(body.roleId) !== target.roleId) {
    if (target.id === req.user.id) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }
    const role = await prisma.role.findUnique({
      where: { id: Number(body.roleId) },
    });
    if (!role) return res.status(400).json({ error: "Unknown role" });
    data.roleId = role.id;
    nextRoleName = role.name;
  }

  let nextStatus = target.status;
  if (body.status !== undefined && body.status !== target.status) {
    if (!STATUSES.includes(body.status))
      return res.status(400).json({ error: "Invalid status" });
    if (target.id === req.user.id) {
      return res
        .status(400)
        .json({ error: "You cannot change your own status" });
    }
    data.status = body.status;
    nextStatus = body.status;
  }

  if (
    await losesLastAdmin(target, { roleName: nextRoleName, status: nextStatus })
  ) {
    return res
      .status(400)
      .json({ error: "There must be at least one active admin" });
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: { role: true },
    });

    // role or status changed: force a fresh login
    if (data.roleId !== undefined || data.status !== undefined) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }

    await audit(req, "update", updated, view(target), view(updated));
    res.json({ user: view(updated) });
  } catch (err) {
    if (isUniqueError(err))
      return res.status(409).json({ error: "Email already in use" });
    throw err;
  }
});

router.post(
  "/:id/reset-password",
  requirePermission("system", "edit"),
  async (req, res) => {
    const id = Number(req.params.id);
    const { password } = req.body || {};
    if (!password || String(password).length < 10) {
      return res
        .status(400)
        .json({ error: "Temporary password must be at least 10 characters" });
    }

    const target = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!target) return res.status(404).json({ error: "User not found" });

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(String(password), 12),
        mustChangePassword: true,
      },
    });
    await prisma.session.deleteMany({ where: { userId: id } });
    await audit(req, "reset_password", target, null, null);

    res.json({ ok: true });
  },
);

// Soft delete: the row stays for the audit trail, the user can no longer log in.
router.delete(
  "/:id",
  requirePermission("system", "delete"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id)
      return res.status(400).json({ error: "You cannot delete yourself" });

    const target = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
    if (!target) return res.status(404).json({ error: "User not found" });

    if (await losesLastAdmin(target, { roleName: null, status: "inactive" })) {
      return res
        .status(400)
        .json({ error: "There must be at least one active admin" });
    }

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "inactive" },
    });
    await prisma.session.deleteMany({ where: { userId: id } });
    await audit(req, "delete", target, view(target), null);

    res.json({ ok: true });
  },
);

module.exports = router;
