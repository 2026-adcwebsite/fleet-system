// Fuel helpers: month math, week buckets, usage totals and price lookup.
const { z } = require('zod');
const { prisma } = require('../db');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

// yearMonth is an integer like 202609
const isYearMonth = (n) => Number.isInteger(n) && n >= 200001 && n <= 209912 && n % 100 >= 1 && n % 100 <= 12;
const yearMonthBody = z.number().refine(isYearMonth, 'Use YYYYMM, e.g. 202609');
const yearMonthQuery = z.coerce.number().refine(isYearMonth, 'Use YYYYMM, e.g. 202609');

function toYearMonth(date) {
  return date.getUTCFullYear() * 100 + date.getUTCMonth() + 1;
}

const currentYearMonth = () => toYearMonth(new Date());

// First and last day of the month, as UTC dates (matches @db.Date columns)
function monthRange(yearMonth) {
  const y = Math.floor(yearMonth / 100);
  const m = yearMonth % 100;
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 0)) };
}

// The sheet has four week columns: days 1-7, 8-14, 15-21, and 22 to the end of the month.
function weekIndex(date) {
  const d = date.getUTCDate();
  if (d <= 7) return 0;
  if (d <= 14) return 1;
  if (d <= 21) return 2;
  return 3;
}

// transactions -> { weeks: [l, l, l, l], totalL, amount }
function summarize(transactions) {
  const weeks = [0, 0, 0, 0];
  let amount = 0;
  for (const t of transactions) {
    weeks[weekIndex(t.date)] += Number(t.litres);
    if (t.amount !== null && t.amount !== undefined) amount += Number(t.amount);
  }
  return {
    weeks: weeks.map(round2),
    totalL: round2(weeks.reduce((a, b) => a + b, 0)),
    amount: round2(amount),
  };
}

const EMPTY_USAGE = { weeks: [0, 0, 0, 0], totalL: 0, amount: 0 };

// Usage per vehicle for one month: Map(vehicleId -> summarize(...)).
// Reports go by vehicle + date, so a transaction counts even if it was entered before the rollout existed.
async function usageByVehicle(vehicleIds, yearMonth) {
  const { start, end } = monthRange(yearMonth);
  const rows = await prisma.fuelTransaction.findMany({
    where: { vehicleId: { in: vehicleIds }, date: { gte: start, lte: end } },
    select: { vehicleId: true, date: true, litres: true, amount: true },
  });

  const grouped = new Map();
  for (const t of rows) {
    if (!grouped.has(t.vehicleId)) grouped.set(t.vehicleId, []);
    grouped.get(t.vehicleId).push(t);
  }
  const result = new Map();
  for (const [vehicleId, list] of grouped) result.set(vehicleId, summarize(list));
  return result;
}

// Price per litre: the given one, else the latest FuelPrice on or before the date (marked estimated).
// Returns { unitPrice, amount, priceEstimated }; amount is null when no price can be found.
async function buildPricing({ litres, unitPrice, supplierId, fuelTypeId, date }) {
  if (unitPrice !== null && unitPrice !== undefined) {
    return { unitPrice, amount: round2(litres * unitPrice), priceEstimated: false };
  }

  const fallback = await prisma.fuelPrice.findFirst({
    where: { supplierId, fuelTypeId, effectiveDate: { lte: date } },
    orderBy: { effectiveDate: 'desc' },
  });
  if (!fallback) return { unitPrice: null, amount: null, priceEstimated: false };

  const price = Number(fallback.pricePerL);
  return { unitPrice: price, amount: round2(litres * price), priceEstimated: true };
}

module.exports = {
  round2,
  round4,
  isYearMonth,
  yearMonthBody,
  yearMonthQuery,
  toYearMonth,
  currentYearMonth,
  monthRange,
  weekIndex,
  summarize,
  EMPTY_USAGE,
  usageByVehicle,
  buildPricing,
};
