const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { prisma } = require("./db");
const { requireAuth } = require("./auth/session");
const { requirePermission } = require("./auth/permissions");

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", db: "connected" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/permissions", require("./routes/permissions"));

// TEMPORARY: remove after testing permissions
app.get(
  "/api/_test/fleet",
  requireAuth,
  requirePermission("fleet", "view"),
  (req, res) => {
    res.json({ ok: true });
  },
);

module.exports = app;
