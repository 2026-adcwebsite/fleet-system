// 1234.5 -> "1,234.50"
export function formatMoney(value) {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Shows a value that may be a string, a { name } object or a { make, model } object.
export function label(x) {
  if (x === null || x === undefined || x === "") return "—";
  if (typeof x === "string" || typeof x === "number") return String(x);
  if (x.make !== undefined) return [x.make, x.model].filter(Boolean).join(" ");
  return x.name ?? "—";
}
