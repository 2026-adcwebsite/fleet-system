// Fuel transactions, fuel prices and the supplier reconciliation.
//
//   /api/fuel-transactions      list, create, patch, delete      (one row per fill, or per week)
//   /api/fuel-prices            list, create, patch, delete      (fallback price per litre)
//   /api/fuel-reconciliation    GET ?yearMonth=, PUT             ("Raporti Blerje/Shpenzim")
//
// Permissions use the rollout module. Department managers see only their department's
// transactions and cannot open the reconciliation (company-wide purchase figures).
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { validate } = require("../lib/validate");
const { pageQuery, skipTake, pageResult } = require("../lib/pagination");
const { departmentScope } = require("../lib/scope");
const { audit } = require("../lib/audit");
const { positiveInt, nonEmpty, dateOnly, dateStr } = require("../lib/schemas");
const {
  round2,
  round4,
  yearMonthBody,
  yearMonthQuery,
  currentYearMonth,
  toYearMonth,
  monthRange,
  buildPricing,
} = require("../lib/fuel");

const idParam = z.object({ id: positiveInt });
const requiredId = z.number().int().positive();
const num = (v) => (v === null || v === undefined ? null : Number(v));

// ═════════════════════════ transactions ═════════════════════════

const tx = express.Router();
tx.use(requireAuth);

const litres = z.number().positive().max(99999999.99).transform(round2);
const unitPrice = z.number().positive().max(999999.9999).transform(round4);

const txFields = z.object({
  vehicleId: requiredId,
  date: dateStr,
  litres,
  unitPrice: unitPrice.nullish(), // empty = use the FuelPrice fallback
  supplierId: requiredId.optional(), // default: the vehicle's rollout for that month
  fuelTypeId: requiredId.optional(),
});
const txCreate = txFields;
const txUpdate = txFields
  .omit({ vehicleId: true })
  .partial()
  .refine(nonEmpty, { message: "Nothing to update" });

const txList = z.object({
  ...pageQuery,
  vehicleId: positiveInt.optional(),
  supplierId: positiveInt.optional(),
  fuelTypeId: positiveInt.optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
  search: z.string().trim().optional(),
  sort: z.enum(["date", "litres", "amount"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const txInclude = {
  vehicle: { select: { id: true, plate: true } },
  supplier: true,
  fuelType: true,
};

const txView = (t) => ({
  id: t.id,
  vehicleId: t.vehicleId,
  vehicle: t.vehicle ? { id: t.vehicle.id, plate: t.vehicle.plate } : undefined,
  rolloutId: t.rolloutId,
  date: dateOnly(t.date),
  litres: Number(t.litres),
  unitPrice: num(t.unitPrice),
  amount: num(t.amount),
  priceEstimated: t.priceEstimated,
  supplier: t.supplier,
  fuelType: t.fuelType,
  importBatchId: t.importBatchId,
});

const txStored = (t) => ({
  vehicleId: t.vehicleId,
  rolloutId: t.rolloutId,
  date: dateOnly(t.date),
  litres: Number(t.litres),
  unitPrice: num(t.unitPrice),
  amount: num(t.amount),
  priceEstimated: t.priceEstimated,
  supplierId: t.supplierId,
  fuelTypeId: t.fuelTypeId,
});

const loadTx = (req, id) =>
  prisma.fuelTransaction.findFirst({
    where: { id, vehicle: departmentScope(req.user) },
    include: txInclude,
  });

const findRollout = (vehicleId, date) =>
  prisma.fuelRollout.findUnique({
    where: { vehicleId_yearMonth: { vehicleId, yearMonth: toYearMonth(date) } },
  });

async function missingRef(data) {
  const refs = { supplierId: "supplier", fuelTypeId: "fuelType" };
  for (const [key, model] of Object.entries(refs)) {
    if (data[key] == null) continue;
    if (!(await prisma[model].count({ where: { id: data[key] } }))) return key;
  }
  return null;
}

tx.get(
  "/",
  requirePermission("rollout", "view"),
  validate({ query: txList }),
  async (req, res) => {
    const {
      page,
      pageSize,
      search,
      sort,
      order,
      dateFrom,
      dateTo,
      ...filters
    } = req.valid.query;

    const dateRange = {};
    if (dateFrom) dateRange.gte = dateFrom;
    if (dateTo) dateRange.lte = dateTo;

    const where = {
      AND: [
        { vehicle: departmentScope(req.user) },
        filters,
        dateFrom || dateTo ? { date: dateRange } : {},
        search
          ? { vehicle: { plate: { contains: search, mode: "insensitive" } } }
          : {},
      ],
    };

    const [rows, total, sum] = await Promise.all([
      prisma.fuelTransaction.findMany({
        where,
        include: txInclude,
        orderBy: [{ [sort]: order }, { id: "desc" }],
        ...skipTake({ page, pageSize }),
      }),
      prisma.fuelTransaction.count({ where }),
      prisma.fuelTransaction.aggregate({
        where,
        _sum: { litres: true, amount: true },
      }),
    ]);

    res.json({
      ...pageResult(rows.map(txView), total, { page, pageSize }),
      totalLitres:
        sum._sum.litres === null ? 0 : round2(Number(sum._sum.litres)), // all pages of this filter
      totalAmount:
        sum._sum.amount === null ? 0 : round2(Number(sum._sum.amount)),
    });
  },
);

tx.post(
  "/",
  requirePermission("rollout", "create"),
  validate({ body: txCreate }),
  async (req, res) => {
    const body = req.valid.body;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: body.vehicleId, ...departmentScope(req.user) },
      select: { id: true },
    });
    if (!vehicle) return res.status(400).json({ error: "Unknown vehicleId" });

    const rollout = await findRollout(body.vehicleId, body.date);
    const supplierId = body.supplierId ?? (rollout && rollout.supplierId);
    const fuelTypeId = body.fuelTypeId ?? (rollout && rollout.fuelTypeId);
    if (!supplierId || !fuelTypeId) {
      return res.status(400).json({
        error:
          "supplierId and fuelTypeId are required when the vehicle has no rollout for that month",
      });
    }
    const bad = await missingRef({ supplierId, fuelTypeId });
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    const pricing = await buildPricing({
      litres: body.litres,
      unitPrice: body.unitPrice,
      supplierId,
      fuelTypeId,
      date: body.date,
    });

    const created = await prisma.fuelTransaction.create({
      data: {
        vehicleId: body.vehicleId,
        rolloutId: rollout ? rollout.id : null,
        date: body.date,
        litres: body.litres,
        supplierId,
        fuelTypeId,
        ...pricing,
      },
      include: txInclude,
    });

    await audit(
      req,
      "create",
      "FuelTransaction",
      created.id,
      null,
      txStored(created),
    );
    res
      .status(201)
      .json({ transaction: txView(created), noPrice: created.amount === null });
  },
);

tx.patch(
  "/:id",
  requirePermission("rollout", "edit"),
  validate({ params: idParam, body: txUpdate }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadTx(req, id);
    if (!before)
      return res.status(404).json({ error: "Transaction not found" });

    const body = req.valid.body;
    const next = {
      date: body.date ?? before.date,
      litres: body.litres ?? Number(before.litres),
      supplierId: body.supplierId ?? before.supplierId,
      fuelTypeId: body.fuelTypeId ?? before.fuelTypeId,
    };
    const bad = await missingRef(next);
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    // A price typed in by hand is kept. An estimated or missing price is looked up again,
    // because the date, supplier or fuel type may have changed.
    let price;
    if (body.unitPrice !== undefined) price = body.unitPrice;
    else if (before.priceEstimated || before.unitPrice === null) price = null;
    else price = Number(before.unitPrice);

    const pricing = await buildPricing({ ...next, unitPrice: price });
    const rollout = await findRollout(before.vehicleId, next.date);

    const updated = await prisma.fuelTransaction.update({
      where: { id },
      data: { ...next, rolloutId: rollout ? rollout.id : null, ...pricing },
      include: txInclude,
    });

    await audit(
      req,
      "update",
      "FuelTransaction",
      id,
      txStored(before),
      txStored(updated),
    );
    res.json({
      transaction: txView(updated),
      noPrice: updated.amount === null,
    });
  },
);

tx.delete(
  "/:id",
  requirePermission("rollout", "delete"),
  validate({ params: idParam }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadTx(req, id);
    if (!before)
      return res.status(404).json({ error: "Transaction not found" });

    await prisma.fuelTransaction.delete({ where: { id } });
    await audit(req, "delete", "FuelTransaction", id, txStored(before), null);
    res.json({ ok: true });
  },
);

// ═════════════════════════ prices ═════════════════════════

const prices = express.Router();
prices.use(requireAuth);

const priceFields = z.object({
  supplierId: requiredId,
  fuelTypeId: requiredId,
  effectiveDate: dateStr,
  pricePerL: unitPrice,
});
const priceUpdate = priceFields
  .pick({ effectiveDate: true, pricePerL: true })
  .partial()
  .refine(nonEmpty, { message: "Nothing to update" });

const priceView = (p) => ({
  id: p.id,
  supplier: p.supplier,
  fuelType: p.fuelType,
  effectiveDate: dateOnly(p.effectiveDate),
  pricePerL: Number(p.pricePerL),
});
const priceStored = (p) => ({
  supplierId: p.supplierId,
  fuelTypeId: p.fuelTypeId,
  effectiveDate: dateOnly(p.effectiveDate),
  pricePerL: Number(p.pricePerL),
});

prices.get(
  "/",
  requirePermission("rollout", "view"),
  validate({
    query: z.object({
      supplierId: positiveInt.optional(),
      fuelTypeId: positiveInt.optional(),
    }),
  }),
  async (req, res) => {
    const items = await prisma.fuelPrice.findMany({
      where: req.valid.query,
      include: { supplier: true, fuelType: true },
      orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
    });
    res.json({ items: items.map(priceView) });
  },
);

prices.post(
  "/",
  requirePermission("rollout", "create"),
  validate({ body: priceFields }),
  async (req, res) => {
    const body = req.valid.body;
    const bad = await missingRef(body);
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    // unique (supplier, fuel type, date) violations come back as 409
    const price = await prisma.fuelPrice.create({
      data: body,
      include: { supplier: true, fuelType: true },
    });
    await audit(req, "create", "FuelPrice", price.id, null, priceStored(price));
    res.status(201).json({ item: priceView(price) });
  },
);

prices.patch(
  "/:id",
  requirePermission("rollout", "edit"),
  validate({ params: idParam, body: priceUpdate }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await prisma.fuelPrice.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: "Price not found" });

    const price = await prisma.fuelPrice.update({
      where: { id },
      data: req.valid.body,
      include: { supplier: true, fuelType: true },
    });
    await audit(
      req,
      "update",
      "FuelPrice",
      id,
      priceStored(before),
      priceStored(price),
    );
    res.json({ item: priceView(price) });
  },
);

prices.delete(
  "/:id",
  requirePermission("rollout", "delete"),
  validate({ params: idParam }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await prisma.fuelPrice.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: "Price not found" });

    await prisma.fuelPrice.delete({ where: { id } });
    await audit(req, "delete", "FuelPrice", id, priceStored(before), null);
    res.json({ ok: true });
  },
);

// ═════════════════════════ reconciliation ═════════════════════════

const recon = express.Router();
recon.use(requireAuth);
recon.use((req, res, next) => {
  if (req.user.role.name === "dept_manager")
    return res.status(403).json({ error: "Not allowed" });
  next();
});

const money = z.number().min(0).max(9999999999).transform(round2);
const reconBody = z.object({
  yearMonth: yearMonthBody,
  supplierId: requiredId,
  fuelTypeId: requiredId,
  purchased: money,
  platformAmount: money,
});

// Per supplier and fuel type: what was bought, what the transactions add up to,
// the difference, and the error margin against the supplier platform's figure.
recon.get(
  "/",
  requirePermission("rollout", "view"),
  validate({
    query: z.object({
      yearMonth: yearMonthQuery.default(() => currentYearMonth()),
    }),
  }),
  async (req, res) => {
    const { yearMonth } = req.valid.query;
    const { start, end } = monthRange(yearMonth);

    const [stored, spentGroups, suppliers, fuelTypes] = await Promise.all([
      prisma.fuelReconciliation.findMany({ where: { yearMonth } }),
      prisma.fuelTransaction.groupBy({
        by: ["supplierId", "fuelTypeId"],
        where: { date: { gte: start, lte: end } },
        _sum: { amount: true, litres: true },
      }),
      prisma.supplier.findMany(),
      prisma.fuelType.findMany(),
    ]);

    const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
    const fuelName = new Map(fuelTypes.map((f) => [f.id, f.name]));
    const key = (s, f) => `${s}|${f}`;
    const rows = new Map();

    for (const r of stored) {
      rows.set(key(r.supplierId, r.fuelTypeId), {
        supplierId: r.supplierId,
        fuelTypeId: r.fuelTypeId,
        recorded: true,
        purchased: Number(r.purchased),
        platformAmount: Number(r.platformAmount),
        spentAmount: 0,
        spentLitres: 0,
      });
    }
    for (const g of spentGroups) {
      const k = key(g.supplierId, g.fuelTypeId);
      if (!rows.has(k)) {
        rows.set(k, {
          supplierId: g.supplierId,
          fuelTypeId: g.fuelTypeId,
          recorded: false,
          purchased: 0,
          platformAmount: 0,
          spentAmount: 0,
          spentLitres: 0,
        });
      }
      rows.get(k).spentAmount = round2(Number(g._sum.amount || 0));
      rows.get(k).spentLitres = round2(Number(g._sum.litres || 0));
    }

    const items = [...rows.values()]
      .map((r) => {
        const difference = round2(r.purchased - r.spentAmount);
        return {
          ...r,
          supplier: supplierName.get(r.supplierId),
          fuelType: fuelName.get(r.fuelTypeId),
          difference,
          errorMargin: round2(difference - r.platformAmount),
        };
      })
      .sort((a, b) =>
        `${a.supplier}${a.fuelType}`.localeCompare(
          `${b.supplier}${b.fuelType}`,
        ),
      );

    res.json({ yearMonth, items });
  },
);

// Enter or correct the purchased and platform figures for one supplier, fuel type and month.
recon.put(
  "/",
  requirePermission("rollout", "edit"),
  validate({ body: reconBody }),
  async (req, res) => {
    const { yearMonth, supplierId, fuelTypeId, purchased, platformAmount } =
      req.valid.body;
    const bad = await missingRef({ supplierId, fuelTypeId });
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    const where = {
      supplierId_fuelTypeId_yearMonth: { supplierId, fuelTypeId, yearMonth },
    };
    const before = await prisma.fuelReconciliation.findUnique({ where });

    const row = await prisma.fuelReconciliation.upsert({
      where,
      update: { purchased, platformAmount },
      create: { supplierId, fuelTypeId, yearMonth, purchased, platformAmount },
    });

    const shape = (r) => ({
      yearMonth: r.yearMonth,
      supplierId: r.supplierId,
      fuelTypeId: r.fuelTypeId,
      purchased: Number(r.purchased),
      platformAmount: Number(r.platformAmount),
    });
    await audit(
      req,
      before ? "update" : "create",
      "FuelReconciliation",
      row.id,
      before && shape(before),
      shape(row),
    );
    res.json({ item: shape(row) });
  },
);

// ═════════════════════════ mount ═════════════════════════

const router = express.Router();
router.use("/fuel-transactions", tx);
router.use("/fuel-prices", prices);
router.use("/fuel-reconciliation", recon);

module.exports = router;
