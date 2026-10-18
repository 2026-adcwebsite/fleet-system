// Central settings read from environment variables (.env). Fails fast at startup when something is wrong.
try {
  require("dotenv").config();
} catch (e) {
  // dotenv is optional here: the variables may come from the real environment (Docker, hosting)
}

const env = process.env;
const isProd = env.NODE_ENV === "production";
const problems = [];

if (!env.DATABASE_URL) problems.push("DATABASE_URL is not set");

// comma-separated list of browser origins allowed to call the API (with cookies)
const corsOrigins = (env.CORS_ORIGIN || (isProd ? "" : "http://localhost:5173"))
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
if (isProd && corsOrigins.length === 0)
  problems.push(
    "CORS_ORIGIN must be set in production (e.g. https://fleet.example.com)",
  );
if (corsOrigins.includes("*"))
  problems.push("CORS_ORIGIN cannot be '*' because the API uses cookies");

const port = Number(env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  problems.push("PORT must be a number between 1 and 65535");

// number of reverse proxies in front of the app (0 = none); needed for correct client IPs and secure cookies
const trustProxy = Number(env.TRUST_PROXY || 0);
if (!Number.isInteger(trustProxy) || trustProxy < 0)
  problems.push("TRUST_PROXY must be 0 or a positive number");

// cookies are HTTPS-only in production unless explicitly switched off (e.g. testing the Docker build over http)
const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : isProd;
const cookieSameSite = env.COOKIE_SAMESITE || "lax";
if (!["lax", "strict", "none"].includes(cookieSameSite))
  problems.push("COOKIE_SAMESITE must be lax, strict or none");
if (cookieSameSite === "none" && !cookieSecure)
  problems.push("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");

if (problems.length) {
  console.error("Configuration problems:\n - " + problems.join("\n - "));
  process.exit(1);
}

module.exports = {
  isProd,
  port,
  corsOrigins,
  trustProxy,
  cookie: { secure: cookieSecure, sameSite: cookieSameSite },
};
