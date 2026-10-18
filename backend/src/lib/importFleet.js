// Fleet import from the "Flota" Excel template.
//
// Each row is saved in its own transaction, so one bad row never blocks the others.
// A plate that already exists is updated (only the cells that are filled in);
// insurance / inspection periods and service records are added unless identical ones exist.
// Cities, vehicle models and drivers are created when they are new. Departments, companies
// and statuses are fixed lists and must already exist.
const { prisma } = require('../db');
const { audit } = require('./audit');
const { nameKey, RowError, text, parseBool, parseDate, parseInteger, readSheet } = require('./excel');

const ALIASES = {
  city: ['Qyteti', 'City'],
  plate: ['Targa', 'Plate'],
  model: ['Makina (modeli/marka)', 'Makina', 'Modeli/Marka', 'Model'],
  driver: ['Drejtues', 'Driver'],
  mileageKm: ['Kilometrazh', 'Mileage'],
  teamNo: ['Nr.ekip', 'Nr ekip'],
  vehicleNo: ['Nr.makine', 'Nr makine'],
  year: ['Vit prodhimi', 'Year'],
  hasExhaust: ['Zgare', 'Exhaust'],
  hasGps: ['GPS'],
  sensors: ['Sensore', 'Sensors'],
  company: ['Brandim', 'Company'],
  insStart: ['Siguracione Aktivizimi'],
  insEnd: ['Siguracione Mbarimi'],
  inspStart: ['Kolaudim Aktivizimi'],
  inspEnd: ['Kolaudim Mbarimi'],
  chassisNo: ['Nr.Shasie', 'Nr Shasie', 'Chassis'],
  service: ['Servis', 'Service'],
  serviceDate: ['Dt. Sherbimi', 'Dt Sherbimi', 'Service date'],
  status: ['Status'],
  department: ['Departamenti', 'Department'],
};

const MAX_REPORTED = 500;
const thisYear = new Date().getFullYear();

class DryRunRollback extends Error {}

// "Fiat 500" -> { make: 'Fiat', model: '500' };  "Skoda" -> { make: 'Skoda', model: '' }
function splitModel(value) {
  const t = text(value);
  const i = t.indexOf(' ');
  return i < 0 ? { make: t, model: '' } : { make: t.slice(0, i), model: t.slice(i + 1) };
}

// Pure checks on one row. Returns { data, errors, warnings }.
function parseRow(values) {
  const errors = [];
  const warnings = [];
  const d = {};

  const field = (label, fn) => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof RowError) {
        errors.push(`${label}: ${e.message}`);
        return undefined;
      }
      throw e;
    }
  };

  d.plate = text(values.plate).toUpperCase();
  if (!d.plate) errors.push('Targa: missing');
  else if (d.plate.length > 20) errors.push('Targa: too long');

  d.city = text(values.city);
  if (!d.city) errors.push('Qyteti: missing');

  const model = splitModel(values.model);
  if (!model.make) errors.push('Makina (modeli/marka): missing');
  d.make = model.make;
  d.model = model.model;

  d.driver = text(values.driver);
  d.teamNo = text(values.teamNo);
  d.vehicleNo = text(values.vehicleNo);
  d.sensors = text(values.sensors);
  d.chassisNo = text(values.chassisNo).toUpperCase();
  d.company = text(values.company);
  d.status = text(values.status);
  d.department = text(values.department);
  d.service = text(values.service);

  d.mileageKm = field('Kilometrazh', () => parseInteger(values.mileageKm));
  d.year = field('Vit prodhimi', () => {
    const y = parseInteger(values.year);
    if (y !== undefined && (y < 1950 || y > thisYear + 1)) throw new RowError(`must be between 1950 and ${thisYear + 1}`);
    return y;
  });
  d.hasExhaust = field('Zgare', () => parseBool(values.hasExhaust));
  d.hasGps = field('GPS', () => parseBool(values.hasGps));
  d.insStart = field('Siguracione Aktivizimi', () => parseDate(values.insStart));
  d.insEnd = field('Siguracione Mbarimi', () => parseDate(values.insEnd));
  d.inspStart = field('Kolaudim Aktivizimi', () => parseDate(values.inspStart));
  d.inspEnd = field('Kolaudim Mbarimi', () => parseDate(values.inspEnd));
  d.serviceDate = field('Dt. Sherbimi', () => parseDate(values.serviceDate));

  // insurance / inspection need both dates; one alone is skipped with a warning
  for (const [label, s, e] of [
    ['Siguracione', 'insStart', 'insEnd'],
    ['Kolaudim', 'inspStart', 'inspEnd'],
  ]) {
    if (d[s] && d[e] && d[e] < d[s]) errors.push(`${label}: end date is before the start date`);
    else if ((d[s] && !d[e]) || (!d[s] && d[e])) {
      warnings.push(`${label}: only one of the two dates is filled in, the period was skipped`);
      d[s] = undefined;
      d[e] = undefined;
    }
  }
  if (d.serviceDate && !d.service) {
    warnings.push('Dt. Sherbimi: date without a Servis, ignored');
    d.serviceDate = undefined;
  }

  return { data: d, errors, warnings };
}

// Lookup tables, loaded once per upload.
async function loadLookups() {
  const byName = (rows) => new Map(rows.map((r) => [nameKey(r.name), r.id]));
  const [departments, companies, statuses, cities, drivers, models] = await Promise.all([
    prisma.department.findMany(),
    prisma.company.findMany(),
    prisma.vehicleStatus.findMany(),
    prisma.city.findMany(),
    prisma.driver.findMany(),
    prisma.vehicleModel.findMany(),
  ]);
  return {
    department: byName(departments),
    company: byName(companies),
    status: byName(statuses),
    city: byName(cities),
    driver: byName(drivers),
    model: new Map(models.map((m) => [`${nameKey(m.make)}|${nameKey(m.model)}`, m.id])),
  };
}

// Find an id in a lookup table or create the row. Newly created ids go into `fresh`
// and only reach the shared cache once the row's transaction has committed.
async function findOrCreate(tx, kind, cache, fresh, key, create) {
  if (cache[kind].has(key)) return cache[kind].get(key);
  if (fresh[kind].has(key)) return fresh[kind].get(key);
  const row = await create();
  fresh[kind].set(key, row.id);
  return row.id;
}

// Save one parsed row inside `tx`. Returns 'created' or 'updated'; throws RowError for unknown lists.
async function saveRow(tx, d, ctx, fresh) {
  const { cache } = ctx;

  // a department cell wins; the upload's default only applies to vehicles that are new
  let departmentId;
  if (d.department) {
    departmentId = cache.department.get(nameKey(d.department));
    if (!departmentId) throw new RowError(`Departamenti: unknown department "${d.department}"`);
  }
  let companyId;
  if (d.company) {
    companyId = cache.company.get(nameKey(d.company));
    if (!companyId) throw new RowError(`Brandim: unknown company "${d.company}"`);
  }
  let statusId;
  if (d.status) {
    statusId = cache.status.get(nameKey(d.status));
    if (!statusId) throw new RowError(`Status: unknown status "${d.status}"`);
  }

  const cityId = await findOrCreate(tx, 'city', cache, fresh, nameKey(d.city), () => tx.city.create({ data: { name: d.city } }));
  const modelId = await findOrCreate(tx, 'model', cache, fresh, `${nameKey(d.make)}|${nameKey(d.model)}`, () =>
    tx.vehicleModel.create({ data: { make: d.make, model: d.model } })
  );
  let driverId;
  if (d.driver) {
    driverId = await findOrCreate(tx, 'driver', cache, fresh, nameKey(d.driver), () => tx.driver.create({ data: { name: d.driver } }));
  }

  // only cells that are filled in are written
  const fields = {
    cityId,
    modelId,
    departmentId,
    companyId,
    statusId,
    driverId,
    year: d.year,
    mileageKm: d.mileageKm,
    hasExhaust: d.hasExhaust,
    hasGps: d.hasGps,
    teamNo: d.teamNo || undefined,
    vehicleNo: d.vehicleNo || undefined,
    sensors: d.sensors || undefined,
    chassisNo: d.chassisNo || undefined,
  };

  let vehicle = await tx.vehicle.findUnique({ where: { plate: d.plate } });
  let outcome;
  if (vehicle) {
    vehicle = await tx.vehicle.update({ where: { id: vehicle.id }, data: fields });
    outcome = 'updated';
  } else {
    // a new vehicle needs a status; the template's first one is Aktiv
    const status = statusId ?? cache.status.get('aktiv');
    if (!status) throw new RowError('Status: missing, and there is no "Aktiv" status to default to');
    const department = departmentId ?? ctx.defaultDepartmentId;
    if (!department) throw new RowError('Departamenti: missing (add the column or pick a default department)');
    vehicle = await tx.vehicle.create({ data: { ...fields, departmentId: department, statusId: status, plate: d.plate } });
    outcome = 'created';
  }

  for (const [model, start, end] of [
    ['insurance', d.insStart, d.insEnd],
    ['inspection', d.inspStart, d.inspEnd],
  ]) {
    if (!start || !end) continue;
    const same = await tx[model].findFirst({ where: { vehicleId: vehicle.id, startDate: start, endDate: end } });
    if (!same) await tx[model].create({ data: { vehicleId: vehicle.id, startDate: start, endDate: end } });
  }

  if (d.service) {
    const same = await tx.serviceRecord.findFirst({
      where: { vehicleId: vehicle.id, service: d.service, serviceDate: d.serviceDate ?? null },
    });
    if (!same) {
      await tx.serviceRecord.create({ data: { vehicleId: vehicle.id, service: d.service, serviceDate: d.serviceDate ?? null } });
    }
  }

  ctx.vehicleId = vehicle.id;
  return outcome;
}

// Main entry. dryRun=true checks everything and saves nothing.
async function importFleet({ req, buffer, fileName, dryRun = false, defaultDepartmentId }) {
  const sheet = await readSheet(buffer, ALIASES);
  if (sheet.rows.length === 0) throw Object.assign(new Error('The file has no data rows'), { status: 400 });

  if (defaultDepartmentId) {
    const dept = await prisma.department.findUnique({ where: { id: defaultDepartmentId } });
    if (!dept) throw Object.assign(new Error('Unknown defaultDepartmentId'), { status: 400 });
  }

  const cache = await loadLookups();
  const errors = [];
  const warnings = [];
  const seenPlates = new Set();
  const seenChassis = new Map(); // chassis number -> { plate, row } of rows saved earlier in this file
  let created = 0;
  let updated = 0;
  let skippedBlank = 0;

  const batch = dryRun
    ? null
    : await prisma.importBatch.create({ data: { uploadedBy: req.user.id, module: 'fleet', fileName } });

  for (const { rowNumber, values } of sheet.rows) {
    const { data, errors: rowErrors, warnings: rowWarnings } = parseRow(values);

    // rows with no plate, city or model are template hints or leftovers, not data
    if (!data.plate && !data.city && !data.make) {
      skippedBlank++;
      continue;
    }
    if (rowErrors.length) {
      errors.push({ row: rowNumber, plate: data.plate || null, message: rowErrors.join('; ') });
      continue;
    }

    // a chassis number can belong to one vehicle only; catch repeats inside the file
    const owner = data.chassisNo ? seenChassis.get(data.chassisNo) : null;
    if (owner && owner.plate !== data.plate) {
      errors.push({ row: rowNumber, plate: data.plate, message: `Nr.Shasie: "${data.chassisNo}" is already used by ${owner.plate} (row ${owner.row})` });
      continue;
    }

    const fresh = { city: new Map(), driver: new Map(), model: new Map() };
    const ctx = { cache, defaultDepartmentId, vehicleId: null };
    const repeated = seenPlates.has(data.plate);

    try {
      const outcome = await prisma.$transaction(
        async (tx) => {
          const result = await saveRow(tx, data, ctx, fresh);
          if (!dryRun) {
            await audit(req, result === 'created' ? 'import_create' : 'import_update', 'Vehicle', ctx.vehicleId, null,
              { plate: data.plate, batchId: batch.id }, tx);
          }
          if (dryRun) throw new DryRunRollback(result);
          return result;
        },
        { timeout: 20000 }
      );
      // committed: remember the rows this one created
      for (const kind of ['city', 'driver', 'model']) for (const [k, id] of fresh[kind]) cache[kind].set(k, id);
      if (outcome === 'created') created++;
      else updated++;
    } catch (e) {
      if (e instanceof DryRunRollback) {
        // in a dry run the same plate twice in one file counts as an update, like a real run would
        if (e.message === 'created' && !repeated) created++;
        else updated++;
      } else if (e instanceof RowError) {
        errors.push({ row: rowNumber, plate: data.plate, message: e.message });
        continue;
      } else if (e.code === 'P2002') {
        errors.push({ row: rowNumber, plate: data.plate, message: 'Duplicate value: the plate or chassis number already belongs to another vehicle' });
        continue;
      } else {
        throw e;
      }
    }

    seenPlates.add(data.plate);
    if (data.chassisNo) seenChassis.set(data.chassisNo, { plate: data.plate, row: rowNumber });
    for (const w of rowWarnings) warnings.push({ row: rowNumber, plate: data.plate, message: w });
  }

  const rowsChecked = sheet.rows.length - skippedBlank;
  const result = {
    dryRun,
    batchId: batch ? batch.id : null,
    rows: rowsChecked,
    created,
    updated,
    failed: errors.length,
    warningCount: warnings.length,
    errors: errors.slice(0, MAX_REPORTED),
    warnings: warnings.slice(0, MAX_REPORTED),
  };

  if (batch) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        rowsOk: created + updated,
        rowsFailed: errors.length,
        errors: { created, updated, errors: result.errors, warnings: result.warnings },
      },
    });
    await audit(req, 'import', 'ImportBatch', batch.id, null, { module: 'fleet', fileName, created, updated, failed: errors.length });
  }
  return result;
}

module.exports = { importFleet, parseRow, splitModel, ALIASES };
