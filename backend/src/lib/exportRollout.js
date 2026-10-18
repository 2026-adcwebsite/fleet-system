// Monthly rollout export: sheet 1 = the month's rows with weekly usage and totals,
// sheet 2 = the two recap tables (Shpenzimet Recap, Totali).
const { prisma } = require('../db');
const { ExcelJS } = require('./excel');
const { departmentScope } = require('./scope');
const { round2, usageByVehicle, EMPTY_USAGE } = require('./fuel');
const { buildRecap } = require('./rolloutRecap');

const MAX_EXPORT_ROWS = 20000;
const NUM = '#,##0.00';

const include = {
  vehicle: {
    select: {
      plate: true,
      city: { select: { name: true } },
      model: { select: { make: true, model: true } },
      driver: { select: { name: true } },
    },
  },
  supplier: true, fuelType: true, department: true, company: true,
};

function header(ws, columns) {
  ws.columns = columns.map(([h, width]) => ({ header: h, width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// a small titled table placed at (row, col 1); returns the next free row
function table(ws, startRow, title, heads, rows) {
  ws.getCell(startRow, 1).value = title;
  ws.getCell(startRow, 1).font = { bold: true, size: 12 };
  const h = ws.getRow(startRow + 1);
  heads.forEach((t, i) => (h.getCell(i + 1).value = t));
  h.font = { bold: true };
  let r = startRow + 2;
  let litres = 0;
  let amount = 0;
  for (const row of rows) {
    const line = ws.getRow(r++);
    row.cells.forEach((v, i) => (line.getCell(i + 1).value = v));
    litres += row.litres;
    amount += row.amount;
    line.getCell(heads.length - 1).numFmt = NUM;
    line.getCell(heads.length).numFmt = NUM;
  }
  const total = ws.getRow(r++);
  total.getCell(1).value = 'Totali';
  total.getCell(heads.length - 1).value = round2(litres);
  total.getCell(heads.length).value = round2(amount);
  total.font = { bold: true };
  total.getCell(heads.length - 1).numFmt = NUM;
  total.getCell(heads.length).numFmt = NUM;
  return r + 1;
}

async function rolloutWorkbook(user, { yearMonth, search, ...filters }) {
  const where = {
    AND: [
      departmentScope(user),
      { yearMonth },
      filters,
      search
        ? {
            OR: [
              { chip: { contains: search, mode: 'insensitive' } },
              { vehicle: { plate: { contains: search, mode: 'insensitive' } } },
              { vehicle: { driver: { name: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {},
    ],
  };
  const rollouts = await prisma.fuelRollout.findMany({
    where,
    include,
    orderBy: [{ department: { name: 'asc' } }, { vehicle: { plate: 'asc' } }],
    take: MAX_EXPORT_ROWS,
  });
  const usage = await usageByVehicle(rollouts.map((r) => r.vehicleId), yearMonth);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Rollout ${yearMonth}`);
  header(ws, [
    ['Targa', 14], ['Qyteti', 16], ['Makina', 22], ['Drejtues', 20], ['Chip', 14], ['Brandim', 12],
    ['Departamenti', 16], ['Furnizuesi', 16], ['Karburanti', 12], ['Limiti (L)', 12],
    ['Java 1 (L)', 11], ['Java 2 (L)', 11], ['Java 3 (L)', 11], ['Java 4 (L)', 11],
    ['Totali (L)', 12], ['Mbetur (L)', 12], ['Shuma', 14],
  ]);

  const sum = { limit: 0, weeks: [0, 0, 0, 0], total: 0, amount: 0 };
  for (const r of rollouts) {
    const u = usage.get(r.vehicleId) || EMPTY_USAGE;
    const limit = Number(r.limitL);
    ws.addRow([
      r.vehicle.plate, r.vehicle.city ? r.vehicle.city.name : null,
      r.vehicle.model ? `${r.vehicle.model.make} ${r.vehicle.model.model}`.trim() : null,
      r.vehicle.driver ? r.vehicle.driver.name : null, r.chip, r.company ? r.company.name : null,
      r.department.name, r.supplier.name, r.fuelType.name, limit,
      ...u.weeks, u.totalL, round2(limit - u.totalL), u.amount,
    ]);
    sum.limit += limit;
    u.weeks.forEach((w, i) => (sum.weeks[i] += w));
    sum.total += u.totalL;
    sum.amount += u.amount;
  }
  const totalRow = ws.addRow([
    'Totali', null, null, null, null, null, null, null, null, round2(sum.limit),
    ...sum.weeks.map(round2), round2(sum.total), round2(sum.limit - sum.total), round2(sum.amount),
  ]);
  totalRow.font = { bold: true };
  for (let c = 10; c <= 17; c++) ws.getColumn(c).numFmt = NUM;

  // recap sheet: covers the same filtered rows
  const recap = buildRecap(rollouts, usage);
  const rs = wb.addWorksheet('Recap');
  [26, 16, 18, 14, 16].forEach((w, i) => (rs.getColumn(i + 1).width = w));
  const next = table(
    rs, 1, `Shpenzimet Recap ${yearMonth}`, ['Departamenti', 'Brandim', 'Furnizuesi', 'Litra', 'Shuma'],
    recap.byDepartment.map((x) => ({ cells: [x.department, x.company, x.supplier, x.litres, x.amount], litres: x.litres, amount: x.amount }))
  );
  table(
    rs, next, 'Totali', ['Furnizuesi', 'Karburanti', 'Litra', 'Shuma'],
    recap.bySupplierFuel.map((x) => ({ cells: [x.supplier, x.fuelType, x.litres, x.amount], litres: x.litres, amount: x.amount }))
  );

  return { wb, count: rollouts.length };
}

module.exports = { rolloutWorkbook };
