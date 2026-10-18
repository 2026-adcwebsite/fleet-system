// Excel imports.
//
//   GET  /api/imports/fleet/template   download the .xlsx template (with dropdowns)
//   POST /api/imports/fleet            multipart: file (.xlsx), dryRun=true|false, defaultDepartmentId
//   GET  /api/imports                  upload history
//   GET  /api/imports/:id              one upload, with its error list
//
// Send dryRun=true first to see what would happen; nothing is saved. Then send it again with dryRun=false.
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { prisma } = require('../db');
const { requireAuth } = require('../auth/session');
const { requirePermission } = require('../auth/permissions');
const { validate } = require('../lib/validate');
const { pageQuery, skipTake, pageResult } = require('../lib/pagination');
const { positiveInt } = require('../lib/schemas');
const { ExcelJS } = require('../lib/excel');
const { importFleet } = require('../lib/importFleet');

const router = express.Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

// multer errors become normal JSON answers
function receiveFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 5 MB)' });
    return res.status(400).json({ error: err.message });
  });
}

const formSchema = z.object({
  dryRun: z.enum(['true', 'false']).optional(),
  defaultDepartmentId: positiveInt.optional(),
});

// ───────────── template ─────────────

router.get('/fleet/template', requirePermission('fleet', 'upload'), async (req, res) => {
  const [statuses, companies, departments] = await Promise.all([
    prisma.vehicleStatus.findMany({ orderBy: { id: 'asc' } }),
    prisma.company.findMany({ orderBy: { name: 'asc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Flota');
  const headers = [
    ['Qyteti', 16], ['Targa', 14], ['Makina (modeli/marka)', 24], ['Drejtues', 20], ['Kilometrazh', 14],
    ['Nr.ekip', 10], ['Nr.makine', 12], ['Vit prodhimi', 13], ['Zgare', 9], ['GPS', 9], ['Sensore', 16],
    ['Brandim', 12], ['Siguracione Aktivizimi', 22], ['Siguracione Mbarimi', 20], ['Kolaudim Aktivizimi', 20],
    ['Kolaudim Mbarimi', 18], ['Nr.Shasie', 20], ['Servis', 22], ['Dt. Sherbimi', 14], ['Status', 12], ['Departamenti', 16],
  ];
  ws.columns = headers.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const col = (name) => headers.findIndex(([h]) => h === name) + 1;
  const list = (name, items) => {
    const formula = `"${items.join(',')}"`;
    if (formula.length > 255) return; // Excel limit for inline lists
    for (let r = 2; r <= 1001; r++) {
      ws.getCell(r, col(name)).dataValidation = { type: 'list', allowBlank: true, formulae: [formula] };
    }
  };
  list('Zgare', ['Po', 'Jo']);
  list('GPS', ['Po', 'Jo']);
  list('Status', statuses.map((s) => s.name));
  list('Brandim', companies.map((c) => c.name));
  list('Departamenti', departments.map((d) => d.name));

  for (const name of ['Siguracione Aktivizimi', 'Siguracione Mbarimi', 'Kolaudim Aktivizimi', 'Kolaudim Mbarimi', 'Dt. Sherbimi']) {
    ws.getColumn(col(name)).numFmt = 'dd/mm/yyyy';
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="fleet-import-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});

// ───────────── upload ─────────────

router.post('/fleet', requirePermission('fleet', 'upload'), receiveFile, async (req, res) => {
  if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) {
    return res.status(400).json({ error: "Upload an .xlsx file in the 'file' field" });
  }
  const form = formSchema.safeParse(req.body || {});
  if (!form.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: form.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  const dryRun = form.data.dryRun !== 'false'; // safe default: preview unless dryRun=false is sent

  const result = await importFleet({
    req,
    buffer: req.file.buffer,
    fileName: req.file.originalname.slice(0, 255),
    dryRun,
    defaultDepartmentId: form.data.defaultDepartmentId,
  });
  res.status(dryRun ? 200 : 201).json(result);
});

// ───────────── history ─────────────

const batchView = (b, withErrors) => ({
  id: b.id,
  module: b.module,
  fileName: b.fileName,
  rowsOk: b.rowsOk,
  rowsFailed: b.rowsFailed,
  createdAt: b.createdAt,
  uploadedBy: b.user ? { id: b.user.id, name: `${b.user.name} ${b.user.surname}` } : { id: b.uploadedBy },
  ...(withErrors ? { details: b.errors } : {}),
});

router.get('/', requirePermission('fleet', 'upload'), validate({ query: z.object({ ...pageQuery }) }), async (req, res) => {
  const { page, pageSize } = req.valid.query;
  const [rows, total] = await Promise.all([
    prisma.importBatch.findMany({
      include: { user: { select: { id: true, name: true, surname: true } } },
      orderBy: { id: 'desc' },
      ...skipTake({ page, pageSize }),
    }),
    prisma.importBatch.count(),
  ]);
  res.json(pageResult(rows.map((b) => batchView(b, false)), total, { page, pageSize }));
});

router.get('/:id', requirePermission('fleet', 'upload'), validate({ params: z.object({ id: positiveInt }) }), async (req, res) => {
  const batch = await prisma.importBatch.findUnique({
    where: { id: req.valid.params.id },
    include: { user: { select: { id: true, name: true, surname: true } } },
  });
  if (!batch) return res.status(404).json({ error: 'Import not found' });
  res.json({ batch: batchView(batch, true) });
});

module.exports = router;
