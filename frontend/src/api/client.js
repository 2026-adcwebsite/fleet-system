import { t } from '../i18n';

// Thrown for every failed request.
// status: HTTP status (0 = no connection), code: e.g. MUST_CHANGE_PASSWORD, details: 400 field errors
export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

// Used when the server sends no { error } message
const FALLBACK = {
  403: 'errors.forbidden',
  404: 'errors.notFound',
  409: 'errors.conflict',
  413: 'errors.fileTooLarge',
  429: 'errors.tooMany',
};

// api('/vehicles', { query: { page: 1 } })
// api('/auth/login', { method: 'POST', body: { email, password } })
export async function api(path, { method = 'GET', body, query } = {}) {
  let url = `/api${path}`;

  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params.set(key, value);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const options = { method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError(0, t('errors.network'));
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (res.ok) return data;

  const message = data?.error || t(FALLBACK[res.status] || 'errors.generic');
  throw new ApiError(res.status, message, { code: data?.code, details: data?.details });
}
