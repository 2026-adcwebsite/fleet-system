const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { prisma } = require("../db");
const {
  createSession,
  destroySession,
  requireAuth,
  hash,
  COOKIE,
} = require("../auth/session");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "Too many attempts, try again later" },
});

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  surname: u.surname,
  email: u.email,
  role: u.role.name,
  departmentId: u.departmentId,
  mustChangePassword: u.mustChangePassword,
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email).trim().toLowerCase() },
    include: { role: true },
  });

  const ok =
    user &&
    !user.deletedAt &&
    user.status === "active" &&
    (await bcrypt.compare(password, user.passwordHash));

  if (!ok) {
    await prisma.auditLog.create({
      data: {
        userId: user ? user.id : null,
        action: "login_failed",
        entity: "User",
        entityId: user ? user.id : null,
        after: { email: String(email) },
      },
    });
    return res.status(401).json({ error: "Invalid email or password" });
  }

  await createSession(res, user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "login",
      entity: "User",
      entityId: user.id,
    },
  });

  res.json({ user: publicUser(user) });
});

router.post("/logout", async (req, res) => {
  await destroySession(req, res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password required" });
  }
  if (newPassword.length < 10) {
    return res
      .status(400)
      .json({ error: "New password must be at least 10 characters" });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: "New password must be different" });
  }
  if (!(await bcrypt.compare(currentPassword, req.user.passwordHash))) {
    return res.status(401).json({ error: "Current password is wrong" });
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
    },
  });

  // log out every other device, keep this one
  await prisma.session.deleteMany({
    where: { userId: req.user.id, id: { not: hash(req.cookies[COOKIE]) } },
  });

  await prisma.auditLog.create({
    data: {
      userId: req.user.id,
      action: "change_password",
      entity: "User",
      entityId: req.user.id,
    },
  });

  res.json({ ok: true });
});

module.exports = router;
