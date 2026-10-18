// Service records (maintenance history) for vehicles.
//
//   GET    /api/service-records        list: page, pageSize, search, vehicleId, dateFrom, dateTo, sort
//   POST   /api/service-records
//   GET    /api/service-records/:id
//   PATCH  /api/service-records/:id
//   DELETE /api/service-records/:id
//
// A vehicle's history is just the list filtered by ?vehicleId=.
// Department managers only see records of vehicles in their own department.
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { validate } = require("../lib/validate");
const { pageQuery, skipTake, pageResult } = require("../lib/pagination");
const { departmentScope } = require("../lib/scope");
const { audit } = require("../lib/audit");
const {
  positiveInt,
  nonEmpty,
  dateOnly,
  optText,
  dateStr,
} = require("../lib/schemas");

const router = express.Router();
router.use(requireAuth);

const idParam = z.object({ id: positiveInt });

// money: up to 10 digits before the decimal point, rounded to 2 decimals
const money = z
  .number()
  .min(0)
  .max(9999999999)
  .transform((v) => Math.round(v * 100) / 100);

const fields = z.object({
  vehicleId: z.number().int().positive(),
  service: z.string().trim().min(1).max(200),
  serviceDate: dateStr.nullish(),
  provider: optText(200),
  cost: money.nullish(),
  description: optText(2000),
});

const createSchema = fields;
const updateSchema = fields
  .partial()
  .refine(nonEmpty, { message: "Nothing to update" });

const listQuery = z.object({
  ...pageQuery,
  search: z.string().trim().optional(),
  vehicleId: positiveInt.optional(),
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
  sort: z.enum(["serviceDate", "cost", "createdAt"]).default("serviceDate"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const include = {
  vehicle: { select: { id: true, plate: true, departmentId: true } },
};

const view = (r) => ({
  id: r.id,
  vehicleId: r.vehicleId,
  vehicle: r.vehicle ? { id: r.vehicle.id, plate: r.vehicle.plate } : undefined,
  service: r.service,
  serviceDate: dateOnly(r.serviceDate),
  provider: r.provider,
  cost: r.cost === null || r.cost === undefined ? null : Number(r.cost),
  description: r.description,
  createdAt: r.createdAt,
});

// Record visible to this user? (scoped through its vehicle)
const loadRecord = (req, id) =>
  prisma.serviceRecord.findFirst({
    where: { id, vehicle: departmentScope(req.user) },
    include,
  });

// The vehicle must exist and be visible to the user.
const vehicleVisible = (req, vehicleId) =>
  prisma.vehicle.findFirst({
    where: { id: vehicleId, ...departmentScope(req.user) },
    select: { id: true },
  });

router.get(
  "/",
  requirePermission("maintenance", "view"),
  validate({ query: listQuery }),
  async (req, res) => {
    const { page, pageSize, search, vehicleId, dateFrom, dateTo, sort, order } =
      req.valid.query;

    const dateRange = {};
    if (dateFrom) dateRange.gte = dateFrom;
    if (dateTo) dateRange.lte = dateTo;

    const where = {
      AND: [
        { vehicle: departmentScope(req.user) },
        vehicleId ? { vehicleId } : {},
        dateFrom || dateTo ? { serviceDate: dateRange } : {},
        search
          ? {
              OR: [
                { service: { contains: search, mode: "insensitive" } },
                { provider: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                {
                  vehicle: { plate: { contains: search, mode: "insensitive" } },
                },
              ],
            }
          : {},
      ],
    };

    // records without a date go last, whichever direction is chosen
    const orderBy =
      sort === "createdAt"
        ? [{ createdAt: order }, { id: "asc" }]
        : [{ [sort]: { sort: order, nulls: "last" } }, { id: "asc" }];

    const [rows, total, sum] = await Promise.all([
      prisma.serviceRecord.findMany({
        where,
        include,
        orderBy,
        ...skipTake({ page, pageSize }),
      }),
      prisma.serviceRecord.count({ where }),
      prisma.serviceRecord.aggregate({ where, _sum: { cost: true } }),
    ]);

    res.json({
      ...pageResult(rows.map(view), total, { page, pageSize }),
      totalCost: sum._sum.cost === null ? 0 : Number(sum._sum.cost), // over all pages of this filter
    });
  },
);

router.get(
  "/:id",
  requirePermission("maintenance", "view"),
  validate({ params: idParam }),
  async (req, res) => {
    const record = await loadRecord(req, req.valid.params.id);
    if (!record)
      return res.status(404).json({ error: "Service record not found" });
    res.json({ record: view(record) });
  },
);

router.post(
  "/",
  requirePermission("maintenance", "create"),
  validate({ body: createSchema }),
  async (req, res) => {
    if (!(await vehicleVisible(req, req.valid.body.vehicleId))) {
      return res.status(400).json({ error: "Unknown vehicleId" });
    }

    const record = await prisma.serviceRecord.create({
      data: req.valid.body,
      include,
    });
    await audit(req, "create", "ServiceRecord", record.id, null, view(record));
    res.status(201).json({ record: view(record) });
  },
);

router.patch(
  "/:id",
  requirePermission("maintenance", "edit"),
  validate({ params: idParam, body: updateSchema }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadRecord(req, id);
    if (!before)
      return res.status(404).json({ error: "Service record not found" });

    if (
      req.valid.body.vehicleId !== undefined &&
      !(await vehicleVisible(req, req.valid.body.vehicleId))
    ) {
      return res.status(400).json({ error: "Unknown vehicleId" });
    }

    const record = await prisma.serviceRecord.update({
      where: { id },
      data: req.valid.body,
      include,
    });
    await audit(req, "update", "ServiceRecord", id, view(before), view(record));
    res.json({ record: view(record) });
  },
);

router.delete(
  "/:id",
  requirePermission("maintenance", "delete"),
  validate({ params: idParam }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadRecord(req, id);
    if (!before)
      return res.status(404).json({ error: "Service record not found" });

    await prisma.serviceRecord.delete({ where: { id } });
    await audit(req, "delete", "ServiceRecord", id, view(before), null);
    res.json({ ok: true });
  },
);

module.exports = router;
