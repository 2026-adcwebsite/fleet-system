// "2026-10-19" -> "19/10/2026"
export function formatDate(value) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

// Today as "YYYY-MM-DD" in the server's timezone (Europe/Tirane)
export function todayTirane() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane" }).format(
    new Date(),
  );
}

// 'expired' (before today) | 'expiring' (within `days`) | 'ok' | 'none' (no date)
export function expiryStatus(endDate, days = 30) {
  if (!endDate) return "none";
  const today = todayTirane();
  if (endDate < today) return "expired";
  const diff = (new Date(endDate) - new Date(today)) / 86400000;
  return diff <= days ? "expiring" : "ok";
}

export const EXPIRY_CLASS = {
  expired: "font-medium text-red-600",
  expiring: "font-medium text-amber-600",
  ok: "",
  none: "",
};

// "2026-10-19T14:05:00Z" -> "19/10/2026, 15:05" (Europe/Tirane)
export function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Europe/Tirane",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
