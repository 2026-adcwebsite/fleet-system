// Builds the fleet and maintenance .xlsx exports.
// The fleet export uses exactly the import template's columns, so a file can be exported, edited and re-imported.
const { prisma } = require('../db');
const { ExcelJS } = require('./excel');
const { vehicleWhere } = require('./vehicleQuery');

const MAX_EXPORT_ROWS = 20000;
const DATE_FMT = 'dd/mm/yyyy';

const FLEET_COLUMNS = [
  ['Qyteti', 16], ['Targa', 14], ['Makina (modeli/marka)', 24], ['Drejtues', 20], ['Kilometrazh', 14],
  ['Nr.ekip', 10], ['Nr.makine', 12], ['Vit prodhimi', 13], ['Zgare', 9], ['GPS', 9], ['Sensore', 16],
  ['Brandim', 12], ['Siguracione Aktivizimi', 22], ['Siguracione Mbarimi', 20], ['Kolaudim Aktivizimi', 20],
  ['Kolaudim Mbarimi', 18], ['Nr.Shasie', 20], ['Servis', 22], ['Dt. Sherbimi', 14], ['Status', 12], ['Departamenti', 16],
];

const MAINTENANCE_COLUMNS = [
  ['Qyteti', 16], ['Targa', 14], ['Marka', 14], ['Modeli', 18], ['Drejtues', 20], ['Siguracione', 14],
  ['Kolaudim', 14], ['Servis', 26], ['Dt. Sherbimi', 14], ['Pershkrim', 40],
];

const latestPeriod = { orderBy: { endDate: 'desc' }, take: 1, select: { startDate: true, endDate: true } };
const include = {
  city: true, company: true, department: true, model: true, status: true, driver: true,
  insurances: latestPeriod, inspections: latestPeriod,
};

// latest service record per vehicle (dated ones first)
async function latestServices(vehicleIds) {
  const rows = await prisma.serviceRecord.findMany({
    where: { vehicleId: { in: vehicleIds } },
    orderBy: [{ serviceDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    select: { vehicleId: true, service: true, serviceDate: true, description: true },
  });
  const map = new Map();
  for (const r of rows) if (!map.has(r.vehicleId)) map.set(r.vehicleId, r);
  return map;
}

async function loadVehicles(user, filters) {
  const vehicles = await prisma.vehicle.findMany({
    where: vehicleWhere(user, filters),
    include,
    orderBy: [{ city: { name: 'asc' } }, { plate: 'asc' }],
    take: MAX_EXPORT_ROWS,
  });
  const services = await latestServices(vehicles.map((v) => v.id));
  return { vehicles, services };
}

function sheet(name, columns, dateColumns) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const c of dateColumns) ws.getColumn(columns.findIndex(([h]) => h === c) + 1).numFmt = DATE_FMT;
  return { wb, ws };
}

const yesNo = (b) => (b ? 'Po' : 'Jo');
const name = (x) => (x ? x.name : null);

async function fleetWorkbook(user, filters) {
  const { vehicles, services } = await loadVehicles(user, filters);
  const { wb, ws } = sheet('Flota', FLEET_COLUMNS, [
    'Siguracione Aktivizimi', 'Siguracione Mbarimi', 'Kolaudim Aktivizimi', 'Kolaudim Mbarimi', 'Dt. Sherbimi',
  ]);
  for (const v of vehicles) {
    const ins = v.insurances[0];
    const insp = v.inspections[0];
    const svc = services.get(v.id);
    ws.addRow([
      v.city.name, v.plate, `${v.model.make} ${v.model.model}`.trim(), name(v.driver), v.mileageKm,
      v.teamNo, v.vehicleNo, v.year, yesNo(v.hasExhaust), yesNo(v.hasGps), v.sensors, name(v.company),
      ins ? ins.startDate : null, ins ? ins.endDate : null, insp ? insp.startDate : null, insp ? insp.endDate : null,
      v.chassisNo, svc ? svc.service : null, svc ? svc.serviceDate : null, v.status.name, v.department.name,
    ]);
  }
  return { wb, count: vehicles.length };
}

async function maintenanceWorkbook(user, filters) {
  const { vehicles, services } = await loadVehicles(user, filters);
  const { wb, ws } = sheet('Mirembajtje', MAINTENANCE_COLUMNS, ['Siguracione', 'Kolaudim', 'Dt. Sherbimi']);
  for (const v of vehicles) {
    const ins = v.insurances[0];
    const insp = v.inspections[0];
    const svc = services.get(v.id);
    ws.addRow([
      v.city.name, v.plate, v.model.make, v.model.model, name(v.driver),
      ins ? ins.endDate : null, insp ? insp.endDate : null,
      svc ? svc.service : null, svc ? svc.serviceDate : null, svc ? svc.description : null,
    ]);
  }
  return { wb, count: vehicles.length };
}

module.exports = { fleetWorkbook, maintenanceWorkbook, FLEET_COLUMNS, MAINTENANCE_COLUMNS };
