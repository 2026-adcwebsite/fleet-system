// Dashboard export: sheet "Permbledhje" (fleet by status, model x status) and one sheet each for
// insurance and inspection with the vehicles that are expired or expiring soon.
const { ExcelJS } = require('./excel');
const { buildDashboard } = require('./dashboard');

const DATE_FMT = 'dd/mm/yyyy';
const toDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00Z`) : null);

function expirySheet(wb, name, data, days) {
  const ws = wb.addWorksheet(name);
  const cols = [['Gjendja', 12], ['Targa', 14], ['Qyteti', 16], ['Makina', 24], ['Departamenti', 18], ['Status', 12], ['Mbarimi', 14], ['Ditë të mbetura', 16]];
  ws.columns = cols.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.getColumn(7).numFmt = DATE_FMT;
  const add = (label, list) => {
    for (const x of list) {
      ws.addRow([label, x.plate, x.city, x.model, x.department.name, x.status, toDate(x.endDate), x.daysLeft]);
    }
  };
  add('Skaduar', data.expired);
  add(`Skadon brenda ${days} ditëve`, data.expiring);
  return ws;
}

async function dashboardWorkbook(user, filters) {
  const d = await buildDashboard(user, filters);
  const wb = new ExcelJS.Workbook();

  const ws = wb.addWorksheet('Permbledhje');
  ws.getColumn(1).width = 28;
  ws.getCell(1, 1).value = `Gjendja më ${d.asOf}`;
  ws.getCell(1, 1).font = { bold: true, size: 12 };

  ws.getCell(3, 1).value = 'Flota sipas statusit';
  ws.getCell(3, 1).font = { bold: true };
  let r = 4;
  ws.getRow(r).values = ['Status', 'Numri'];
  ws.getRow(r++).font = { bold: true };
  for (const s of d.fleet.byStatus) ws.getRow(r++).values = [s.name, s.count];
  const tot = ws.getRow(r++);
  tot.values = ['Totali', d.fleet.total];
  tot.font = { bold: true };

  r += 1;
  ws.getCell(r++, 1).value = 'Flota sipas modelit';
  ws.getCell(r - 1, 1).font = { bold: true };
  const head = ws.getRow(r++);
  head.values = ['Modeli', ...d.fleet.byStatus.map((s) => s.name), 'Totali'];
  head.font = { bold: true };
  for (const m of d.byModel) {
    ws.getRow(r++).values = [`${m.make} ${m.model}`.trim(), ...d.fleet.byStatus.map((s) => m.byStatus[s.id] || 0), m.total];
  }
  const grand = ws.getRow(r++);
  grand.values = ['Totali', ...d.fleet.byStatus.map((s) => s.count), d.fleet.total];
  grand.font = { bold: true };

  r += 1;
  ws.getCell(r, 1).value = `Pa regjistrim siguracioni: ${d.insurance.missing}`;
  ws.getCell(r + 1, 1).value = `Pa regjistrim kolaudimi: ${d.inspection.missing}`;

  expirySheet(wb, 'Siguracione', d.insurance, d.days);
  expirySheet(wb, 'Kolaudim', d.inspection, d.days);

  return { wb, count: d.fleet.total };
}

module.exports = { dashboardWorkbook };
