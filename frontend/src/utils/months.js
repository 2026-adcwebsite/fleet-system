import { todayTirane } from './dates';

// Months are integers like 202610.
export function currentYearMonth() {
  const [y, m] = todayTirane().split('-');
  return Number(y) * 100 + Number(m);
}

export function shiftMonth(ym, delta) {
  const idx = Math.floor(ym / 100) * 12 + ((ym % 100) - 1) + delta;
  return Math.floor(idx / 12) * 100 + (idx % 12) + 1;
}

// 202610 -> "Oct 2026"
export function formatMonth(ym) {
  return new Date(Math.floor(ym / 100), (ym % 100) - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

// 1..12 -> "January"
export function monthName(m) {
  return new Date(2000, m - 1, 1).toLocaleString('en-US', { month: 'long' });
}

// Default date for a new fill-up: today if it is in the month, else the 1st
export function defaultFillDate(ym) {
  const today = todayTirane();
  const mm = String(ym % 100).padStart(2, '0');
  const prefix = `${Math.floor(ym / 100)}-${mm}`;
  return today.startsWith(prefix) ? today : `${prefix}-01`;
}
