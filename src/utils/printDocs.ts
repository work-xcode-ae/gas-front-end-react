import dayjs from 'dayjs';
import { api, API_BASE, authFetch } from '../api/client';
import { amcContractHtml, deliveryContractHtml, invoiceHtml, supplyContractHtml, type AmcPrintData, type DeliveryContractPrintData, type InvoicePrintData, type PrintAssets, type SupplyContractPrintData } from './printLayouts';

/**
 * Printable customer documents (tax invoice, payment receipt).
 * Opens a print window with an Arabic RTL A4 page in the system style and calls print().
 * Call openPrintWindow() synchronously inside the click handler (so pop-up blockers allow it),
 * then pass the window to printInvoice / printReceipt.
 */

interface Company { nameEn?: string; nameAr?: string; trn?: string; address?: string; phone?: string; email?: string; logoPath?: string }
interface PaymentDetail {
  payment: {
    id: number; receiptNo: string; date: string; amount: number; methodLabel?: string; reference?: string; receivedBy?: string; notes?: string;
    tenant?: string; status?: string; statusLabel?: string; allocated?: number; unallocated?: number;
  };
  allocations: { id: number; invoiceId: number; invoiceNo: string; issueDate: string; totalAmount?: number; amount: number }[];
}
export interface PrintContext { unitNo?: string; buildingName?: string; tenantPhone?: string; tenantEmail?: string }

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n2 = (v?: number | null) => (v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const d = (v?: string | null) => (v ? String(v).slice(0, 10) : '—');

export function openPrintWindow(): Window | null {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (w) w.document.write('<html dir="rtl"><body style="font-family:sans-serif;padding:40px;color:#1a5c2a">جارٍ تحضير المستند للطباعة…</body></html>');
  return w;
}

/** Fetch an uploaded file (e.g. the company logo) with the auth token and return a data: URL. */
async function fileAsDataUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const res = await authFetch(`${API_BASE}/files/${path}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

async function loadCompany(): Promise<Company | null> {
  try {
    const r = await api<{ items: Company[] }>('/companies', { query: { pageSize: 1 } });
    return r.items?.[0] ?? null;
  } catch { return null; }
}

const CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #222; font-size: 12.5px; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 800px; margin: 0 auto; padding: 8px; }
  .head { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #1a5c2a, #0b2e18); color: #fff;
    border-radius: 12px; padding: 18px 22px; border-bottom: 4px solid #c9a84c; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .logo { width: 58px; height: 58px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .logo img { max-width: 52px; max-height: 52px; }
  .logo span { color: #1a5c2a; font-weight: 800; font-size: 22px; }
  .cname { font-size: 18px; font-weight: 800; color: #c9a84c; }
  .cname-en { font-size: 11px; opacity: .8; direction: ltr; text-align: right; }
  .cmeta { font-size: 10.5px; opacity: .85; margin-top: 3px; }
  .doc { text-align: left; }
  .doc-title { font-size: 20px; font-weight: 800; }
  .doc-title-en { font-size: 11px; letter-spacing: 2px; color: #c9a84c; }
  .doc-no { margin-top: 6px; font-family: monospace; font-size: 14px; background: rgba(255,255,255,.12); padding: 3px 10px; border-radius: 8px; display: inline-block; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .box { border: 1px solid #e3e8e3; border-radius: 10px; padding: 12px 14px; background: #fafcfa; }
  .box h4 { margin: 0 0 8px; font-size: 12px; color: #1a5c2a; border-bottom: 1px dashed #cfdccf; padding-bottom: 6px; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
  .row .k { color: #777; } .row .v { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #1a5c2a; color: #fff; font-weight: 600; padding: 8px; font-size: 11.5px; text-align: right; }
  th:first-child { border-radius: 0 8px 0 0; } th:last-child { border-radius: 8px 0 0 0; }
  td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: left; font-family: monospace; direction: ltr; }
  .totals { margin-top: 14px; display: flex; justify-content: flex-start; }
  .totals .box { min-width: 300px; }
  .grand { margin-top: 6px; padding-top: 8px; border-top: 2px solid #1a5c2a; font-size: 15px; }
  .grand .v { color: #1a5c2a; font-size: 17px; }
  .due .v { color: #c62828; }
  .paid-stamp { display: inline-block; border: 3px solid #2e7d32; color: #2e7d32; font-weight: 800; padding: 4px 14px; border-radius: 8px; transform: rotate(-8deg); font-size: 16px; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; }
  .s-paid { background: #e8f5e9; color: #2e7d32; } .s-overdue { background: #ffebee; color: #c62828; } .s-other { background: #fff8e1; color: #8a6d1f; }
  .amount-box { text-align: center; padding: 18px; border-radius: 12px; background: linear-gradient(135deg, #f3faf3, #fbf6e8); border: 2px solid #c9a84c; margin: 16px 0; }
  .amount-box .big { font-size: 30px; font-weight: 800; color: #1a5c2a; font-family: monospace; direction: ltr; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .sign div { border-top: 1px solid #999; padding-top: 6px; text-align: center; color: #777; font-size: 11px; }
  .foot { margin-top: 24px; text-align: center; color: #999; font-size: 10.5px; border-top: 1px solid #eee; padding-top: 8px; }
  .notes { margin-top: 12px; padding: 10px 12px; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 8px; font-size: 11.5px; }
  .clause { margin: 14px 0 6px; font-size: 13px; color: #1a5c2a; font-weight: 800; }
  ol.terms { margin: 4px 0 0; padding-inline-start: 22px; } ol.terms li { padding: 3px 0; line-height: 1.7; font-size: 12px; }
  .term-cat { margin-top: 10px; font-weight: 700; font-size: 12px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
  .sign3 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 46px; }
  .sign3 .s { text-align: center; } .sign3 .s .who { font-weight: 700; color: #1a5c2a; margin-bottom: 34px; }
  .sign3 .s .line { border-top: 1px solid #999; padding-top: 6px; color: #777; font-size: 11px; }
  .chips span { display: inline-block; border: 1px solid #cfdccf; background: #f3faf3; border-radius: 12px; padding: 2px 10px; margin: 2px; font-size: 11.5px; }
  .avoid { page-break-inside: avoid; }
  @media print { .no-print { display: none; } }
`;

function header(company: Company | null, logo: string | null, titleAr: string, titleEn: string, no: string) {
  const name = company?.nameAr || company?.nameEn || 'شركة الغاز';
  const meta = [company?.address, company?.phone, company?.email].filter(Boolean).map(esc).join(' · ');
  return `
  <div class="head">
    <div class="brand">
      <div class="logo">${logo ? `<img src="${logo}" alt="">` : `<span>${esc(name.trim().charAt(0))}</span>`}</div>
      <div>
        <div class="cname">${esc(name)}</div>
        ${company?.nameEn ? `<div class="cname-en">${esc(company.nameEn)}</div>` : ''}
        ${meta ? `<div class="cmeta">${meta}</div>` : ''}
        ${company?.trn ? `<div class="cmeta">الرقم الضريبي TRN: <b>${esc(company.trn)}</b></div>` : ''}
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">${esc(titleAr)}</div>
      <div class="doc-title-en">${esc(titleEn)}</div>
      <div class="doc-no">${esc(no)}</div>
    </div>
  </div>`;
}

function render(w: Window, title: string, body: string) {
  w.document.open();
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>${CSS}</style></head><body><div class="page">${body}</div>
    <script>
      function go(){ setTimeout(function(){ window.focus(); window.print(); }, 250); }
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 2500); } else { window.onload = go; }
    </script></body></html>`);
  w.document.close();
}

function failed(w: Window, msg: string) {
  w.document.open();
  w.document.write(`<html dir="rtl"><body style="font-family:sans-serif;padding:40px;color:#c62828">تعذّر تحضير المستند: ${esc(msg)}</body></html>`);
  w.document.close();
}


/** Assets of the printed forms: the company's uploaded letterhead / logo, or the built-in ones shipped with the portal. */
async function printAssets(company?: { letterheadPath?: string | null; logoPath?: string | null } | null): Promise<PrintAssets> {
  const base = `${window.location.origin}${(import.meta as any).env?.BASE_URL ?? '/'}print/`;
  const [letterhead, logo] = await Promise.all([fileAsDataUrl(company?.letterheadPath), fileAsDataUrl(company?.logoPath)]);
  return { letterhead: letterhead ?? `${base}letterhead.jpg`, logo: logo ?? `${base}logo.png`, logoAmc: logo ?? `${base}logo-amc.jpg` };
}

function writeDoc(w: Window, html: string) {
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Gas / tax invoice on the company letterhead (same layout as the printed company invoice). */
export async function printInvoice(w: Window | null, invoiceId: number, _ctx: PrintContext = {}) {
  if (!w) return;
  try {
    const data = await api<InvoicePrintData>(`/print/invoice/${invoiceId}`);
    writeDoc(w, invoiceHtml(data, await printAssets(data.company)));
  } catch (e: any) {
    failed(w, e?.message ?? String(e));
  }
}

/** Payment receipt (سند قبض) for the customer. */
export async function printReceipt(w: Window | null, paymentId: number, ctx: PrintContext = {}) {
  if (!w) return;
  try {
    const data = await api<PaymentDetail>(`/payments/${paymentId}`);
    const p = data.payment;
    const company = await loadCompany();
    const logo = await fileAsDataUrl(company?.logoPath);
    const allocs = data.allocations.length ? `
      <h4 style="margin:16px 0 6px;color:#1a5c2a">الفواتير المسددة بهذه الدفعة</h4>
      <table><thead><tr><th>رقم الفاتورة</th><th>تاريخ الفاتورة</th><th>قيمة الفاتورة</th><th>المبلغ المسدد (د.إ)</th></tr></thead><tbody>
      ${data.allocations.map(a => `<tr><td>${esc(a.invoiceNo)}</td><td>${d(a.issueDate)}</td><td class="num">${n2(a.totalAmount)}</td><td class="num"><b>${n2(a.amount)}</b></td></tr>`).join('')}
      </tbody></table>` : '';
    render(w, `إيصال ${p.receiptNo}`, `
      ${header(company, logo, 'سند قبض', 'PAYMENT RECEIPT', p.receiptNo)}
      <div class="grid">
        <div class="box"><h4>استلمنا من</h4>
          <div class="row"><span class="k">العميل</span><span class="v">${esc(p.tenant)}</span></div>
          ${ctx.tenantPhone ? `<div class="row"><span class="k">الهاتف</span><span class="v"><bdi dir="ltr">${esc(ctx.tenantPhone)}</bdi></span></div>` : ''}
          ${ctx.buildingName ? `<div class="row"><span class="k">المبنى</span><span class="v">${esc(ctx.buildingName)}</span></div>` : ''}
          ${ctx.unitNo ? `<div class="row"><span class="k">الوحدة</span><span class="v">${esc(ctx.unitNo)}</span></div>` : ''}
        </div>
        <div class="box"><h4>بيانات الدفعة</h4>
          <div class="row"><span class="k">التاريخ</span><span class="v">${d(p.date)}</span></div>
          <div class="row"><span class="k">طريقة الدفع</span><span class="v">${esc(p.methodLabel ?? '—')}</span></div>
          <div class="row"><span class="k">المرجع</span><span class="v">${esc(p.reference ?? '—')}</span></div>
          <div class="row"><span class="k">استلمها</span><span class="v">${esc(p.receivedBy ?? '—')}</span></div>
          <div class="row"><span class="k">الحالة</span><span class="v">${esc(p.statusLabel ?? p.status)}</span></div>
        </div>
      </div>
      <div class="amount-box"><div style="color:#777;font-size:12px">المبلغ المستلم</div><div class="big">${n2(p.amount)} AED</div>
        ${p.unallocated ? `<div style="font-size:11px;color:#8a6d1f;margin-top:4px">رصيد دائن غير مخصص: ${n2(p.unallocated)} د.إ</div>` : ''}</div>
      ${allocs}
      ${p.notes ? `<div class="notes"><b>ملاحظات:</b> ${esc(p.notes)}</div>` : ''}
      <div class="sign"><div>توقيع المستلم</div><div>ختم الشركة</div></div>
      <div class="foot">${esc(company?.nameAr || company?.nameEn || '')} · طُبع بتاريخ ${dayjs().format('YYYY-MM-DD')}</div>`);
  } catch (e: any) {
    failed(w, e?.message ?? String(e));
  }
}


// ═════════════════════════ contracts ═════════════════════════

/** Gas supply contract between the company and the tenant (form, terms & conditions, signatures). */
export async function printSupplyContract(w: Window | null, contractId: number) {
  if (!w) return;
  try {
    const data = await api<SupplyContractPrintData>(`/print/supply-contract/${contractId}`);
    writeDoc(w, supplyContractHtml(data, await printAssets(data.company)));
  } catch (e: any) {
    failed(w, e?.message ?? String(e));
  }
}

/** Gas supply & annual maintenance contract with the building owner (bilingual articles). */
export async function printAmcContract(w: Window | null, contractId: number) {
  if (!w) return;
  try {
    const data = await api<AmcPrintData>(`/print/amc-contract/${contractId}`);
    writeDoc(w, amcContractHtml(data, await printAssets(data.company)));
  } catch (e: any) {
    failed(w, e?.message ?? String(e));
  }
}

/** Gas supply contract of a villa / restaurant (price per litre, tanks, terms, signatures). */
export async function printDeliveryContract(w: Window | null, contractId: number) {
  if (!w) return;
  try {
    const data = await api<DeliveryContractPrintData>(`/print/delivery-contract/${contractId}`);
    writeDoc(w, deliveryContractHtml(data, await printAssets(data.company)));
  } catch (e: any) {
    failed(w, e?.message ?? String(e));
  }
}
