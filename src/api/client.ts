import i18n from '../i18n';

/**
 * Thin fetch wrapper for the Sedra Petrol API.
 *  - base URL from VITE_API_URL (default http://localhost:5080/api)
 *  - adds the bearer token and Accept-Language (ar | en) to every call
 *  - turns ProblemDetails / validation errors into ApiError with a readable message
 *  - short-lived access token + rotating refresh token: the access token is renewed silently
 *    (shortly before it expires, and once more on any 401); only when the refresh fails is the session
 *    cleared and "auth:unauthorized" fired so the app returns to /login
 */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5080/api').replace(/\/+$/, '');

const TOKEN_KEY = 'sedra.token';
const EXP_KEY = 'sedra.token.exp';
const REFRESH_KEY = 'sedra.refresh';
const REFRESH_EXP_KEY = 'sedra.refresh.exp';

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null | undefined) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/** Token pair returned by /auth/login and /auth/refresh. */
export interface TokenPair { token: string; expiresAt: string; refreshToken?: string | null; refreshExpiresAt?: string | null; sessionExpiresAt?: string | null }

export const tokenStore = {
  get: (): string | null => ls.get(TOKEN_KEY),
  /** access token only (kept for older callers) */
  set: (t: string) => ls.set(TOKEN_KEY, t),
  setPair: (p: TokenPair) => {
    ls.set(TOKEN_KEY, p.token);
    ls.set(EXP_KEY, p.expiresAt);
    if (p.refreshToken) { ls.set(REFRESH_KEY, p.refreshToken); ls.set(REFRESH_EXP_KEY, p.refreshExpiresAt ?? null); }
  },
  getRefresh: (): string | null => ls.get(REFRESH_KEY),
  /** ms until the access token expires (−∞ when unknown) */
  msLeft: (): number => { const e = ls.get(EXP_KEY); const t = e ? Date.parse(e.endsWith('Z') || /[+-]\d\d:\d\d$/.test(e) ? e : e + 'Z') : NaN; return Number.isNaN(t) ? -Infinity : t - Date.now(); },
  hasSession: (): boolean => !!(ls.get(TOKEN_KEY) || ls.get(REFRESH_KEY)),
  clear: () => { [TOKEN_KEY, EXP_KEY, REFRESH_KEY, REFRESH_EXP_KEY].forEach(k => ls.set(k, null)); },
};

// ---------------------------------------------------------------- refresh (single flight, shared by tabs)
let refreshing: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const used = tokenStore.getRefresh();
  if (!used) return false;
  const run = async (): Promise<boolean> => {
    // another tab may have renewed while we waited for the lock
    const now = tokenStore.getRefresh();
    if (now && now !== used && tokenStore.msLeft() > 15_000) return true;
    try {
      const res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: now ?? used }) });
      if (res.ok) { tokenStore.setPair(await res.json()); window.dispatchEvent(new Event('auth:refreshed')); return true; }
      const body = await res.json().catch(() => null);
      if (body?.code === 'refresh_stale') {             // renewed by another tab a moment ago
        await new Promise(r => setTimeout(r, 400));
        return !!tokenStore.getRefresh() && tokenStore.getRefresh() !== used;
      }
      return false;
    } catch { return tokenStore.msLeft() > 0; }          // network error: keep the session, the request will fail normally
  };
  const locks = (navigator as any).locks;
  return locks?.request ? locks.request('sedra-token-refresh', run) : run();
}

/** Renew the access token (one call at a time). Resolves false when the session is over. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

function endSession() {
  tokenStore.clear();
  window.dispatchEvent(new Event('auth:unauthorized'));
}

/** fetch() with the bearer token, silent refresh and one retry on 401 — for downloads / blobs outside api(). */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (tokenStore.getRefresh() && tokenStore.msLeft() < 30_000) await refreshSession();
  const go = () => { const h = new Headers(init.headers); const t = tokenStore.get(); if (t) h.set('Authorization', `Bearer ${t}`); return fetch(url, { ...init, headers: h }); };
  let res = await go();
  if (res.status === 401 && tokenStore.getRefresh()) {
    if (await refreshSession()) res = await go(); else endSession();
  }
  return res;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Don't treat 401 as "session expired" (used by the login call). */
  skipAuthRedirect?: boolean;
}

/** Standard list response: { items, total, page, pageSize }. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_BASE + (path.startsWith('/') ? path : '/' + path));
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

const isArabic = () => (i18n.language ?? 'ar').startsWith('ar');

async function parseError(res: Response): Promise<ApiError> {
  let body: any = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  let message: string | undefined = body?.detail;
  // ASP.NET automatic model-validation response: { title, errors: { field: [msg] } }
  if (!message && body?.errors && typeof body.errors === 'object') {
    message = Object.values(body.errors as Record<string, string[]>).flat().join(' — ');
  }
  if (!message) {
    message = res.status === 403
      ? (isArabic() ? 'ليس لديك صلاحية لهذا الإجراء.' : 'You do not have permission for this action.')
      : res.status === 404
        ? (isArabic() ? 'السجل غير موجود.' : 'Record not found.')
        : body?.title ?? res.statusText ?? (isArabic() ? 'حدث خطأ غير متوقع.' : 'Unexpected error.');
  }
  return new ApiError(message ?? 'Error', res.status, body?.code);
}

async function send<T>(path: string, init: RequestInit, opts: RequestOptions, retried = false): Promise<T> {
  // renew a little before the access token expires (no failed request, no flicker)
  if (!opts.skipAuthRedirect && tokenStore.getRefresh() && tokenStore.msLeft() < 30_000) await refreshSession();
  const headers = new Headers(init.headers);
  headers.set('Accept-Language', isArabic() ? 'ar' : 'en');
  headers.set('Accept', 'application/json');
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { ...init, headers, signal: opts.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(isArabic() ? 'تعذّر الاتصال بالخادم. تأكد من تشغيل الـ API.' : 'Cannot reach the server. Is the API running?', 0, 'network');
  }

  if (res.status === 401 && !opts.skipAuthRedirect) {
    // token expired / revoked: try the refresh token once, then repeat the request
    if (!retried && tokenStore.getRefresh() && await refreshSession()) return send<T>(path, init, opts, true);
    endSession();
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** JSON request. */
export function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET') };
  if (opts.body !== undefined) {
    init.body = JSON.stringify(opts.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return send<T>(path, init, opts);
}

/** multipart/form-data upload (e.g. POST /documents). */
export function apiUpload<T>(path: string, form: FormData, opts: Omit<RequestOptions, 'body' | 'method'> = {}): Promise<T> {
  return send<T>(path, { method: 'POST', body: form }, opts);
}

/** Message to show in the UI for any thrown error. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}
