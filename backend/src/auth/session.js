const crypto = require("crypto");
const { prisma } = require("../db");

const COOKIE = "sid";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: TTL_MS,
});

async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { id: hash(token), userId, expiresAt: new Date(Date.now() + TTL_MS) },
  });
  res.cookie(COOKIE, token, cookieOptions());
}

async function destroySession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) await prisma.session.deleteMany({ where: { id: hash(token) } });
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

// Sets req.user if the cookie holds a valid, unexpired session.
async function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "Not logged in" });

  const session = await prisma.session.findUnique({
    where: { id: hash(token) },
    include: { user: { include: { role: true } } },
  });

  if (
    !session ||
    session.expiresAt < new Date() ||
    session.user.deletedAt ||
    session.user.status !== "active"
  ) {
    return res.status(401).json({ error: "Not logged in" });
  }

  req.user = session.user;
  next();
}

module.exports = { createSession, destroySession, requireAuth, hash, COOKIE };
