// Reference data (dropdown lists): one generic router, mounted once per resource.
//
//   GET    /api/<resource>        list (any logged-in user), ?search=
//   POST   /api/<resource>        create
//   PATCH  /api/<resource>/:id    rename / edit
//   DELETE /api/<resource>/:id    delete (409 if still in use)
//
// Who may write is set per resource below (writeModule).
const express = require("express");
const { z } = require("zod");
const { prisma } = require("../db");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { validate } = require("../lib/validate");
const { audit } = require("../lib/audit");

const name = z.string().trim().min(1).max(100);
const nameOnly = z.object({ name });

const idParam = z.object({ id: z.coerce.number().int().positive() });

// Reading lists is open to every logged-in user (the forms need them),
// but not while a forced password change is pending.
function readyUser(req, res, next) {
  if (req.user.mustChangePassword) {
    return res
      .status(403)
      .json({
        error: "Password change required",
        code: "MUST_CHANGE_PASSWORD",
      });
  }
  next();
}

function referenceRouter({
  model,
  entity,
  schema,
  orderBy,
  searchFields,
  writeModule,
}) {
  const router = express.Router();
  router.use(requireAuth);

  const updateSchema = schema
    .partial()
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "Nothing to update",
    });

  router.get(
    "/",
    readyUser,
    validate({ query: z.object({ search: z.string().trim().optional() }) }),
    async (req, res) => {
      const { search } = req.valid.query;
      const where = search
        ? {
            OR: searchFields.map((f) => ({
              [f]: { contains: search, mode: "insensitive" },
            })),
          }
        : {};
      const items = await prisma[model].findMany({ where, orderBy });
      res.json({ items });
    },
  );

  router.post(
    "/",
    requirePermission(writeModule, "create"),
    validate({ body: schema }),
    async (req, res) => {
      const item = await prisma[model].create({ data: req.valid.body });
      await audit(req, "create", entity, item.id, null, item);
      res.status(201).json({ item });
    },
  );

  router.patch(
    "/:id",
    requirePermission(writeModule, "edit"),
    validate({ params: idParam, body: updateSchema }),
    async (req, res) => {
      const { id } = req.valid.params;
      const before = await prisma[model].findUnique({ where: { id } });
      if (!before) return res.status(404).json({ error: "Not found" });

      const item = await prisma[model].update({
        where: { id },
        data: req.valid.body,
      });
      await audit(req, "update", entity, id, before, item);
      res.json({ item });
    },
  );

  router.delete(
    "/:id",
    requirePermission(writeModule, "delete"),
    validate({ params: idParam }),
    async (req, res) => {
      const { id } = req.valid.params;
      const before = await prisma[model].findUnique({ where: { id } });
      if (!before) return res.status(404).json({ error: "Not found" });

      try {
        await prisma[model].delete({ where: { id } });
      } catch (err) {
        if (err.code === "P2003") {
          return res
            .status(409)
            .json({ error: "Cannot delete: still used by other records" });
        }
        throw err;
      }
      await audit(req, "delete", entity, id, before, null);
      res.json({ ok: true });
    },
  );

  return router;
}

const router = express.Router();

const RESOURCES = {
  // lists the owner controls: system module (admin by default)
  departments: {
    model: "department",
    entity: "Department",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "system",
  },
  companies: {
    model: "company",
    entity: "Company",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "system",
  },
  suppliers: {
    model: "supplier",
    entity: "Supplier",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "system",
  },
  "fuel-types": {
    model: "fuelType",
    entity: "FuelType",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "system",
  },
  "vehicle-statuses": {
    model: "vehicleStatus",
    entity: "VehicleStatus",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "system",
  },

  // lists that grow with the fleet: anyone with fleet rights can add
  cities: {
    model: "city",
    entity: "City",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "fleet",
  },
  drivers: {
    model: "driver",
    entity: "Driver",
    schema: nameOnly,
    orderBy: { name: "asc" },
    searchFields: ["name"],
    writeModule: "fleet",
  },
  "vehicle-models": {
    model: "vehicleModel",
    entity: "VehicleModel",
    schema: z.object({ make: name, model: name }),
    orderBy: [{ make: "asc" }, { model: "asc" }],
    searchFields: ["make", "model"],
    writeModule: "fleet",
  },
};

for (const [path, config] of Object.entries(RESOURCES)) {
  router.use(`/${path}`, referenceRouter(config));
}

module.exports = router;
