import { t } from "../i18n";

// Thrown for every failed request.
// status: HTTP status (0 = no connection), code: e.g. MUST_CHANGE_PASSWORD, details: 400 field errors
export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details || [];
  }

  // { plate: 'message', ... } for showing 400 details under the right form field
  get fieldErrors() {
    const out = {};
    for (const d of this.details) {
      const name = String(d.field || "").replace(/^(body|params|query)\./, "");
      if (name && !out[name]) out[name] = d.message;
    }
    return out;
  }
}

// AuthContext registers these so the client can react to 401 and the password lock.
const handlers = { onUnauthorized: () => {}, onMustChangePassword: () => {} };
export const setApiHandlers = (h) => Object.assign(handlers, h);

// A 401 on these means "wrong credentials", not "session expired"
const NO_REDIRECT_401 = ["/auth/login", "/auth/change-password"];

// Used when the server sends no { error } message
const FALLBACK = {
  403: "errors.forbidden",
  404: "errors.notFound",
  409: "errors.conflict",
  413: "errors.fileTooLarge",
  429: "errors.tooMany",
};

// api('/vehicles', { query: { page: 1 } })
// api('/auth/login', { method: 'POST', body: { email, password } })
export async function api(path, { method = "GET", body, query, form } = {}) {
  let url = `/api${path}`;

  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "")
        params.set(key, value);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const options = { method, credentials: "include", headers: {} };
  if (form) {
    options.body = form; // FormData: the browser sets the multipart header itself
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw new ApiError(0, t("errors.network"));
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }

  if (res.ok) return data;

  const message =
    res.status === 429
      ? t("errors.tooMany")
      : data?.error || t(FALLBACK[res.status] || "errors.generic");
  const err = new ApiError(res.status, message, {
    code: data?.code,
    details: data?.details,
  });

  if (res.status === 401 && !NO_REDIRECT_401.includes(path))
    handlers.onUnauthorized();
  if (res.status === 403 && data?.code === "MUST_CHANGE_PASSWORD")
    handlers.onMustChangePassword();
  throw err;
}
