// Small zod building blocks shared by the routes.
const { z } = require("zod");

const positiveInt = z.coerce.number().int().positive();
const nonEmpty = (obj) => Object.keys(obj).length > 0;
const dateOnly = (d) => (d ? d.toISOString().slice(0, 10) : null);

// Optional text: '' becomes null (clears the field), undefined means "leave alone".
const optText = (max, { upper = false } = {}) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => {
      if (v === undefined || v === null) return v;
      if (v === "") return null;
      return upper ? v.toUpperCase() : v;
    });

// 'YYYY-MM-DD' in, Date (UTC midnight) out. Rejects impossible dates like 2026-02-31.
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Invalid date")
  .transform((s) => new Date(`${s}T00:00:00Z`));

module.exports = { positiveInt, nonEmpty, dateOnly, optText, dateStr };
