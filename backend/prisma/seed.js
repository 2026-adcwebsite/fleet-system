require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ───── Lookup lists ─────
const DEPARTMENTS = ["Instalime", "Operations", "B2B", "D2D", "Administrata"];
const COMPANIES = ["ADC", "Volton", "Setup"];
const SUPPLIERS = ["Elda", "Kastrati"];
const FUEL_TYPES = ["Benzine", "Nafte"];
const VEHICLE_STATUSES = ["Aktiv", "Ne servis", "Joaktiv"];

// ───── Roles and modules ─────
const ROLES = ["admin", "standard", "dept_manager", "read_only"];
const MODULES = ["system", "dashboard", "fleet", "maintenance", "rollout"];

// Helper: list the allowed actions, everything else is false.
const allow = (...actions) => ({
  canView: actions.includes("view"),
  canCreate: actions.includes("create"),
  canEdit: actions.includes("edit"),
  canDelete: actions.includes("delete"),
  canUpload: actions.includes("upload"),
  canExport: actions.includes("export"),
});

const EVERYTHING = ["view", "create", "edit", "delete", "upload", "export"];
const WORKING = ["view", "create", "edit", "upload", "export"];

// ───── Permission matrix (role -> module -> actions) ─────
const MATRIX = {
  admin: {
    system: allow(...EVERYTHING),
    dashboard: allow(...EVERYTHING),
    fleet: allow(...EVERYTHING),
    maintenance: allow(...EVERYTHING),
    rollout: allow(...EVERYTHING),
  },
  standard: {
    system: allow(),
    dashboard: allow(),
    fleet: allow(...WORKING),
    maintenance: allow(...WORKING),
    rollout: allow(...WORKING),
  },
  dept_manager: {
    system: allow(),
    dashboard: allow("view", "export"),
    fleet: allow("view", "export"),
    maintenance: allow("view", "export"),
    rollout: allow("view", "export"),
  },
  read_only: {
    system: allow(),
    dashboard: allow(),
    fleet: allow("view"),
    maintenance: allow("view"),
    rollout: allow("view"),
  },
};

// Create each name once; running the seed again does nothing new.
async function seedNames(model, names) {
  for (const name of names) {
    await model.upsert({ where: { name }, update: {}, create: { name } });
  }
}

async function main() {
  await seedNames(prisma.department, DEPARTMENTS);
  await seedNames(prisma.company, COMPANIES);
  await seedNames(prisma.supplier, SUPPLIERS);
  await seedNames(prisma.fuelType, FUEL_TYPES);
  await seedNames(prisma.vehicleStatus, VEHICLE_STATUSES);
  await seedNames(prisma.role, ROLES);
  await seedNames(prisma.module, MODULES);

  const roles = await prisma.role.findMany();
  const modules = await prisma.module.findMany();

  // update: {} keeps any permission changed later; the seed only fills gaps.
  for (const role of roles) {
    for (const module of modules) {
      const flags = MATRIX[role.name][module.name];
      await prisma.permission.upsert({
        where: { roleId_moduleId: { roleId: role.id, moduleId: module.id } },
        update: {},
        create: { roleId: role.id, moduleId: module.id, ...flags },
      });
    }
  }

  // ───── First administrator ─────
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_SURNAME } =
    process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.",
    );
  }

  const adminRole = roles.find((r) => r.name === "admin");
  const operations = await prisma.department.findUnique({
    where: { name: "Operations" },
  });

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {}, // never overwrite an existing admin or their password
    create: {
      name: ADMIN_NAME || "Admin",
      surname: ADMIN_SURNAME || "ADC",
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      mustChangePassword: true,
      status: "active",
      roleId: adminRole.id,
      departmentId: operations.id,
    },
  });

  console.log("Seed finished.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
