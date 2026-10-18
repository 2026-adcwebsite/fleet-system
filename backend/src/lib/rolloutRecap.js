// Recap tables of a monthly rollout: "Shpenzimet Recap" (department x company x supplier) and "Totali" (supplier x fuel type).
// Shared by GET /api/rollouts/summary and the Excel export.
const { round2, EMPTY_USAGE } = require('./fuel');

// rollouts: FuelRollout rows with department, company, supplier, fuelType; usage: Map(vehicleId -> usage)
function buildRecap(rollouts, usage) {
  const byDepartment = new Map();
  const bySupplierFuel = new Map();
  const add = (map, key, base, u) => {
    if (!map.has(key)) map.set(key, { ...base, litres: 0, amount: 0 });
    const cell = map.get(key);
    cell.litres += u.totalL;
    cell.amount += u.amount;
  };

  for (const r of rollouts) {
    const u = usage.get(r.vehicleId) || EMPTY_USAGE;
    add(
      byDepartment,
      `${r.departmentId}|${r.companyId || 0}|${r.supplierId}`,
      { department: r.department.name, company: r.company ? r.company.name : null, supplier: r.supplier.name },
      u
    );
    add(bySupplierFuel, `${r.supplierId}|${r.fuelTypeId}`, { supplier: r.supplier.name, fuelType: r.fuelType.name }, u);
  }

  const finish = (map) => [...map.values()].map((c) => ({ ...c, litres: round2(c.litres), amount: round2(c.amount) }));

  return {
    byDepartment: finish(byDepartment).sort((a, b) =>
      `${a.department}${a.company}${a.supplier}`.localeCompare(`${b.department}${b.company}${b.supplier}`)
    ),
    bySupplierFuel: finish(bySupplierFuel).sort((a, b) =>
      `${a.supplier}${a.fuelType}`.localeCompare(`${b.supplier}${b.fuelType}`)
    ),
  };
}

module.exports = { buildRecap };
