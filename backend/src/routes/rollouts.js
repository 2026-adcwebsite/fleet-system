// Monthly fuel rollout: one row per vehicle per month with the litres limit.
// Weekly columns, total and remaining litres are calculated from fuel transactions.
//
//   GET    /api/rollouts?yearMonth=202609     the monthly sheet (filters, paging, totals)
//   GET    /api/rollouts/summary?yearMonth=   recap tables (department x company x supplier, supplier x fuel type)
//   POST   /api/rollouts/copy                 copy a month's rollouts into another month
//   POST   /api/rollouts
//   GET    /api/rollouts/:id                  with the month's transactions
//   PATCH  /api/rollouts/:id
//   DELETE /api/rollouts/:id
//
// Department managers only see rollouts of their own department.
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { validate } = require("../lib/validate");
const { pageQuery, skipTake, pageResult } = require("../lib/pagination");
const { departmentScope } = require("../lib/scope");
const { audit } = require("../lib/audit");
const { positiveInt, nonEmpty, dateOnly, optText } = require("../lib/schemas");
const {
  round2,
  yearMonthBody,
  yearMonthQuery,
  currentYearMonth,
  monthRange,
  EMPTY_USAGE,
  usageByVehicle,
} = require("../lib/fuel");
const { buildRecap } = require("../lib/rolloutRecap");

const router = express.Router();
router.use(requireAuth);

const idParam = z.object({ id: positiveInt });
const requiredId = z.number().int().positive();

const fields = z.object({
  vehicleId: requiredId,
  yearMonth: yearMonthBody,
  chip: optText(50),
  limitL: z.number().positive().max(99999999.99).transform(round2),
  supplierId: requiredId,
  fuelTypeId: requiredId,
  departmentId: requiredId.optional(), // defaults to the vehicle's department
  companyId: requiredId.nullish(), // defaults to the vehicle's company
});

const createSchema = fields;
const updateSchema = fields
  .omit({ vehicleId: true, yearMonth: true })
  .partial()
  .refine(nonEmpty, { message: "Nothing to update" });

const copySchema = z.object({
  fromYearMonth: yearMonthBody,
  toYearMonth: yearMonthBody,
});

const listQuery = z.object({
  ...pageQuery,
  yearMonth: yearMonthQuery.default(() => currentYearMonth()),
  search: z.string().trim().optional(),
  departmentId: positiveInt.optional(),
  companyId: positiveInt.optional(),
  supplierId: positiveInt.optional(),
  fuelTypeId: positiveInt.optional(),
  vehicleId: positiveInt.optional(),
  sort: z.enum(["department", "plate", "limitL"]).default("department"),
  order: z.enum(["asc", "desc"]).default("asc"),
});

const include = {
  vehicle: {
    select: {
      id: true,
      plate: true,
      city: { select: { name: true } },
      model: { select: { make: true, model: true } },
      driver: { select: { name: true } },
    },
  },
  supplier: true,
  fuelType: true,
  department: true,
  company: true,
};

const REFS = {
  supplierId: "supplier",
  fuelTypeId: "fuelType",
  departmentId: "department",
  companyId: "company",
};

async function missingRef(data) {
  for (const [key, model] of Object.entries(REFS)) {
    if (data[key] == null) continue;
    if (!(await prisma[model].count({ where: { id: data[key] } }))) return key;
  }
  return null;
}

const view = (r, usage = EMPTY_USAGE) => ({
  id: r.id,
  yearMonth: r.yearMonth,
  vehicle: {
    id: r.vehicle.id,
    plate: r.vehicle.plate,
    city: r.vehicle.city ? r.vehicle.city.name : null,
    model: r.vehicle.model
      ? `${r.vehicle.model.make} ${r.vehicle.model.model}`.trim()
      : null,
    driver: r.vehicle.driver ? r.vehicle.driver.name : null,
  },
  chip: r.chip,
  company: r.company,
  department: r.department,
  supplier: r.supplier,
  fuelType: r.fuelType,
  limitL: Number(r.limitL),
  weeks: usage.weeks,
  totalL: usage.totalL,
  remainingL: round2(Number(r.limitL) - usage.totalL),
  amount: usage.amount,
});

// For audit rows: the stored fields only
const stored = (r) => ({
  vehicleId: r.vehicleId,
  yearMonth: r.yearMonth,
  chip: r.chip,
  limitL: Number(r.limitL),
  supplierId: r.supplierId,
  fuelTypeId: r.fuelTypeId,
  departmentId: r.departmentId,
  companyId: r.companyId,
});

const loadRollout = (req, id) =>
  prisma.fuelRollout.findFirst({
    where: { id, ...departmentScope(req.user) },
    include,
  });

// Attach transactions that were entered before this rollout existed.
function linkTransactions(vehicleId, yearMonth, rolloutId) {
  const { start, end } = monthRange(yearMonth);
  return prisma.fuelTransaction.updateMany({
    where: { vehicleId, rolloutId: null, date: { gte: start, lte: end } },
    data: { rolloutId },
  });
}

// ───────────── the monthly sheet ─────────────

router.get(
  "/",
  requirePermission("rollout", "view"),
  validate({ query: listQuery }),
  async (req, res) => {
    const { page, pageSize, yearMonth, search, sort, order, ...filters } =
      req.valid.query;

    const where = {
      AND: [
        departmentScope(req.user),
        { yearMonth },
        filters,
        search
          ? {
              OR: [
                { chip: { contains: search, mode: "insensitive" } },
                {
                  vehicle: { plate: { contains: search, mode: "insensitive" } },
                },
                {
                  vehicle: {
                    driver: { name: { contains: search, mode: "insensitive" } },
                  },
                },
              ],
            }
          : {},
      ],
    };

    const orderBy =
      sort === "department"
        ? [{ department: { name: order } }, { vehicle: { plate: "asc" } }]
        : sort === "plate"
          ? [{ vehicle: { plate: order } }]
          : [{ limitL: order }, { vehicle: { plate: "asc" } }];

    const [rows, total, allVehicles, limitSum] = await Promise.all([
      prisma.fuelRollout.findMany({
        where,
        include,
        orderBy,
        ...skipTake({ page, pageSize }),
      }),
      prisma.fuelRollout.count({ where }),
      prisma.fuelRollout.findMany({ where, select: { vehicleId: true } }),
      prisma.fuelRollout.aggregate({ where, _sum: { limitL: true } }),
    ]);

    const pageUsage = await usageByVehicle(
      rows.map((r) => r.vehicleId),
      yearMonth,
    );

    // totals over every row of this filter, not just the current page
    const { start, end } = monthRange(yearMonth);
    const spent = await prisma.fuelTransaction.aggregate({
      where: {
        vehicleId: { in: allVehicles.map((v) => v.vehicleId) },
        date: { gte: start, lte: end },
      },
      _sum: { litres: true, amount: true },
    });
    const totalLimitL =
      limitSum._sum.limitL === null ? 0 : Number(limitSum._sum.limitL);
    const totalSpentL =
      spent._sum.litres === null ? 0 : Number(spent._sum.litres);

    res.json({
      ...pageResult(
        rows.map((r) => view(r, pageUsage.get(r.vehicleId))),
        total,
        { page, pageSize },
      ),
      yearMonth,
      summary: {
        totalLimitL: round2(totalLimitL),
        totalSpentL: round2(totalSpentL),
        remainingL: round2(totalLimitL - totalSpentL),
        totalAmount:
          spent._sum.amount === null ? 0 : round2(Number(spent._sum.amount)),
      },
    });
  },
);

// Recap tables from the sheet: "Shpenzimet Recap" and "Totali".
router.get(
  "/summary",
  requirePermission("rollout", "view"),
  validate({
    query: z.object({
      yearMonth: yearMonthQuery.default(() => currentYearMonth()),
    }),
  }),
  async (req, res) => {
    const { yearMonth } = req.valid.query;
    const rollouts = await prisma.fuelRollout.findMany({
      where: { yearMonth, ...departmentScope(req.user) },
      include: {
        department: true,
        company: true,
        supplier: true,
        fuelType: true,
      },
    });
    const usage = await usageByVehicle(
      rollouts.map((r) => r.vehicleId),
      yearMonth,
    );

    res.json({ yearMonth, ...buildRecap(rollouts, usage) });
  },
);

// Start a new month from an earlier one: copies limit, chip, supplier, fuel type, department, company.
// Vehicles that already have a rollout in the target month are skipped.
router.post(
  "/copy",
  requirePermission("rollout", "create"),
  validate({ body: copySchema }),
  async (req, res) => {
    const { fromYearMonth, toYearMonth } = req.valid.body;
    if (fromYearMonth === toYearMonth) {
      return res
        .status(400)
        .json({ error: "Source and target month must differ" });
    }

    const source = await prisma.fuelRollout.findMany({
      where: { yearMonth: fromYearMonth, ...departmentScope(req.user) },
    });
    if (source.length === 0)
      return res.status(404).json({ error: "No rollouts in the source month" });

    const existing = await prisma.fuelRollout.findMany({
      where: { yearMonth: toYearMonth },
      select: { vehicleId: true },
    });
    const have = new Set(existing.map((e) => e.vehicleId));

    const data = source
      .filter((s) => !have.has(s.vehicleId))
      .map((s) => ({
        vehicleId: s.vehicleId,
        yearMonth: toYearMonth,
        chip: s.chip,
        limitL: s.limitL,
        supplierId: s.supplierId,
        fuelTypeId: s.fuelTypeId,
        departmentId: s.departmentId,
        companyId: s.companyId,
      }));

    if (data.length > 0) {
      await prisma.fuelRollout.createMany({ data });
      const created = await prisma.fuelRollout.findMany({
        where: {
          yearMonth: toYearMonth,
          vehicleId: { in: data.map((d) => d.vehicleId) },
        },
        select: { id: true, vehicleId: true },
      });
      await Promise.all(
        created.map((c) => linkTransactions(c.vehicleId, toYearMonth, c.id)),
      );
    }

    const result = {
      fromYearMonth,
      toYearMonth,
      created: data.length,
      skipped: source.length - data.length,
    };
    await audit(req, "copy_month", "FuelRollout", null, null, result);
    res.status(201).json(result);
  },
);

// ───────────── single rollout ─────────────

router.post(
  "/",
  requirePermission("rollout", "create"),
  validate({ body: createSchema }),
  async (req, res) => {
    const body = req.valid.body;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, ...departmentScope(req.user) },
      select: { id: true, departmentId: true, companyId: true },
    });
    if (!vehicle) return res.status(400).json({ error: "Unknown vehicleId" });

    const data = {
      ...body,
      departmentId: body.departmentId ?? vehicle.departmentId,
      companyId:
        body.companyId === undefined ? vehicle.companyId : body.companyId,
    };
    const bad = await missingRef(data);
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    // unique (vehicleId, yearMonth) violations come back as 409 from the error handler
    const rollout = await prisma.fuelRollout.create({ data, include });
    await linkTransactions(rollout.vehicleId, rollout.yearMonth, rollout.id);
    const usage = (
      await usageByVehicle([rollout.vehicleId], rollout.yearMonth)
    ).get(rollout.vehicleId);

    await audit(
      req,
      "create",
      "FuelRollout",
      rollout.id,
      null,
      stored(rollout),
    );
    res.status(201).json({ rollout: view(rollout, usage) });
  },
);

router.get(
  "/:id",
  requirePermission("rollout", "view"),
  validate({ params: idParam }),
  async (req, res) => {
    const rollout = await loadRollout(req, req.valid.params.id);
    if (!rollout) return res.status(404).json({ error: "Rollout not found" });

    const { start, end } = monthRange(rollout.yearMonth);
    const transactions = await prisma.fuelTransaction.findMany({
      where: { vehicleId: rollout.vehicleId, date: { gte: start, lte: end } },
      include: { supplier: true, fuelType: true },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });
    const usage = (
      await usageByVehicle([rollout.vehicleId], rollout.yearMonth)
    ).get(rollout.vehicleId);

    res.json({
      rollout: view(rollout, usage),
      transactions: transactions.map((t) => ({
        id: t.id,
        date: dateOnly(t.date),
        litres: Number(t.litres),
        unitPrice: t.unitPrice === null ? null : Number(t.unitPrice),
        amount: t.amount === null ? null : Number(t.amount),
        priceEstimated: t.priceEstimated,
        supplier: t.supplier,
        fuelType: t.fuelType,
      })),
    });
  },
);

router.patch(
  "/:id",
  requirePermission("rollout", "edit"),
  validate({ params: idParam, body: updateSchema }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadRollout(req, id);
    if (!before) return res.status(404).json({ error: "Rollout not found" });

    const bad = await missingRef(req.valid.body);
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    const rollout = await prisma.fuelRollout.update({
      where: { id },
      data: req.valid.body,
      include,
    });
    const usage = (
      await usageByVehicle([rollout.vehicleId], rollout.yearMonth)
    ).get(rollout.vehicleId);

    await audit(
      req,
      "update",
      "FuelRollout",
      id,
      stored(before),
      stored(rollout),
    );
    res.json({ rollout: view(rollout, usage) });
  },
);

// Transactions of that month stay; they simply lose their link to this rollout.
router.delete(
  "/:id",
  requirePermission("rollout", "delete"),
  validate({ params: idParam }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadRollout(req, id);
    if (!before) return res.status(404).json({ error: "Rollout not found" });

    await prisma.fuelRollout.delete({ where: { id } });
    await audit(req, "delete", "FuelRollout", id, stored(before), null);
    res.json({ ok: true });
  },
);

module.exports = router;
