const config = require("./config"); // loads .env and stops here if the settings are wrong
const app = require("./app");
const { prisma } = require("./db");
const { startSessionCleanup } = require("./jobs/sessionCleanup");

const server = app.listen(config.port, () => {
  console.log(
    `API listening on port ${config.port} (${config.isProd ? "production" : "development"})`,
  );
});

const stopCleanup = startSessionCleanup();

// finish running requests, close the database connection, then exit
let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal} received, shutting down`);
  stopCleanup();
  const force = setTimeout(() => process.exit(1), 10000); // give up after 10 s
  force.unref();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
