// Excel exports are plain downloads: the browser sends the login cookie.
// exportUrl('/exports/maintenance', { search, dateFrom }) -> '/api/exports/maintenance?search=...'
export function exportUrl(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}
