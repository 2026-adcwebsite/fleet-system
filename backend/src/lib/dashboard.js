// Dashboard figures: fleet counts by status and model, insurance / inspection expiry.
// Shared by GET /api/dashboard and the Excel export.
const { prisma } = require('../db');
const { departmentScope } = require('./scope');
const { dateOnly } = require('./schemas');

const DAY_MS = 24 * 60 * 60 * 1000;

// Today's date in the company's time zone (not the server's), as a UTC-midnight Date.
function todayLocal() {
  const tz = process.env.APP_TIMEZONE || 'Europe/Tirane';
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); // YYYY-MM-DD
  return new Date(`${ymd}T00:00:00Z`);
}

async function buildDashboard(user, { days, departmentId, make, modelId }) {
  const vehicleWhere = {
    AND: [
      departmentScope(user),
      departmentId ? { departmentId } : {},
      modelId ? { modelId } : {},
      make ? { model: { make: { equals: make, mode: 'insensitive' } } } : {},
    ],
  };

  const today = todayLocal();
  const until = new Date(today.getTime() + days * DAY_MS);

  const latestEnds = (model) =>
    prisma[model].groupBy({ by: ['vehicleId'], where: { vehicle: vehicleWhere }, _max: { endDate: true } });

  const [statuses, models, grouped, insuranceEnds, inspectionEnds] = await Promise.all([
    prisma.vehicleStatus.findMany({ orderBy: { id: 'asc' } }),
    prisma.vehicleModel.findMany(),
    prisma.vehicle.groupBy({ by: ['modelId', 'statusId'], where: vehicleWhere, _count: { _all: true } }),
    latestEnds('insurance'),
    latestEnds('inspection'),
  ]);

  // ── fleet counts ──
  const total = grouped.reduce((n, g) => n + g._count._all, 0);
  const statusCount = new Map(statuses.map((s) => [s.id, 0]));
  const modelRows = new Map();
  const modelById = new Map(models.map((m) => [m.id, m]));

  for (const g of grouped) {
    statusCount.set(g.statusId, (statusCount.get(g.statusId) || 0) + g._count._all);

    if (!modelRows.has(g.modelId)) {
      const m = modelById.get(g.modelId);
      modelRows.set(g.modelId, { modelId: g.modelId, make: m.make, model: m.model, total: 0, byStatus: {} });
    }
    const row = modelRows.get(g.modelId);
    row.total += g._count._all;
    row.byStatus[g.statusId] = (row.byStatus[g.statusId] || 0) + g._count._all;
  }

  // ── expiry ──
  const split = (ends) => {
    const expiring = [];
    const expired = [];
    for (const e of ends) {
      const end = e._max.endDate;
      if (!end) continue;
      if (end < today) expired.push({ vehicleId: e.vehicleId, end });
      else if (end <= until) expiring.push({ vehicleId: e.vehicleId, end });
    }
    return { expiring, expired, withRecord: ends.length };
  };
  const ins = split(insuranceEnds);
  const insp = split(inspectionEnds);

  const ids = [...new Set([...ins.expiring, ...ins.expired, ...insp.expiring, ...insp.expired].map((x) => x.vehicleId))];
  const vehicles = ids.length
    ? await prisma.vehicle.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          plate: true,
          model: { select: { make: true, model: true } },
          department: { select: { id: true, name: true } },
          city: { select: { name: true } },
          status: { select: { name: true } },
        },
      })
    : [];
  const byId = new Map(vehicles.map((v) => [v.id, v]));

  const items = (list) =>
    list
      .map(({ vehicleId, end }) => {
        const v = byId.get(vehicleId);
        return {
          vehicleId,
          plate: v.plate,
          model: `${v.model.make} ${v.model.model}`.trim(),
          department: v.department,
          city: v.city.name,
          status: v.status.name,
          endDate: dateOnly(end),
          daysLeft: Math.round((end.getTime() - today.getTime()) / DAY_MS), // negative = already expired
        };
      })
      .sort((a, b) => a.endDate.localeCompare(b.endDate) || a.plate.localeCompare(b.plate));

  const expiry = (e) => ({
    expiring: items(e.expiring),
    expired: items(e.expired),
    missing: total - e.withRecord, // vehicles with no record at all
  });

  return {
    asOf: dateOnly(today),
    days,
    fleet: {
      total,
      byStatus: statuses.map((s) => ({ id: s.id, name: s.name, count: statusCount.get(s.id) || 0 })),
    },
    byModel: [...modelRows.values()].sort((a, b) => `${a.make}${a.model}`.localeCompare(`${b.make}${b.model}`)),
    insurance: expiry(ins),
    inspection: expiry(insp),
  };
}

module.exports = { buildDashboard, todayLocal, DAY_MS };
