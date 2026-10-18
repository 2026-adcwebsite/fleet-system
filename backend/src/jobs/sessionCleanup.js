// Deletes expired sessions. Runs once at startup and then every hour.
const { prisma } = require("../db");

const EVERY_MS = 60 * 60 * 1000;

async function cleanExpiredSessions() {
  try {
    const { count } = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count)
      console.log(`Session cleanup: removed ${count} expired session(s)`);
  } catch (e) {
    console.error("Session cleanup failed:", e.message);
  }
}

// returns a function that stops the timer
function startSessionCleanup() {
  cleanExpiredSessions();
  const timer = setInterval(cleanExpiredSessions, EVERY_MS);
  timer.unref(); // never keeps the process alive on its own
  return () => clearInterval(timer);
}

module.exports = { startSessionCleanup, cleanExpiredSessions };
