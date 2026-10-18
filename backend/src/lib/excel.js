// Reading .xlsx uploads: header matching, cell cleanup and value parsers.
const ExcelJS = require('exceljs');

const MAX_ROWS = 5000;

// 'Qyteti ' / 'Durrës' / 'Nr. Shasie' -> comparable forms
const fold = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const headerKey = (s) => fold(s).replace(/[^a-z0-9]/g, '');
const nameKey = (s) => fold(s).replace(/\s+/g, ' ').trim();

class RowError extends Error {}

// exceljs gives strings, numbers, booleans, Dates, or objects (rich text, formulas, links)
function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellValue(v.result);
    if ('text' in v) return cellValue(v.text);
    if ('error' in v) return null;
    return null;
  }
  return v;
}

// Plain trimmed text; '' when empty
function text(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
}

const TRUE_WORDS = new Set(['po', 'yes', 'true', '1', 'x', 'y']);
const FALSE_WORDS = new Set(['jo', 'no', 'false', '0', 'n']);

// Po/Jo -> true/false; empty -> undefined
function parseBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = fold(text(v));
  if (s === '') return undefined;
  if (TRUE_WORDS.has(s)) return true;
  if (FALSE_WORDS.has(s)) return false;
  throw new RowError('use Po or Jo');
}

function realDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new RowError('not a real date');
  }
  return date;
}

// Date cell, Excel serial number, YYYY-MM-DD, or day-first DD/MM/YYYY (also . and -)
function parseDate(v) {
  if (v === null || v === undefined || text(v) === '') return undefined;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) throw new RowError('not a real date');
    return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  }
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) throw new RowError('not a real date');
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000);
  }
  const s = text(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return realDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) return realDate(Number(m[3]), Number(m[2]), Number(m[1]));
  throw new RowError('use a date like 31/12/2026');
}

// whole number; '12 345' and '12,345' are accepted
function parseInteger(v) {
  if (v === null || v === undefined || text(v) === '') return undefined;
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new RowError('must be a whole number');
    return v;
  }
  const s = text(v).replace(/[\s,]/g, '');
  if (!/^\d+(\.0+)?$/.test(s)) throw new RowError('must be a whole number');
  return Number(s);
}

// Load the first sheet, find the header row, map columns to field names.
// `aliases` maps a field name to the accepted header spellings.
async function readSheet(buffer, aliases) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (e) {
    throw Object.assign(new Error('The file could not be read as an .xlsx workbook'), { status: 400 });
  }
  const ws = wb.worksheets[0];
  if (!ws) throw Object.assign(new Error('The workbook has no sheets'), { status: 400 });

  const lookup = new Map();
  for (const [field, names] of Object.entries(aliases)) {
    for (const n of names) lookup.set(headerKey(n), field);
  }

  // header row = first row (of the top 15) with at least 3 recognised headers
  let headerRow = 0;
  let columns = new Map();
  for (let r = 1; r <= Math.min(15, ws.rowCount) && !headerRow; r++) {
    const found = new Map();
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
      const field = lookup.get(headerKey(text(cellValue(cell.value))));
      if (field && !found.has(field)) found.set(field, col);
    });
    if (found.size >= 3) {
      headerRow = r;
      columns = found;
    }
  }
  if (!headerRow) {
    throw Object.assign(new Error('No header row found. Use the template: its first columns are Qyteti and Targa.'), {
      status: 400,
    });
  }
  if (ws.rowCount - headerRow > MAX_ROWS) {
    throw Object.assign(new Error(`Too many rows (max ${MAX_ROWS} per upload)`), { status: 400 });
  }

  // data rows; completely empty rows are skipped
  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const values = {};
    let any = false;
    const row = ws.getRow(r);
    for (const [field, col] of columns) {
      const v = cellValue(row.getCell(col).value);
      values[field] = v;
      if (text(v) !== '') any = true;
    }
    if (any) rows.push({ rowNumber: r, values });
  }
  return { headerRow, columns: [...columns.keys()], rows };
}

module.exports = { ExcelJS, MAX_ROWS, fold, headerKey, nameKey, RowError, cellValue, text, parseBool, parseDate, parseInteger, readSheet };
