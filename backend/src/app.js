const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const config = require("./config");
const { prisma } = require("./db");
const { notFound, errorHandler } = require("./middleware/errors");

const app = express();

if (config.trustProxy) app.set("trust proxy", config.trustProxy);

app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok", db: "connected" });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/me", require("./routes/me"));
app.use("/api/permissions", require("./routes/permissions"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/service-records", require("./routes/maintenance"));
app.use("/api/rollouts", require("./routes/rollouts"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/imports", require("./routes/imports"));
app.use("/api/exports", require("./routes/exports"));
app.use("/api", require("./routes/fuel"));
app.use("/api", require("./routes/reference"));

app.use("/api", notFound);

// In production the built frontend (frontend/dist) is served from the same origin as the API
const webDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist, { index: false }));
  // React Router: any non-API GET returns index.html
  app.get(/^(?!\/api(\/|$)).*/, (req, res) =>
    res.sendFile(path.join(webDist, "index.html")),
  );
}

// must stay last
app.use(errorHandler);

module.exports = app;
