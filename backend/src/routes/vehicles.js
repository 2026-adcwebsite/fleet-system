// Vehicles + their insurance and inspection periods.
//
//   GET    /api/vehicles                      list: page, pageSize, search, filters, sort
//   POST   /api/vehicles
//   GET    /api/vehicles/:id                  with full insurance + inspection history
//   PATCH  /api/vehicles/:id
//   DELETE /api/vehicles/:id                  409 if the vehicle has fuel records
//   GET|POST        /api/vehicles/:vehicleId/insurances
//   PATCH|DELETE    /api/vehicles/:vehicleId/insurances/:id
//   (same four for /inspections)
//
// Department managers only ever see vehicles of their own department.
const express = require('express');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth } = require('../auth/session');
const { requirePermission } = require('../auth/permissions');
const { validate } = require('../lib/validate');
const { pageQuery, skipTake, pageResult } = require('../lib/pagination');
const { departmentScope } = require('../lib/scope');
const { audit } = require('../lib/audit');
const { positiveInt, nonEmpty, dateOnly, optText, dateStr } = require('../lib/schemas');
const { filterFields, vehicleWhere } = require('../lib/vehicleQuery');

const router = express.Router();
router.use(requireAuth);

// ───────────── helpers ─────────────

const idParam = z.object({ id: positiveInt });

const requiredId = z.number().int().positive();
const optionalId = z.number().int().positive().nullish();
const thisYear = new Date().getFullYear();

const vehicleFields = z.object({
  plate: z.string().trim().min(1).max(20).transform((s) => s.toUpperCase()),
  chassisNo: optText(50, { upper: true }),
  year: z.number().int().min(1950).max(thisYear + 1).nullish(),
  mileageKm: z.number().int().min(0).nullish(),
  teamNo: optText(50),
  vehicleNo: optText(50),
  hasExhaust: z.boolean().optional(),
  hasGps: z.boolean().optional(),
  sensors: optText(255),
  cityId: requiredId,
  companyId: optionalId,
  departmentId: requiredId,
  modelId: requiredId,
  statusId: requiredId,
  driverId: optionalId,
});

const createSchema = vehicleFields;
const updateSchema = vehicleFields.partial().refine(nonEmpty, { message: 'Nothing to update' });

const listQuery = z.object({
  ...pageQuery,
  ...filterFields,
  sort: z.enum(['plate', 'year', 'mileageKm', 'createdAt']).default('plate'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const REFS = {
  cityId: 'city',
  companyId: 'company',
  departmentId: 'department',
  modelId: 'vehicleModel',
  statusId: 'vehicleStatus',
  driverId: 'driver',
};

// Returns the first foreign key that points at nothing, or null if all exist.
async function missingRef(data) {
  for (const [key, model] of Object.entries(REFS)) {
    if (data[key] == null) continue;
    if (!(await prisma[model].count({ where: { id: data[key] } }))) return key;
  }
  return null;
}

const latestEnd = { orderBy: { endDate: 'desc' }, take: 1, select: { endDate: true } };
const relations = { city: true, company: true, department: true, model: true, status: true, driver: true };
const listInclude = { ...relations, insurances: latestEnd, inspections: latestEnd };

const periodView = (p) => ({ id: p.id, startDate: dateOnly(p.startDate), endDate: dateOnly(p.endDate) });

const view = (v) => ({
  id: v.id,
  plate: v.plate,
  chassisNo: v.chassisNo,
  year: v.year,
  mileageKm: v.mileageKm,
  teamNo: v.teamNo,
  vehicleNo: v.vehicleNo,
  hasExhaust: v.hasExhaust,
  hasGps: v.hasGps,
  sensors: v.sensors,
  city: v.city,
  company: v.company,
  department: v.department,
  model: v.model,
  status: v.status,
  driver: v.driver,
  insuranceEnd: v.insurances ? dateOnly(v.insurances[0] && v.insurances[0].endDate) : undefined,
  inspectionEnd: v.inspections ? dateOnly(v.inspections[0] && v.inspections[0].endDate) : undefined,
});

// Finds a vehicle the current user is allowed to see (department scope applied).
const loadVehicle = (req, id, include) =>
  prisma.vehicle.findFirst({ where: { id, ...departmentScope(req.user) }, include });

const notFound = (res) => res.status(404).json({ error: 'Vehicle not found' });

// ───────────── vehicles ─────────────

router.get('/', requirePermission('fleet', 'view'), validate({ query: listQuery }), async (req, res) => {
  const { page, pageSize, sort, order, ...filters } = req.valid.query;

  const where = vehicleWhere(req.user, filters);

  const [rows, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: listInclude,
      orderBy: [{ [sort]: order }, { id: 'asc' }],
      ...skipTake({ page, pageSize }),
    }),
    prisma.vehicle.count({ where }),
  ]);

  res.json(pageResult(rows.map(view), total, { page, pageSize }));
});

router.get('/:id', requirePermission('fleet', 'view'), validate({ params: idParam }), async (req, res) => {
  const history = { orderBy: { endDate: 'desc' } };
  const vehicle = await loadVehicle(req, req.valid.params.id, {
    ...relations,
    insurances: history,
    inspections: history,
  });
  if (!vehicle) return notFound(res);

  res.json({
    vehicle: {
      ...view({ ...vehicle, insurances: undefined, inspections: undefined }),
      insurances: vehicle.insurances.map(periodView),
      inspections: vehicle.inspections.map(periodView),
    },
  });
});

router.post('/', requirePermission('fleet', 'create'), validate({ body: createSchema }), async (req, res) => {
  const bad = await missingRef(req.valid.body);
  if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

  const vehicle = await prisma.vehicle.create({ data: req.valid.body, include: relations });
  await audit(req, 'create', 'Vehicle', vehicle.id, null, view(vehicle));
  res.status(201).json({ vehicle: view(vehicle) });
});

router.patch(
  '/:id',
  requirePermission('fleet', 'edit'),
  validate({ params: idParam, body: updateSchema }),
  async (req, res) => {
    const { id } = req.valid.params;
    const before = await loadVehicle(req, id, relations);
    if (!before) return notFound(res);

    const bad = await missingRef(req.valid.body);
    if (bad) return res.status(400).json({ error: `Unknown ${bad}` });

    const vehicle = await prisma.vehicle.update({ where: { id }, data: req.valid.body, include: relations });
    await audit(req, 'update', 'Vehicle', id, view(before), view(vehicle));
    res.json({ vehicle: view(vehicle) });
  }
);

router.delete('/:id', requirePermission('fleet', 'delete'), validate({ params: idParam }), async (req, res) => {
  const { id } = req.valid.params;
  const before = await loadVehicle(req, id, relations);
  if (!before) return notFound(res);

  try {
    await prisma.vehicle.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2003') {
      return res.status(409).json({
        error: 'This vehicle has fuel records and cannot be deleted. Set its status to inactive instead.',
      });
    }
    throw err;
  }
  await audit(req, 'delete', 'Vehicle', id, view(before), null);
  res.json({ ok: true });
});

// ───────────── insurance / inspection periods ─────────────

const periodFields = z.object({ startDate: dateStr, endDate: dateStr });
const periodCreate = periodFields.refine((p) => p.endDate >= p.startDate, {
  message: 'endDate must not be before startDate',
  path: ['endDate'],
});
const periodUpdate = periodFields.partial().refine(nonEmpty, { message: 'Nothing to update' });

function periodRouter(model, entity) {
  const r = express.Router({ mergeParams: true });
  const vehicleParam = z.object({ vehicleId: positiveInt });
  const bothParams = vehicleParam.extend({ id: positiveInt });

  r.get('/', requirePermission('fleet', 'view'), validate({ params: vehicleParam }), async (req, res) => {
    const { vehicleId } = req.valid.params;
    if (!(await loadVehicle(req, vehicleId))) return notFound(res);

    const items = await prisma[model].findMany({ where: { vehicleId }, orderBy: { endDate: 'desc' } });
    res.json({ items: items.map(periodView) });
  });

  r.post(
    '/',
    requirePermission('fleet', 'create'),
    validate({ params: vehicleParam, body: periodCreate }),
    async (req, res) => {
      const { vehicleId } = req.valid.params;
      if (!(await loadVehicle(req, vehicleId))) return notFound(res);

      const item = await prisma[model].create({ data: { vehicleId, ...req.valid.body } });
      await audit(req, 'create', entity, item.id, null, { vehicleId, ...periodView(item) });
      res.status(201).json({ item: periodView(item) });
    }
  );

  r.patch(
    '/:id',
    requirePermission('fleet', 'edit'),
    validate({ params: bothParams, body: periodUpdate }),
    async (req, res) => {
      const { vehicleId, id } = req.valid.params;
      if (!(await loadVehicle(req, vehicleId))) return notFound(res);

      const before = await prisma[model].findFirst({ where: { id, vehicleId } });
      if (!before) return res.status(404).json({ error: 'Not found' });

      const start = req.valid.body.startDate || before.startDate;
      const end = req.valid.body.endDate || before.endDate;
      if (end < start) {
        return res.status(400).json({ error: 'Invalid request', details: [{ field: 'endDate', message: 'endDate must not be before startDate' }] });
      }

      const item = await prisma[model].update({ where: { id }, data: req.valid.body });
      await audit(req, 'update', entity, id, { vehicleId, ...periodView(before) }, { vehicleId, ...periodView(item) });
      res.json({ item: periodView(item) });
    }
  );

  r.delete('/:id', requirePermission('fleet', 'delete'), validate({ params: bothParams }), async (req, res) => {
    const { vehicleId, id } = req.valid.params;
    if (!(await loadVehicle(req, vehicleId))) return notFound(res);

    const before = await prisma[model].findFirst({ where: { id, vehicleId } });
    if (!before) return res.status(404).json({ error: 'Not found' });

    await prisma[model].delete({ where: { id } });
    await audit(req, 'delete', entity, id, { vehicleId, ...periodView(before) }, null);
    res.json({ ok: true });
  });

  return r;
}

router.use('/:vehicleId/insurances', periodRouter('insurance', 'Insurance'));
router.use('/:vehicleId/inspections', periodRouter('inspection', 'Inspection'));

module.exports = router;
