import { api, tokenStore } from './client';

/** Usage tracking (audit trail): page / record opened, print, export (file download), logout. Fire-and-forget. */
export type TrackAction = 'view' | 'print' | 'export' | 'download' | 'logout';
export interface TrackInfo { path?: string; title?: string; entityType?: string; entityId?: string | number; details?: string }

const recent = new Map<string, number>();
export function track(action: TrackAction, info: TrackInfo = {}) {
  if (!tokenStore.get()) return;
  const path = info.path ?? (window.location.pathname + window.location.search);
  // the same view is counted once per 20 seconds (re-renders, tab switches)
  const key = `${action}|${path}|${info.entityType ?? ''}|${info.entityId ?? ''}`;
  const now = Date.now();
  if (action === 'view' && now - (recent.get(key) ?? 0) < 20_000) return;
  recent.set(key, now);
  api('/track', { method: 'POST', body: { action, path, title: info.title ?? document.title, entityType: info.entityType ?? null,
    entityId: info.entityId != null ? String(info.entityId) : null, details: info.details ?? null } }).catch(() => undefined);
}

let installed = false;
/** Global hooks: every print (Ctrl+P / window.print) and every file download made by the portal (CSV / Excel / PDF exports). */
export function installGlobalTracking() {
  if (installed) return;
  installed = true;
  window.addEventListener('beforeprint', () => track('print', { title: document.title }));
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    try { if (this.hasAttribute('download')) track('export', { details: this.getAttribute('download') || this.href.slice(0, 200) }); } catch { /* never block the download */ }
    return origClick.call(this);
  };
}
