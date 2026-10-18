// Excel exports (the same filters as the vehicle list; department managers only get their own department).
//
//   GET /api/exports/fleet         ?search&cityId&departmentId&companyId&statusId&modelId&driverId
//   GET /api/exports/maintenance   same filters; one row per vehicle with its latest service
//   GET /api/exports/dashboard     ?days=30&departmentId&make&modelId (summary + expired/expiring lists)
//   GET /api/exports/rollout       ?yearMonth=202610&search&departmentId&companyId&supplierId&fuelTypeId (sheet + recap)
const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { validate } = require("../lib/validate");
const { audit } = require("../lib/audit");
const { filterFields } = require("../lib/vehicleQuery");
const { fleetWorkbook, maintenanceWorkbook } = require("../lib/exportFleet");
const { rolloutWorkbook } = require("../lib/exportRollout");
const { dashboardWorkbook } = require("../lib/exportDashboard");
const { positiveInt } = require("../lib/schemas");
const { yearMonthQuery, currentYearMonth } = require("../lib/fuel");

const router = express.Router();
router.use(requireAuth);

const query = z.object({ ...filterFields });

async function send(req, res, { module, entity, build, file }) {
  const { wb, count } = await build(req.user, req.valid.query);
  await audit(req, "export", entity, null, null, {
    rows: count,
    filters: req.valid.query,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${file}-${stamp}.xlsx"`,
  );
  await wb.xlsx.write(res);
  res.end();
}

router.get(
  "/fleet",
  requirePermission("fleet", "export"),
  validate({ query }),
  (req, res) =>
    send(req, res, { entity: "Vehicle", build: fleetWorkbook, file: "fleet" }),
);

router.get(
  "/maintenance",
  requirePermission("maintenance", "export"),
  validate({ query }),
  (req, res) =>
    send(req, res, {
      entity: "ServiceRecord",
      build: maintenanceWorkbook,
      file: "maintenance",
    }),
);

const rolloutQuery = z.object({
  yearMonth: yearMonthQuery.default(() => currentYearMonth()),
  search: z.string().trim().optional(),
  departmentId: positiveInt.optional(),
  companyId: positiveInt.optional(),
  supplierId: positiveInt.optional(),
  fuelTypeId: positiveInt.optional(),
});

router.get(
  "/rollout",
  requirePermission("rollout", "export"),
  validate({ query: rolloutQuery }),
  (req, res) =>
    send(req, res, {
      entity: "FuelRollout",
      build: rolloutWorkbook,
      file: `rollout-${req.valid.query.yearMonth}`,
    }),
);

const dashboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  departmentId: positiveInt.optional(),
  make: z.string().trim().min(1).optional(),
  modelId: positiveInt.optional(),
});

router.get(
  "/dashboard",
  requirePermission("dashboard", "export"),
  validate({ query: dashboardQuery }),
  (req, res) =>
    send(req, res, {
      entity: "Dashboard",
      build: dashboardWorkbook,
      file: "dashboard",
    }),
);

module.exports = router;
