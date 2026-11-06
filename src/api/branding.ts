import { useEffect, useState } from 'react';
import { API_BASE } from './client';

/** Company branding used by the portal shell: app name (browser tab + header), browser icon and logo. */
export interface Branding {
  nameEn?: string | null;
  nameAr?: string | null;
  logoPath?: string | null;
  logoDarkPath?: string | null;
  phone?: string | null;
  customerCarePhone?: string | null;
}

const CACHE_KEY = 'sedra.branding';
const DEFAULT_FAVICON = '/favicon.svg';

function readCache(): Branding | null {
  try { const s = localStorage.getItem(CACHE_KEY); return s ? JSON.parse(s) as Branding : null; } catch { return null; }
}
function writeCache(b: Branding | null) {
  try { if (b) localStorage.setItem(CACHE_KEY, JSON.stringify(b)); else localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

let current: Branding | null = readCache();
let inflight: Promise<Branding | null> | null = null;
const listeners = new Set<(b: Branding | null) => void>();

export const brandingFileUrl = (path?: string | null) => (path ? `${API_BASE}/files/${path}` : undefined);

/** App name in the requested language, falling back to the other language, then to the built-in name. */
export function appName(b: Branding | null, lang: string): string {
  const ar = b?.nameAr?.trim(); const en = b?.nameEn?.trim();
  return (lang === 'ar' ? ar || en : en || ar) || (lang === 'ar' ? 'سدرة للبترول' : 'Sedra Petrol');
}

/** Sets the browser tab title and icon from the company information. */
export function applyBranding(b: Branding | null, lang: string) {
  document.title = appName(b, lang);
  const href = brandingFileUrl(b?.logoPath) ?? DEFAULT_FAVICON;
  let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
  if (link.getAttribute('href') !== href) {
    link.removeAttribute('type'); // the uploaded logo may be png / jpg / svg — let the browser sniff it
    link.href = href;
  }
}

/** (Re)loads the branding from the API (public endpoint — works on the login page too) and notifies subscribers. */
export function refreshBranding(): Promise<Branding | null> {
  inflight = fetch(`${API_BASE}/companies/branding`)
    .then(r => (r.ok ? r.text() : Promise.reject(r.status)))
    .then(t => (t ? JSON.parse(t) as Branding : null))
    .then(b => { current = b; writeCache(b); listeners.forEach(l => l(b)); return b; })
    .catch(() => current)
    .finally(() => { inflight = null; });
  return inflight;
}

/** Company branding (cached, refreshed once per page load and after the company settings are saved). */
export function useBranding(): Branding | null {
  const [b, setB] = useState<Branding | null>(current);
  useEffect(() => {
    listeners.add(setB);
    if (!inflight && !loadedOnce) { loadedOnce = true; refreshBranding(); }
    return () => { listeners.delete(setB); };
  }, []);
  return b;
}
let loadedOnce = false;
