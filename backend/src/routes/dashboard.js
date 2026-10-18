// Dashboard: fleet counts by status and model, and insurance / inspection expiry.
//
//   GET /api/dashboard?days=30&departmentId=&make=&modelId=
//
// Department managers only see their own department. Admins can narrow by department.
// "Latest period per vehicle" decides expiry: only each vehicle's newest insurance
// (or inspection) endDate counts.
const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../auth/session");
const { requirePermission } = require("../auth/permissions");
const { validate } = require("../lib/validate");
const { positiveInt } = require("../lib/schemas");
const { buildDashboard } = require("../lib/dashboard");

const router = express.Router();
router.use(requireAuth);

const query = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  departmentId: positiveInt.optional(),
  make: z.string().trim().min(1).optional(),
  modelId: positiveInt.optional(),
});

router.get(
  "/",
  requirePermission("dashboard", "view"),
  validate({ query }),
  async (req, res) => {
    res.json(await buildDashboard(req.user, req.valid.query));
  },
);

module.exports = router;
