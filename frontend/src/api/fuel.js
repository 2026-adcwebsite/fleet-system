import { api } from "./client";

// ---- fuel transactions (fill-ups)
// params: { page, pageSize, vehicleId, supplierId, fuelTypeId, dateFrom, dateTo, search, sort, order }
// -> { items, total, page, pageSize, pages, totalLitres, totalAmount }
export const listFuelTransactions = (params) =>
  api("/fuel-transactions", { query: params });

// body: { vehicleId, date, litres, unitPrice?, supplierId?, fuelTypeId? } -> { transaction, noPrice }
export const createFuelTransaction = (body) =>
  api("/fuel-transactions", { method: "POST", body });

// body: any of { date, litres, unitPrice, supplierId, fuelTypeId }
export const updateFuelTransaction = (id, body) =>
  api(`/fuel-transactions/${id}`, { method: "PATCH", body });
export const deleteFuelTransaction = (id) =>
  api(`/fuel-transactions/${id}`, { method: "DELETE" });

// ---- fuel prices. -> { items: [{ id, supplier, fuelType, effectiveDate, pricePerL }] }
export const listFuelPrices = (params) =>
  api("/fuel-prices", { query: params });
export const createFuelPrice = (body) =>
  api("/fuel-prices", { method: "POST", body }); // 409 on duplicate
export const updateFuelPrice = (id, body) =>
  api(`/fuel-prices/${id}`, { method: "PATCH", body });
export const deleteFuelPrice = (id) =>
  api(`/fuel-prices/${id}`, { method: "DELETE" });

// ---- reconciliation (403 for dept_manager)
// -> { yearMonth, items: [{ supplierId, fuelTypeId, supplier, fuelType, purchased, platformAmount,
//                            spentAmount, spentLitres, difference, errorMargin }] }
export const getReconciliation = (yearMonth) =>
  api("/fuel-reconciliation", { query: { yearMonth } });

// body: { yearMonth, supplierId, fuelTypeId, purchased, platformAmount } -> { item }
export const saveReconciliation = (body) =>
  api("/fuel-reconciliation", { method: "PUT", body });
