/**
 * HTML of the printed documents, laid out like the company's paper forms:
 *  - gas invoice  → the "GAS INVOICE" letterhead with the tax-invoice grid (Crystal invoice layout)
 *  - gas supply contract → "عقد تزويد الغاز / Gas Supply Contract" (3 pages: form, terms, signatures)
 *  - annual maintenance contract → bilingual articles, English on the left and Arabic on the right
 * Pure functions (data in → HTML out) so they can be rendered and checked outside the app.
 */

export interface PrintAssets { letterhead: string; logo: string; logoAmc: string }

// ───────────────────────── helpers ─────────────────────────
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const num = (v?: number | null, dp = 2) => (v == null || isNaN(Number(v)) ? '' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const int = (v?: number | null) => (v == null ? '' : String(Math.round(Number(v) * 100) / 100));
const plain = (v?: number | null) => (v == null ? '' : Number(v).toFixed(2));
const ymd = (v?: string | null) => (v ? String(v).slice(0, 10).split('-') : null);
/** 2026-08-20 → 20/08/2026 */
export const dmy = (v?: string | null) => { const p = ymd(v); return p ? `${p[2]}/${p[1]}/${p[0]}` : ''; };
/** 2026-08-20 → 2026/08/20 (Arabic text) */
const ymdSlash = (v?: string | null) => { const p = ymd(v); return p ? `${p[0]}/${p[1]}/${p[2]}` : ''; };
const nl = (s?: string | null) => esc(s ?? '').replace(/\n/g, '<br>');
const upper = (s?: string | null) => (s ?? '').toUpperCase();
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const weekday = (v?: string | null) => { const p = ymd(v); return p ? new Date(+p[0], +p[1] - 1, +p[2]).getDay() : 0; };

function stamp(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = now.getHours();
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}  ${pad(h % 12 || 12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${h < 12 ? 'AM' : 'PM'}`;
}

// number → words (dirhams, whole numbers)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function en999(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? '-' + ONES[r % 10] : ''}`;
  return [h ? `${ONES[h]} Hundred` : '', rest].filter(Boolean).join(' ');
}
export function wordsEn(v: number): string {
  let n = Math.floor(Math.abs(v)); if (!n) return 'Zero';
  const parts: string[] = [];
  for (const [size, name] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']] as const) {
    if (n >= size) { parts.push(`${en999(Math.floor(n / size))} ${name}`); n %= size; }
  }
  if (n) parts.push(en999(n));
  return parts.join(' ');
}
const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function ar999(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? AR_ONES[r] : [AR_ONES[r % 10], AR_TENS[Math.floor(r / 10)]].filter(Boolean).join(' و');
  return [AR_HUNDREDS[h], rest].filter(Boolean).join(' و');
}
function arScale(n: number, one: string, two: string, few: string, many: string) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${ar999(n)} ${few}`;
  return `${ar999(n)} ${many}`;
}
export function wordsAr(v: number): string {
  let n = Math.floor(Math.abs(v)); if (!n) return 'صفر';
  const parts: string[] = [];
  if (n >= 1e6) { parts.push(arScale(Math.floor(n / 1e6), 'مليون', 'مليونان', 'ملايين', 'مليون')); n %= 1e6; }
  if (n >= 1e3) { parts.push(arScale(Math.floor(n / 1e3), 'ألف', 'ألفان', 'آلاف', 'ألف')); n %= 1e3; }
  if (n) parts.push(ar999(n));
  return parts.join(' و');
}
const ORD_EN = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth'];
const ORD_AR = ['الاول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر'];
const ORD_AR_F = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

/** Fill {placeholders} of a contract term with the contract's values. */
export function fillTerm(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_m, k) => (values[k] != null && values[k] !== '' ? values[k] : '........'));
}

const PRINT_SCRIPT = `<script>
  function go(){ setTimeout(function(){ window.focus(); window.print(); }, 300); }
  var imgs = Array.prototype.slice.call(document.images);
  Promise.all(imgs.map(function(i){ return i.complete ? 0 : new Promise(function(r){ i.onload = i.onerror = r; }); }))
    .then(function(){ return document.fonts && document.fonts.ready; }).then(go);
</script>`;

export function documentHtml(title: string, css: string, body: string, opts: { dir?: 'ltr' | 'rtl'; autoPrint?: boolean } = {}) {
  return `<!doctype html><html lang="${opts.dir === 'rtl' ? 'ar' : 'en'}" dir="${opts.dir ?? 'ltr'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${css}</style></head><body>${body}${opts.autoPrint === false ? '' : PRINT_SCRIPT}</body></html>`;
}

// ═════════════════════════════════════ GAS INVOICE ═════════════════════════════════════

export interface InvoicePrintData {
  invoice: { id: number; invoiceNo: string; issueDate: string; dueDate?: string | null; periodStart?: string | null; periodEnd?: string | null;
    subtotal: number; vat: number; total: number; type?: string; typeLabel?: string; status?: string; notes?: string | null; previousBalance: number; totalDue: number };
  customer: { code?: string; nameEn?: string | null; nameAr?: string | null; phone?: string | null; email?: string | null; trn?: string | null; address?: string | null; addressAr?: string | null };
  contractNo?: string | null;
  building: { code?: string | null; nameEn?: string | null; nameAr?: string | null; cityEn?: string | null };
  unitNo?: string | null;
  meterNo?: string | null;
  reading?: { currentDate?: string; current: number; previousDate?: string | null; previous: number; consumption: number } | null;
  items: { type?: string | null; typeLabel?: string | null; description?: string | null; quantity?: number | null; uom?: string | null; unitPrice?: number | null; vatRate?: number | null; amount: number }[];
  lastPayment?: { receiptNo: string; date: string; amount: number } | null;
  bank?: { bankName?: string | null; nameEn?: string | null; accountNo?: string | null; iban?: string | null; swiftCode?: string | null } | null;
  company?: Company | null;
}
export interface Company {
  nameEn?: string; nameAr?: string; trn?: string | null; address?: string | null; phone?: string | null; email?: string | null; website?: string | null;
  logoPath?: string | null; letterheadPath?: string | null; poBox?: string | null; fax?: string | null; customerCarePhone?: string | null;
  cashContactName?: string | null; cashContactMobile?: string | null; invoicePaymentNote?: string | null;
  signatoryNameEn?: string | null; signatoryNameAr?: string | null; signatoryTitleEn?: string | null; signatoryTitleAr?: string | null;
}

const SERVICE_TYPES = new Set(['meter_rent', 'inspection', 'insurance', 'cd_service']);

const INVOICE_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000; background: #fff;
  font-family: Cambria, Caladea, Georgia, 'Times New Roman', serif; font-size: 8.4pt; }
.sheet { position: relative; width: 210mm; height: 296.5mm; overflow: hidden; background-size: 210mm 297mm; background-repeat: no-repeat; margin: 0 auto; }
.body { position: absolute; left: 6.5mm; right: 6.5mm; top: 38.5mm; }
.t1, .t2 { text-align: center; font-family: 'Times New Roman', 'Liberation Serif', Times, serif; font-weight: bold; font-size: 12.5pt; }
.t1 { margin-bottom: 2.6mm; } .t2 { margin-bottom: 3.6mm; letter-spacing: .2px; }
b, .b { font-weight: bold; }
.ar { font-family: Arial, 'Liberation Sans', Tahoma, sans-serif; font-weight: bold; font-size: 6.5pt; direction: rtl; unicode-bidi: embed; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
.hdr td { padding: 0 1mm; height: 4.6mm; font-weight: bold; vertical-align: middle; white-space: nowrap; overflow: hidden; }
.hdr .lab { width: 26mm; } .hdr .col { width: 3mm; text-align: center; }
.hdr .lab2 { width: 21mm; } .hdr .val2 { width: 37mm; }
.box { border: 1px solid #000; }
.box td { height: 5.2mm; }
.bname { font-size: 6.6pt; }
.grid td { border: 1px solid #000; padding: 0 1mm; height: 5.05mm; font-weight: bold; vertical-align: middle; white-space: nowrap; overflow: hidden; }
.grid .lbl { display: flex; justify-content: space-between; align-items: center; gap: 1mm; }
.c { text-align: center; } .r { text-align: right; }
.grid .nob { border-top: none; border-bottom: none; }
.mop { border: 1px solid #000; border-top: none; text-align: center; font-family: Calibri, Carlito, Arial, sans-serif; font-size: 6.6pt; height: 5.2mm; line-height: 5.2mm; }
.mop b { font-family: Calibri, Carlito, Arial, sans-serif; }
.gap { border: 1px solid #000; border-top: none; height: 3.6mm; }
.bankh { border: 1px solid #000; border-top: none; height: 7mm; display: flex; justify-content: space-between; align-items: flex-end; padding: 0 1mm 1mm; font-weight: bold; }
.bank td { border: 1px solid #000; height: 5.9mm; padding: 0 1.2mm; font-weight: bold; vertical-align: middle; }
.bank td:first-child { width: 72mm; }
.note { font-family: Calibri, Carlito, Arial, sans-serif; font-weight: bold; font-size: 6.6pt; margin: .6mm 0 .4mm; }
.cash { width: 74%; border: 1px solid #000; padding: 1mm 1.4mm; }
.cash div { height: 5mm; line-height: 5mm; font-weight: bold; }
.cash i { font-style: italic; }
.paid { position: absolute; right: 20mm; top: 64mm; border: 3px solid #2e7d32; color: #2e7d32; font: bold 16pt Arial, sans-serif; padding: 1mm 4mm; transform: rotate(-10deg); opacity: .8; }
`;

export function invoiceHtml(d: InvoicePrintData, a: PrintAssets, now = new Date()) {
  const co = d.company ?? {};
  const inv = d.invoice;
  const cust = d.customer;
  const sum = (pred: (t?: string | null) => boolean) => d.items.filter(x => pred(x.type)).reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const gas = d.items.filter(x => x.type === 'gas_price');
  const gasQty = gas.reduce((s, x) => s + Number(x.quantity ?? 0), 0);
  const gasRate = gas.length ? Number(gas[gas.length - 1].unitPrice ?? 0) : null;
  const gasAmt = sum(t => t === 'gas_price');
  const svc = d.items.filter(x => SERVICE_TYPES.has(x.type ?? '') || (x.type === 'other' && /service|خدمة/i.test(x.description ?? '')));
  const svcAmt = svc.reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const svcRate = svc.length === 1 ? svc[0].unitPrice : null;
  const mntAmt = sum(t => t === 'maintenance');
  const otherAmt = Number(inv.subtotal ?? 0) - gasAmt - svcAmt - mntAmt;
  const vatRate = d.items.find(x => Number(x.vatRate) > 0)?.vatRate ?? (inv.subtotal ? Math.round((inv.vat / inv.subtotal) * 100) : 5);
  const r = d.reading;
  const consumption = r ? r.consumption : gasQty || null;
  const due = !inv.dueDate || inv.dueDate === inv.issueDate ? 'Immediate' : dmy(inv.dueDate);
  const period = inv.periodStart ? `${dmy(inv.periodStart)}&nbsp; - &nbsp;${dmy(inv.periodEnd)}` : r ? `${dmy(r.previousDate)}&nbsp; - &nbsp;${dmy(r.currentDate)}` : '';
  const name = upper(cust.nameEn || cust.nameAr);
  const bName = [d.building.nameEn || d.building.nameAr].filter(Boolean).join(' ');
  const L = (en: string, ar: string) => `<div class="lbl"><span>${en}</span><span class="ar">${ar}</span></div>`;
  const care = co.customerCarePhone || co.phone;
  const bank = d.bank;
  const lp = d.lastPayment;

  const body = `
<div class="sheet" style="background-image:url('${a.letterhead}')">
 <div class="body">
  <div class="t1">Tax Invoice</div>
  <div class="t2">TRN : ${esc(co.trn ?? '')}</div>

  <table class="hdr"><colgroup><col class="lab"><col class="col"><col><col class="lab2"><col class="col"><col class="val2"></colgroup>
   <tr><td>Customer Name</td><td class="col">:</td><td>${esc(name)}</td><td>Invoice No.</td><td class="col">:</td><td>${esc(inv.invoiceNo)}</td></tr>
  </table>
  <table class="hdr box"><colgroup><col class="lab"><col class="col"><col><col class="lab2"><col class="col"><col class="val2"></colgroup>
   <tr><td>Contract No.</td><td class="col">:</td><td>${esc(d.contractNo ?? '')}</td><td>Invoice Date</td><td class="col">:</td><td>${dmy(inv.issueDate)}</td></tr>
   <tr><td>Address</td><td class="col">:</td><td>${esc(cust.address ?? '')}</td><td>Building No.</td><td class="col">:</td><td>${esc(d.building.code ?? '')}</td></tr>
   <tr><td>Email ID</td><td class="col">:</td><td>${esc(cust.email ?? '')}</td><td colspan="3" class="bname">${esc(upper(bName))}</td></tr>
   <tr><td>Mobile No.</td><td class="col">:</td><td>${esc(cust.phone ?? '')}</td><td>Flat No.</td><td class="col">:</td><td>${esc(d.unitNo ?? '')}</td></tr>
   <tr><td>TRN No.</td><td class="col">:</td><td>${esc(cust.trn ?? '')}</td><td>Due Date</td><td class="col">:</td><td>${due}</td></tr>
   <tr><td></td><td></td><td></td><td>Gas Meter No.</td><td class="col">:</td><td>${esc(d.meterNo ?? '')}</td></tr>
  </table>

  <table class="grid"><colgroup><col style="width:27.5%"><col style="width:21.5%"><col style="width:18.5%"><col style="width:16.5%"><col style="width:16%"></colgroup>
   <tr><td>${L('Billing Period', 'الفترة')}</td><td colspan="2" style="border-right:none">${period}</td><td colspan="2" style="border-left:none;border-bottom:none"></td></tr>
   <tr><td>${L('Current Reading', 'القراءة الحالية')}</td><td class="c">${r ? dmy(r.currentDate) : ''}</td><td class="c">${r ? plain(r.current) : ''}</td><td colspan="2" class="c">Last Payment Received</td></tr>
   <tr><td>${L('Previous Reading', 'القراءة السابقة')}</td><td class="c">${r ? dmy(r.previousDate) : ''}</td><td class="c">${r ? plain(r.previous) : ''}</td><td colspan="2" class="c">${lp ? plain(lp.amount) : ''}</td></tr>
   <tr><td>${L('Consumption', 'الاستهلاك')}</td><td></td><td class="c">${consumption != null ? plain(consumption) : ''}</td><td colspan="2" class="c">Receipt Number</td></tr>
   <tr><td style="border-right:none">Correct Meter Reading</td><td class="c ar" style="border-left:none;font-size:7pt">قراءة عداد الغاز الفعلية</td><td class="c">${r ? plain(r.current - r.previous) : ''}</td><td colspan="2" class="c">${esc(lp?.receiptNo ?? '')}</td></tr>
   <tr><td style="border-right:none"></td><td class="c" style="border-left:none;border-right:none">Unit Consumed&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Unit Rate</td><td style="border-left:none"></td>
     <td colspan="2"><span>Date Received :</span><span style="float:right;margin-right:6mm">${lp ? dmy(lp.date) : ''}</span></td></tr>
   <tr><td>${L('Consumption charge', 'رسوم استهلاك الغاز')}</td><td class="c">${consumption != null ? `${plain(consumption)}&nbsp;&nbsp;&nbsp;&nbsp;@&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${gasRate != null ? plain(gasRate) : ''}` : ''}</td><td class="c">${plain(gasAmt)}</td><td>Current Reading Dt.</td><td class="c">${r ? dmy(r.currentDate) : ''}</td></tr>
   <tr><td>${L('Service Charges', 'مصاريف الخدمة')}</td><td class="c">${svcRate != null ? plain(svcRate) : ''}</td><td class="c">${plain(svcAmt)}</td><td>Previous Reading Dt</td><td class="c">${r ? dmy(r.previousDate) : ''}</td></tr>
   <tr><td>${L('Maintenance Charges', 'رسوم الصيانة')}</td><td></td><td class="c">${plain(mntAmt)}</td><td class="r">Amount Due</td><td class="r">${num(inv.totalDue)}</td></tr>
   <tr><td>${L('Others Charges', 'رسوم أخرى')}</td><td></td><td class="c">${plain(Math.abs(otherAmt) < 0.005 ? 0 : otherAmt)}</td><td class="r">Due Date</td><td class="c">${due}</td></tr>
   <tr><td>${L('Total Amount', 'المبلغ الإجمالي')}</td><td></td><td class="c">${plain(inv.subtotal)}</td><td colspan="2" style="border-bottom:none"></td></tr>
   <tr><td>${L('Vat', 'ضريبة القيمة المضافة')}</td><td class="c">${num(vatRate, 0)}%</td><td class="c">${plain(inv.vat)}</td><td colspan="2" class="c nob">For Enquires</td></tr>
   <tr><td>${L('Total Invocie Amount', 'المبلغ الإجمالي للفاتورة')}</td><td></td><td class="c">${plain(inv.total)}</td><td colspan="2" class="c nob">Customer Care Helpline</td></tr>
   <tr><td>${L('Previous', 'الرصيد السابق')}</td><td></td><td class="c">${plain(inv.previousBalance)}</td><td colspan="2" class="c nob">${care ? `Contact us : ${esc(care)}` : ''}</td></tr>
   <tr><td>${L('Total Amount Due', 'إجمالي المبلغ المستحق')}</td><td></td><td class="c">AED ${num(inv.totalDue)}</td><td colspan="2" class="c" style="border-top:none">${co.email ? `E-mail : ${esc(co.email)}` : ''}</td></tr>
  </table>
  <div class="mop">${co.invoicePaymentNote ? `<b>Mode of Payment:</b> ${esc(co.invoicePaymentNote)}` : ''}</div>
  <div class="gap"></div>
  ${bank ? `
  <div class="bankh"><span>Payment By Bank Transfer :-</span><span class="ar">للدفع بواسطة تحويل بنكى</span></div>
  <table class="bank">
   <tr><td>Bank Name</td><td>${esc(upper(bank.bankName))}</td></tr>
   <tr><td>Name of Benificiary</td><td>${esc(upper(co.nameEn || bank.nameEn))}</td></tr>
   <tr><td>Account number</td><td>${esc(bank.accountNo ?? '')}</td></tr>
   <tr><td>IBAN No.</td><td>${esc(bank.iban ?? '')}</td></tr>
   <tr><td>Swift Code</td><td>${esc(bank.swiftCode ?? '')}</td></tr>
  </table>
  <div class="note">Note: Please e-mail us your Contract Number &amp; Payment Details</div>` : ''}
  ${co.cashContactName || co.cashContactMobile ? `
  <div class="cash">
   <div>For paying your invoice by <i>Cash</i> please Contact :</div>
   <div>Name :&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${esc(co.cashContactName ?? '')}</div>
   <div>Mobile:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${esc(co.cashContactMobile ?? '')}</div>
  </div>` : ''}
 </div>
 ${inv.status === 'paid' ? '<div class="paid">PAID</div>' : ''}
 ${inv.status === 'cancelled' ? '<div class="paid" style="border-color:#c62828;color:#c62828">CANCELLED</div>' : ''}
</div>`;
  void now;
  return documentHtml(`Invoice ${inv.invoiceNo}`, INVOICE_CSS, body);
}

// ═════════════════════════════════════ GAS SUPPLY CONTRACT ═════════════════════════════════════

export interface TermRow { category?: string; ar: string; en?: string | null; custom?: boolean }
export interface SupplyContractPrintData {
  contract: { id: number; contractNo: string; startDate: string; endDate?: string | null; deposit: number; notes?: string | null; createdAt?: string;
    openingReading?: number | null; openingDate?: string | null; status?: string };
  tenant: { code?: string; nameEn?: string | null; nameAr?: string | null; phone?: string | null; email?: string | null; poBox?: string | null;
    cityEn?: string | null; cityAr?: string | null; contacts?: { type?: string | null; value: string }[] };
  building: { code?: string | null; nameEn?: string | null; nameAr?: string | null; cityEn?: string | null };
  unitNo?: string | null; floor?: number | null; meterNo?: string | null;
  fees: { type?: string | null; typeLabel?: string | null; cycle?: string | null; amount: number }[];
  terms: TermRow[];
  company?: Company | null;
}

const CONTRACT_CSS = `
@page { size: A4; margin: 6mm 7mm 12mm 7mm;
  @bottom-left { content: var(--gen); font: italic 6pt Calibri, Carlito, Arial, sans-serif; color: #000; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: italic 6.5pt Calibri, Carlito, Arial, sans-serif; color: #888; } }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000; background: #fff;
  font-family: 'Times New Roman', 'Liberation Serif', Times, serif; font-size: 8.4pt; }
.page { width: 196mm; margin: 0 auto; }
.break { break-before: page; page-break-before: always; }
.ar { font-family: Arial, Tahoma, sans-serif; direction: rtl; unicode-bidi: embed; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
td { vertical-align: middle; }
.outer { border: 2px solid #000; }
.head td { border-right: 1px solid #000; height: 26.5mm; }
.head td:last-child { border-right: none; }
.head .logo { width: 18mm; text-align: center; }
.head .logo img { width: 23.5mm; height: auto; }
.head .title { text-align: center; }
.head .title .a { font: 15pt Arial, 'Liberation Sans', sans-serif; margin-bottom: 3mm; direction: rtl; }
.head .title .e { font: bold 15pt Cambria, Caladea, Georgia, serif; }
.cno td { border-top: 1px solid #000; height: 6.6mm; }
.cno .v { border: 1px solid #555; background: #ececec; text-align: center; font-weight: bold; font-family: Cambria, Caladea, Georgia, serif; height: 5.3mm; }
.sys { border: 2px solid #000; border-top: none; margin-bottom: 2mm; }
.sys td { border-right: 1px solid #000; height: 6.8mm; padding: 0 1.5mm; }
.sys td:last-child { border-right: none; }
.party { display: flex; justify-content: space-between; align-items: center; padding: 0 3mm; margin: 1.2mm 0 1.6mm; }
.partyb { font-weight: bold; }
.blk { border: 2px solid #000; }
.blk td { border-top: 1px solid #000; height: 5.6mm; padding: 0 2mm; }
.blk tr:first-child td { border-top: none; }
.blk .k { width: 25mm; } .blk .c { width: 4mm; } .blk .ak { width: 26mm; text-align: right; }
.cv { text-align: center; font-weight: bold; }
.blk2 td { height: 6.1mm; }
.agree { display: flex; justify-content: space-between; font-weight: bold; margin: 2.4mm 0 1.6mm; padding: 0 1mm; font-family: Cambria, Caladea, Georgia, serif; }
.cl { display: grid; grid-template-columns: 7mm 1fr 1fr 6mm; column-gap: 2mm; margin: 0 0 1.4mm; font-size: 7.6pt; font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; line-height: 1.35; }
.cl .n { text-align: center; } .cl .ar { text-align: right; font-size: 7.4pt; }
.fees { border: 2px solid #000; }
.fees td { border: 1px solid #000; height: 7.4mm; padding: 0 3mm; }
.fees .c { text-align: center; }
.fees .a { text-align: right; }
.fwd { display: flex; justify-content: space-between; margin: 3mm 0 2mm; padding: 0 3mm; }
.ifees td { height: 6.8mm; }
.ifees .a { font-size: 10.5pt; }
.small { font-size: 7.6pt; }
.see { display: flex; justify-content: space-between; margin: .6mm 0 2mm; padding: 0 2mm; }
.conf { display: flex; justify-content: space-between; gap: 6mm; font-weight: bold; font-family: Cambria, Caladea, Georgia, serif; padding: 0 2mm; }
.conf div:last-child { text-align: right; font-family: Arial, sans-serif; direction: rtl; font-size: 7.6pt; }
.signs { display: flex; justify-content: space-between; padding: 0 2mm; font-family: Cambria, Caladea, Georgia, serif; }
.signs > div:last-child { text-align: right; }
.signs .row { height: 5.6mm; line-height: 5.6mm; }
.call { margin: 7mm 0 0 1mm; font-size: 7.6pt; font-family: Calibri, Carlito, Arial, sans-serif; }
.tt { text-align: center; font: bold 8.4pt Cambria, Caladea, Georgia, serif; margin: 2mm 0 5mm; }
.term { display: grid; grid-template-columns: 9mm 96mm 1fr 9mm; column-gap: 0; margin-bottom: 4.6mm; break-inside: avoid; page-break-inside: avoid;
  font: 7.7pt/1.36 Calibri, Carlito, 'Segoe UI', Arial, sans-serif; }
.term .n { text-align: center; font-family: 'Times New Roman', serif; font-size: 8pt; }
.term .en { text-align: justify; padding-right: 8mm; }
.term .ar { text-align: right; font-size: 7.6pt; line-height: 1.5; }
.sg { display: flex; justify-content: space-between; font: 7.4pt Cambria, Caladea, Georgia, serif; padding: 0 4mm 0 11mm; margin-top: 2mm; }
.sg .l .row { height: 8mm; font-weight: bold; } .sg .l .row:first-child { font-weight: normal; }
.sg .r { text-align: right; font: 8.4pt Arial, sans-serif; direction: rtl; width: 75mm; }
.sg .r .row { height: 8mm; }
.dash { display: inline-block; width: 46mm; border-bottom: 1px dashed #000; margin: 0 2mm; }
`;

export function supplyContractHtml(d: SupplyContractPrintData, a: PrintAssets, now = new Date()) {
  const co = d.company ?? {};
  const c = d.contract;
  const t = d.tenant;
  const fee = (pred: (f: SupplyContractPrintData['fees'][number]) => boolean) => d.fees.filter(pred).reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const gasPrice = d.fees.filter(f => f.type === 'gas_price').map(f => Number(f.amount)).pop() ?? 0;
  const registration = fee(f => f.type === 'connection');
  const disconnection = fee(f => f.type === 'disconnection');
  const maintenance = fee(f => f.type === 'maintenance' && f.cycle === 'monthly');
  const service = fee(f => f.cycle === 'monthly' && f.type !== 'maintenance' && f.type !== 'gas_price' && f.type !== 'gov_fees');
  const admin = fee(f => f.type === 'gov_fees' || (f.type === 'other' && f.cycle !== 'monthly') || f.type === 'cd_service');
  const mobiles = [t.phone, ...(t.contacts ?? []).filter(x => x.type === 'mobile').map(x => x.value)].filter((v, i, arr) => v && arr.indexOf(v) === i) as string[];
  const tels = (t.contacts ?? []).filter(x => x.type === 'phone').map(x => x.value);
  const values: Record<string, string> = {
    advance_total: plain(registration + Number(c.deposit ?? 0) + disconnection), connection_fee: plain(registration), deposit: plain(c.deposit),
    disconnection_fee: disconnection ? plain(disconnection) : '', gas_price: plain(gasPrice), service_fee: plain(service), billing_months: '',
  };
  const terms = d.terms.length ? d.terms : [];
  const first = terms[0];
  const name = upper(t.nameEn || t.nameAr);
  const cname = upper(co.nameEn || co.nameAr);
  const bLine = [d.building.code, d.building.nameEn || d.building.nameAr].filter(Boolean).join(' (') + (d.building.code && (d.building.nameEn || d.building.nameAr) ? ')' : '');
  const gen = `"Generated from Sedra ERP, on : ${stamp(now)}"`;
  const row = (k: string, v: string, ak: string, center = true) => `<tr><td class="k">${k}</td><td class="c">:</td><td class="${center ? 'cv' : ''}" colspan="3">${v}</td><td class="c">:</td><td class="ak ar">${ak}</td></tr>`;
  const coRow = (k: string, v: string, ak: string) => `<tr><td class="k">${k}</td><td class="c">:</td><td class="cv" colspan="3">${v}</td><td class="c">:</td><td class="ak ar">${ak}</td></tr>`;

  const page1 = `
<div class="page">
 <div class="outer">
  <table class="head"><tr>
   <td class="logo" style="width:30mm"><img src="${a.logo}" alt=""></td>
   <td class="title"><div class="a">عقد تزويد الغاز</div><div class="e">Gas Supply Contract</div></td>
   <td style="width:30mm"></td></tr></table>
  <table class="cno"><colgroup><col style="width:62mm"><col style="width:62mm"><col></colgroup><tr>
   <td style="text-align:right;padding-right:12mm">Contract No:</td><td style="padding:0 0"><div class="v">${esc(c.contractNo)}</div></td><td class="ar" style="text-align:left;padding-left:22mm">رقم العقد :</td></tr></table>
 </div>
 <table class="sys"><colgroup><col style="width:17mm"><col style="width:36mm"><col style="width:18mm"><col style="width:28mm"><col style="width:25mm"><col><col style="width:22mm"></colgroup><tr>
  <td>System No</td><td>${c.id}</td><td>Date&nbsp; :</td><td style="text-align:center">${dmy(c.startDate)}</td><td class="ar" style="text-align:center">التاريخ</td><td style="text-align:right">${c.id}</td><td class="ar" style="text-align:right">رقم النظام</td></tr></table>

 <div class="party"><span>First Party: "The Gas Provider"</span><span class="ar">"الطرف الأول "مورد الغاز</span></div>
 <table class="blk"><colgroup><col class="k"><col class="c"><col><col><col><col class="c"><col class="ak"></colgroup>
  <tr><td colspan="5" style="font-weight:bold;font-family:Cambria,Georgia,serif">M/S&nbsp; ${esc(cname)}</td><td></td><td class="ak ar" style="font-weight:bold">السادة</td></tr>
  <tr><td class="k">P.O.Box</td><td class="c">:</td><td>${esc(co.poBox ?? '')}</td><td></td><td style="text-align:right">${esc(co.poBox ?? '')}</td><td class="c">:</td><td class="ak ar">صندوق البريد</td></tr>
  ${coRow('Tel', esc(co.phone ?? ''), 'تليفون')}
  ${coRow('Fax', esc(co.fax ?? ''), 'فاكس')}
  ${coRow('E-Mail', esc(co.email ?? ''), 'بريد الكتروني')}
 </table>

 <div class="party partyb"><span>Second Party: " The Customer"</span><span class="ar">"الطرف الثاني " الزبون</span></div>
 <table class="blk blk2"><colgroup><col class="k"><col class="c"><col><col><col><col class="c"><col class="ak"></colgroup>
  ${row('Mr./Mrs.', esc(name), 'السيد / السيده')}
  ${row('Service Type', 'Central Gas', 'نوع الخدمة')}
  ${row('Building Name', esc(upper(bLine)), 'اسم البنايه')}
  ${row('Flat No.', esc(d.unitNo ?? ''), 'رقم الشقه')}
  <tr><td class="k">Tel 1</td><td class="c">:</td><td style="text-align:center">${esc(tels[0] ?? '')}</td><td><span class="ar">تليفون 1</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tel 2&nbsp;&nbsp;:</td><td style="text-align:center">${esc(tels[1] ?? '')}</td><td class="c">:</td><td class="ak ar">تليفون 2</td></tr>
  <tr><td class="k">Mobile 1 :</td><td class="c">:</td><td style="text-align:center">${esc(mobiles[0] ?? '')}</td><td><span class="ar">جوال1</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Mobile 2&nbsp;&nbsp;:</td><td style="text-align:center">${esc(mobiles[1] ?? '')}</td><td class="c">:</td><td class="ak ar">جوال2</td></tr>
  ${row('P.O.Box/ Emirates', esc([t.poBox, t.cityEn].filter(Boolean).join(' / ')), 'صندوق البريد', false)}
  ${row('E-Mail', esc(t.email ?? ''), 'البريد الالكتروني', false)}
 </table>

 <div class="agree"><span>The two parties have agreed on the following terms and conditions:</span><span class="ar" style="font-size:7.4pt">اتفق الطرفان على الشروط و الأحكام التاليه</span></div>
 <div class="cl"><div class="n">1</div><div>${nl(first?.en ?? 'The first party undertakes to supply continuously the second party with gas flow and to provide service upon request.')}</div>
   <div class="ar">${nl(first?.ar ?? 'يتعهد الطرف الأول بتزويد الغاز الى الطرف الثاني دون انقطاع و توفير الخدمة عند الطلب')}</div><div class="n">1</div></div>
 <div class="cl"><div class="n">2</div><div>The second party shall pay an Advance against the supply of his flat with gas detailed as follows:</div>
   <div class="ar">يتعهد الطرف الثاني بدفع مقدم مقابل تزويد شقته بالغاز مقسم على النحو التالي</div><div class="n">2</div></div>

 <table class="fees"><colgroup><col style="width:58mm"><col><col style="width:62mm"></colgroup>
  <tr><td>Registration Fee</td><td class="c">${plain(registration)}</td><td class="a ar">رسوم التسجيل</td></tr>
  <tr><td>Deposit Refundable</td><td class="c">${plain(c.deposit)}</td><td class="a ar">تأمين الغاز مسترد</td></tr>
 </table>

 <div class="fwd"><span>The first party forwards the gas consumption invoice as detailed below:</span><span class="ar">يقدم الطرف الاول فاتوره استهلاك الغاز على حسب الرسوم الموضحه ادناه</span></div>
 <table class="fees ifees"><colgroup><col style="width:58mm"><col><col style="width:62mm"></colgroup>
  <tr><td class="small">Period: One Invoice Each :</td><td class="c small">Monthly / Quarterly</td><td class="a ar">المده:&nbsp; كل فاتوره</td></tr>
  <tr><td class="small">Monthly Service Charges&nbsp; :</td><td class="c">${plain(service)}</td><td class="a ar">رسوم الخدمه الشهريه</td></tr>
  <tr><td class="small">Gas Price :</td><td class="c">${plain(gasPrice)}</td><td class="a ar">سعر الغاز بالمتر المكعب</td></tr>
  <tr><td class="small">Maintenance Charges :</td><td class="c">${plain(maintenance)}</td><td class="a ar">مصاريف صيانة</td></tr>
  <tr><td class="small">Administration Charges :</td><td class="c">${plain(admin)}</td><td class="a ar">رسوم&nbsp; إدارية</td></tr>
 </table>
 <div class="see"><span>*(See Clause 13)</span><span class="ar" style="font-size:9.5pt">انظر بند 13</span></div>

 <div class="conf"><div>The Second Party confirms that he reads, understands and<br>abides by all terms &amp; conditions of this contract mentioned above</div>
  <div>يؤكد الطرف الثاني انه قد اطلع على الشروط و الاحكام المدونة اعلاه و على باقي شروط العقد<br>من الجهه الخلفيه من هذا العقد و فهم مضمونها و ملزم بها .</div></div>
 <div class="signs" style="margin-top:2mm"><div class="row" style="font-weight:bold">For First Party / <span class="ar">عن الطرف الاول</span></div><div class="row" style="font-weight:bold"><span class="ar">عن الطرف الثاني/</span> For second Party</div></div>
 <div class="signs" style="margin-top:3mm"><div><div class="row" style="font-weight:bold">${esc(cname)}</div><div class="row">Name / <span class="ar">الاسم</span></div></div>
   <div><div class="row" style="font-weight:bold">${esc(name)}</div><div class="row"><span class="ar">الاسم</span> / Name</div></div></div>
 <div class="signs" style="margin-top:2mm"><div class="row"><b>Signature</b> / <span class="ar">التوقيع</span></div><div class="row"><b><span class="ar">التوقيع</span> / Signature</b></div></div>
 <div class="call">Call Centre ${esc(co.nameEn ? co.nameEn.split(' ').slice(0, 2).join(' ') : '')} : ${esc(co.customerCarePhone || co.phone || '')}</div>
</div>`;

  const page2 = `
<div class="page break">
 <div class="tt">Terms &amp; Conditions</div>
 ${terms.map((x, i) => `<div class="term"><div class="n">${i + 1}</div><div class="en">${nl(fillTerm(x.en ?? '', values))}</div>
   <div class="ar">${nl(fillTerm(x.ar, values))}</div><div class="n">${i + 1}</div></div>`).join('')}
 ${c.notes ? `<div class="term"><div class="n"></div><div class="en"><b>Remarks:</b> ${nl(c.notes)}</div><div class="ar"></div><div class="n"></div></div>` : ''}
</div>`;

  const page3 = `
<div class="page break">
 <div class="sg"><div class="l">
   <div class="row">For First Party :</div>
   <div class="row" style="margin-top:6mm">Name: <span class="dash"></span></div>
   <div class="row">Signature: <span class="dash"></span></div>
   <div class="row" style="margin-top:2mm">For the second Party :</div>
   <div class="row">Name: <span class="dash"></span></div>
   <div class="row">Signature : <span class="dash"></span></div></div>
  <div class="r">
   <div class="row">للطرف الأول:</div>
   <div class="row">اسم: <span class="dash"></span></div>
   <div class="row">إمضاء: <span class="dash"></span></div>
   <div class="row">للطرف الثاني:</div>
   <div class="row">اسم: <span class="dash"></span></div>
   <div class="row">إمضاء: <span class="dash"></span></div></div></div>
</div>`;
  return documentHtml(`Gas Supply Contract ${c.contractNo}`, CONTRACT_CSS.replace('var(--gen)', gen), page1 + page2 + page3);
}

// ═════════════════════════════════════ ANNUAL MAINTENANCE CONTRACT ═════════════════════════════════════

export interface AmcPrintData {
  contract: { id: number; contractNo: string; startDate: string; endDate: string; autoRenew?: boolean; annualValue: number; visitFrequency?: string | null;
    visitFrequencyLabel?: string | null; visitsTotal?: number | null; responseTimeHours?: number | null; emergencyIncluded?: boolean; notes?: string | null };
  owner: { nameEn?: string | null; nameAr?: string | null; phone?: string | null; email?: string | null; poBox?: string | null; cityEn?: string | null; cityAr?: string | null;
    contacts?: { type?: string | null; value: string }[] };
  provider: { nameEn?: string | null; nameAr?: string | null; phone?: string | null; email?: string | null };
  building: { code?: string | null; nameEn?: string | null; nameAr?: string | null; street?: string | null; zone?: string | null; cityEn?: string | null; cityAr?: string | null };
  scope: string[];
  excluded: string[];
  schedule: { label?: string | null; dueDate: string; amount: number }[];
  terms: TermRow[];
  company?: Company | null;
}

const AMC_CSS = `
@page { size: A4; margin: 14mm 13mm 16mm 13mm; @bottom-center { content: counter(page); font: 9pt Calibri, Carlito, Arial, sans-serif; } }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #000; background: #fff; font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 10pt; line-height: 1.32; }
.logo { text-align: center; margin-bottom: 3mm; } .logo img { width: 30mm; }
.row { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12mm; break-inside: avoid; page-break-inside: avoid; margin-bottom: 4.5mm; }
.en { direction: ltr; text-align: left; }
.ar { direction: rtl; text-align: right; font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; }
.title { font-size: 13pt; font-weight: bold; color: #4F6228; text-decoration: underline; }
.h { font-weight: bold; text-decoration: underline; display: block; }
.b { font-weight: bold; }
.red { color: #FF0000; font-weight: bold; text-decoration: underline; }
.g { color: #4F6228; font-weight: bold; }
.gl { color: #4F6228; }
.big { font-size: 11.5pt; }
.link { color: #0000FF; text-decoration: underline; font-family: 'Times New Roman', serif; font-size: 10.5pt; }
ul.dash { list-style: none; margin: 0; padding: 0; } ul.dash li::before { content: "-"; }
.ind { padding-inline-start: 4mm; } .ind2 { padding-inline-start: 9mm; }
.just { text-align: justify; }
.sign .g { font-size: 11pt; }
`;

const AMC_STATIC = {
  preambleEn: 'Whereas The Second Party As An Establishment Operating In The Field Of Gas Field Works With Extensive Expertise And Potentials And As The Concerned Party Carrying Out The Works Required For Central Gas System In This Building And Whereas The Civil Defense Requisites Stipulate The Responsibility Of The Executing Party And In Its Capacity As The Authority Duly Licensed By The Competent Depts. Both The Parties Herein Have Affected an Agreement Upon the Following Terms and Condition:',
  preambleAr: 'حيث ان الطرف الثانى مؤسسة ذات خبرة وامكانيات فى مجال اعمال الغاز وهى الجهة المنفذه اصلا لنظام الغاز المركزى فى هذا المجال وحيث اشتراطات الدفاع المدنى تنص على ان مسئولية الجهة المنفذه وهى جهة مرخصة لها حسب القانون من قبل الجهات المعنية فقد تلاقت ارادة الطرفين على ابرام هذا العقد وذلك بالشروط التالية:',
  art1En: 'The foregoing preamble shall be deemed as an article of this agreement and one of its terms and shall be read along with it.',
  art1Ar: 'يعتبر هذا التمهيد بندا من بنود هذا العقد وشرطا من شروطه ويقرأ معه.',
  art3En: `<span class="b">1-Maintenance works:</span><br>It is to say to carry out periodical testing operations for central gas system in a regular manner<br>
<span class="b">A</span>-The Second party hereby undertakes to carry out the maintenance in compliance with technical basics.<br>
<span class="b">B</span>-The Second party also undertakes to put his clear address as well as his telephone No .in the entrance of building.<br>
<span class="b">C</span>-All maintenance works shall be carried out by competent technicians brought by the second party and in case of interference by any other party, the second party shall not be responsible of damages whatsoever.<br>
<span class="b">D</span>-It is mutually agreed that the second party shall not beheld responsible of any loss or damages or delay occurring due to any reason being out of his control for instance (Government actions-strikes-fire-sit-in, destruction, riot-explosions action of God)`,
  art3Ar: `<span class="b">1-&nbsp;&nbsp; اعمال الصيانة:</span><br>القيام بصورة منتظمة بعمليات فحص دورية لنظام الغاز المركزى.<br>
<span class="b">أ</span>-يتعهد الطرف الثانى&nbsp; بالقيام بالصيانة حسب الاصول الفنية.<br>
<span class="b">ب</span>-يتعهد الطرف الثانى بترك عنوانه الواضح ورقم تلفونه على مدخل البناية<br>
<span class="b">ج</span>-تتم جميع اعمال الصيانة بواسطة الفنيين المختصين من قبل الطرف الثانى وان الطرف الثانى&nbsp; غير مسئول عن اى اضرار مهما كانت فى حالة تدخل اى جهة اخرى.<br>
<span class="b">د</span>-من المتفق عليه ان الطرف الثانى غير مسئول عن اى خسائر او اضرار او تأخير نتيجة اى سبب خارج سيطرته مثال ذلك (الاجراءات الحكومية-الاضرابات-الحرائق-الاعتصام-التخريب-اعمال الشغب-حوادث التفجير-القضاء والقدر)`,
  art4En: `Regular checking:<br>(regular check/half year /yearly)<br>A-half yearly checking scop of work:
<div class="ind">1-Storage Tank&amp; All Accessories<br>2-Main Distribution Panel &amp; Main Distribution Line<br>3-LEAK CHECKING
<div class="ind">- Line between tank and main distribution panel<br>-Filling Point<br>-Filling Line<br>-Main filling line</div>
4-Cooling System For Storage Tank<br><span class="b">5-Gas Leak Detection System:</span>
<div class="ind">-Batteries<br>-Panel Signal<br>-Detectors<br>-Solenoid For D.P<br>-Solenoid For Cooling System<br>-Central Gas System Inspection &amp; Testing Report.</div>
-6- Report for checking , testing of LPG</div>
<span style="text-decoration:underline">B-YEARLY SCOPE OF WORK</span>
<div class="ind">1-Storage Tank &amp; Accessories<br>2-Distribution Panel&amp; Main Distribution Line<br>3- leak checking:
<div class="ind">-Filling line between tank and distribution panel<br>-Filling Line<br>-filling point<br>-main filling line</div>
4 -Cooling System For Storage Tank<br>5-GAS LEAK DETECTOR SYSTEM:
<div class="ind">-Batteries -Panel Signals -Detectors adjustment<br>-Solenoid For D.P.<br>-Solenoid For Sprinkler</div></div>`,
  art4Ar: `الاختبارات الدورية:<br>(الاختبار الدورى&nbsp; النصف سنوى/الاختبار الدورى السنوى)<br>أ-اطار العمل للفحص&nbsp; النصف&nbsp; سنوى:
<div class="ind">1- فحص الخزان والتجهيزات<br>2-لوحة التوزيع الرئيسية وخطوط التوزيع الرئيسية<br>3-فحوصات التسرب
<div class="ind">-خط التوصيل بين الخزان ولوحة التوزيع<br>-نقطة التعبئة<br>-خط التعبئة<br>-خطوط التوزيع الرئيسية</div>
4-نظام التبريد على الخزان<br><span class="b">5-اللوحة الالكترونية لمراقبة التشغيل وتسرب الغاز:</span>
<div class="ind">فحص البطاريات<br>فحص إشارات اللوحة<br>فحص الكواشف<br>فحص الصمام الكهرومغناطيسى للوحة توزيع الغاز الرئيسية<br>فحص الصمام الكهرومغناطيسى للمرشات المائية</div>
<span class="b">6</span>-يرفع تقرير فحص وتشيك لنظام الغاز المركزى للطرف الاول</div>
<span style="text-decoration:underline">ب/اطار العمل للفحص&nbsp; السنوى:</span>
<div class="ind">1-فحص الخزان والتجهيزات<br>2-لوحة التوزيع الرئيسية وخطوط التوزيع الرئيسية<br>3-فحص التسرب
<div class="ind">-خط التوصيل بين الخزان ولوحة التوزيع<br>-نقطة التعبئة<br>-خط التعبئة<br>-خطوط التوزيع الرئيسية</div>
<span class="b">4</span>-نظام التبريد على الخزان<br>5-اللوحة الالكترونية لمراقبة التشغيل وتسرب الغاز:
<div class="ind">-فحص البطاريات<br>-فحص لمبات اللوحة<br>فحص ومعايرة الكواشف<br>-فحص الصمام الكهرومغناطيسى للوحة توزيع الغاز الرئيسية<br>-فحص الصمام الكهرومغناطيسى للمرشات المائية</div></div>`,
  cylEn: `It is well known that the usage of ordinary gas cylinder in the buildings where the central gas system used is forbidden as per Civil Defense directives vide circular No.5/33/2519 on 15/3/95 issued for preservation on occupant or third party's properties because the normal cylinder always cause breaking the marbles fixed on building entrances, glass, elevators and kitchen floors, so the watchman of the building shall be informed of barring the entrance of the normal gas cylinder`,
  cylAr: `من المتعارف عليه ممنوع استخدام اسطوانات الغاز العادية فى المبانى ذات نظام الغاز المركزى وذلك حسب تعليمات الدفاع المدنى بموجب التعميم رقم 2519/33/5 بتاريخ: 95/3/15 حفاظا على الساكن وممتلكات الاخرين حيث ان الاسطوانات العادية كثيرا ما تتسبب فى كسر رخام البنايات والزجاج والمصاعد وارضيات المطابخ لهذا يتطلب التنبيه على حارس البناية منع دخول اسطوانات الغاز العادية.`,
  art8En: `The first party undertakes to provides all the required documents to the second party for this purpose to document this contract with the relevant local civil defense<br>-Fees of Third-Party inspection will be on the Second Party.`,
  art8Ar: `-يتعهد الطرف الأول بتوفير كافة الوثائق المطلوبة إلى الطرف الثاني لهذا الغرض لتوثيق هذا العقد لدى الدوائر المحلية المعنية الدفاع المدني<br>- تكاليف تفتيش بيت الخبرة (الطرف الثالث) ستكون على الطرف الثاني`,
  art9En: `The first party obligated, not to allow any tenant to vacate his apartment before presenting evidence of his clearance from the second party.`,
  art9Ar: `يلتزم الطرف الاول بعدم السماح لاي مستاجر باخلاء شقته قبل ابراز مايفيد ابراء ذمته من قبل الطرف الثاني`,
};

const yearsEn = ['', 'one year', 'two years', 'three years', 'four years', 'five years'];
const yearsAr = ['', 'سنة واحدة', 'سنتان', 'ثلاث سنوات', 'أربع سنوات', 'خمس سنوات'];

function addDays(iso: string, days: number) { const p = ymd(iso)!; const dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + days)); return dt.toISOString().slice(0, 10); }
function addYears(iso: string, y: number) { const p = ymd(iso)!; const dt = new Date(Date.UTC(+p[0] + y, +p[1] - 1, +p[2])); return dt.toISOString().slice(0, 10); }

export function amcContractHtml(d: AmcPrintData, a: PrintAssets) {
  const co = d.company ?? {};
  const c = d.contract;
  const o = d.owner;
  const b = d.building;
  const wd = weekday(c.startDate);
  const cityEn = co.address?.split(/[,\n]/)[0]?.trim() || b.cityEn || 'Abu Dhabi';
  const cityAr = b.cityAr || 'ابوظبي';
  const ownerEn = o.nameEn || o.nameAr || '';
  const ownerAr = o.nameAr || o.nameEn || '';
  const coEn = upper(co.nameEn || d.provider.nameEn);
  const coAr = co.nameAr || d.provider.nameAr || '';
  const fax = (o.contacts ?? []).find(x => x.type === 'fax')?.value;
  const tels = [o.phone, ...(o.contacts ?? []).filter(x => x.type === 'phone' || x.type === 'mobile').map(x => x.value)].filter((v, i, arr) => v && arr.indexOf(v) === i);
  const months = Math.max(1, Math.round((new Date(addDays(c.endDate, 1)).getTime() - new Date(c.startDate).getTime()) / (30.44 * 864e5)));
  const years = Math.max(1, Math.round(months / 12));
  // the stored value is the whole contract's value (= sum of the payment schedule); the article states it per year
  const value = Math.round((Number(c.annualValue ?? 0) / years) * 100) / 100;

  // payment schedule grouped by contract year
  const groups: { from: string; to: string; items: AmcPrintData['schedule'] }[] = [];
  for (let y = 0; y < years; y++) {
    const from = addYears(c.startDate, y);
    const to = y === years - 1 ? c.endDate : addDays(addYears(c.startDate, y + 1), -1);
    groups.push({ from, to, items: d.schedule.filter(s => s.dueDate >= from && (s.dueDate <= to || (y === years - 1 && s.dueDate > to)) ) });
  }
  if (d.schedule.length && groups.every(g => !g.items.length)) groups.splice(0, groups.length, { from: c.startDate, to: c.endDate, items: d.schedule });
  const payWord = (n: number) => (n === 1 ? 'one payment' : n === 2 ? 'two payments' : `${wordsEn(n).toLowerCase()} payments`);
  const payWordAr = (n: number) => (n === 1 ? 'دفعة واحدة' : n === 2 ? 'دفعتين' : `${n} دفعات`);
  const scheduleEn = groups.filter(g => g.items.length).map((g, i) => `<span class="b">-${ORD_EN[i]} ${i ? 'year' : 'Year'} from ${dmy(g.from)} to ${dmy(g.to)} will be in ${payWord(g.items.length)}:</span><br>
    ${g.items.map((s, k) => `${ORD_EN[k]} Payment: AED <span class="b">${int(s.amount)}</span> Due Date: ${dmy(s.dueDate)}`).join('<br>')}`).join('<br>');
  const scheduleAr = groups.filter(g => g.items.length).map((g, i) => `<span class="b">-السنة ${ORD_AR_F[i]} من ${ymdSlash(g.from)} الى ${ymdSlash(g.to)} على ${payWordAr(g.items.length)}:</span><br>
    ${g.items.map((s, k) => `الدفعة ${ORD_AR_F[k]} <span class="b">${int(s.amount)}</span> درهم في تاريخ ${ymdSlash(s.dueDate)}`).join('<br>')}`).join('<br>');

  let art = 0;
  const H = (en: string, ar: string, enBody: string, arBody: string, opts: { just?: boolean } = {}) => `
  <div class="row"><div class="en${opts.just ? ' just' : ''}"><span class="h">${en}</span>${enBody}</div><div class="ar${opts.just ? ' just' : ''}"><span class="h">${ar}</span>${arBody}</div></div>`;
  const A = (enBody: string, arBody: string, opts: { just?: boolean } = {}) => { const i = art++; return H(`${ORD_EN[i]} Article`, `البند ${ORD_AR[i]}`, enBody, arBody, opts); };

  const extra = d.terms.filter(t => t.ar || t.en);
  const body = `
  <div class="logo"><img src="${a.logoAmc}" alt=""></div>
  <div class="row" style="margin-bottom:9mm"><div class="en title">Gas Supply &amp; Annual Maintenance Contract</div><div class="ar title" style="font-size:14pt">عقد صيانة اعمال وتزويد الغاز المركزى</div></div>
  <div class="row"><div class="en b">It is on ${DAYS_EN[wd]}: ${dmy(c.startDate)}</div><div class="ar b">انه فى يوم ${DAYS_AR[wd]} : الموافق&nbsp;&nbsp; ${ymdSlash(c.startDate)}</div></div>
  <div class="row"><div class="en">This agreement is made in ${esc(cityEn)} City by and between:</div><div class="ar">قد تم ابرام هذا العقد فى مدينة ${esc(cityAr)}&nbsp; بين كل من :</div></div>
  <div class="row"><div class="en"><span class="red">(First party)</span></div><div class="ar"><span class="red">( الطرف الاول)</span></div></div>
  <div class="row"><div class="en"><div class="g big">Mr.&nbsp; ${esc(ownerEn)}</div><div class="g">In his capacity as the owner</div>
      <div class="g" style="margin-top:3mm">${esc(o.cityEn || b.cityEn || '')} – UAE</div>
      <div class="b">Tel:&nbsp; ${esc(tels.join(' / '))}</div>${fax ? `<div class="b">Fax :&nbsp; ${esc(fax)}</div>` : ''}<div class="b">P.O.Box : ${esc(o.poBox || o.cityEn || '')}</div></div>
    <div class="ar"><div class="g big">السيد/ ${esc(ownerAr)}</div><div class="g">بصفته مالك البناية</div>
      <div class="g" style="margin-top:3mm">${esc(o.cityAr || b.cityAr || '')} - الإمارات العربية المتحدة</div>
      <div class="b">تلفون:&nbsp; ${esc(tels.join(' / '))}</div>${fax ? `<div class="b">فاكس : ${esc(fax)}</div>` : ''}<div class="b">ص .ب : ${esc(o.poBox || o.cityAr || '')}</div></div></div>
  <div class="row"><div class="en"><span class="red">(Second party)</span></div><div class="ar"><span class="red">( الطرف الثاني)</span></div></div>
  <div class="row"><div class="en"><div class="g">2-${esc(coEn)}</div>
      ${co.signatoryNameEn ? `<div class="gl">Represented in this agreement by:</div><div class="gl">Mr. ${esc(co.signatoryNameEn)}</div>${co.signatoryTitleEn ? `<div class="gl">In his Capacity as the ${esc(co.signatoryTitleEn)}</div>` : ''}` : ''}
      <div class="b">Tel: ${esc(co.phone ?? '')}${co.fax ? `, Fax: ${esc(co.fax)}` : ''}</div><div class="b">P.O. Box: ${esc(co.poBox ?? '')} ${esc(cityEn)}</div>
      ${co.email ? `<div style="margin-top:4mm"><span class="link">${esc(co.email)}</span></div>` : ''}</div>
    <div class="ar"><div class="g">2- ${esc(coAr)}</div>
      ${co.signatoryNameAr ? `<div class="g">ويمثلها السيد/${esc(co.signatoryNameAr)}</div>${co.signatoryTitleAr ? `<div class="gl">بصفته/&nbsp; ${esc(co.signatoryTitleAr)}</div>` : ''}` : ''}
      <div class="b">ت ${esc((co.phone ?? '').replace(/\s/g, ''))}${co.fax ? ` ف ${esc(co.fax)}` : ''}</div><div class="b">ص ب ${esc(co.poBox ?? '')} ${esc(cityAr)}</div>
      ${co.email ? `<div style="margin-top:4mm"><span class="link">${esc(co.email)}</span></div>` : ''}</div></div>
  ${H('Preamble', 'تمهيد', `<div>${AMC_STATIC.preambleEn}</div>`, `<div>${AMC_STATIC.preambleAr}</div>`)}
  ${A(`<div>${AMC_STATIC.art1En}</div>`, `<div>${AMC_STATIC.art1Ar}</div>`)}
  ${A(`<div class="g">1-The project of: Mr. ${esc(ownerEn)} bldg</div><div class="g">2- Location: ${esc([b.cityEn, b.street || b.zone, b.nameEn || b.nameAr].filter(Boolean).join('- '))}</div>
       <div class="g">3- Project Number: ${esc(b.code ?? '')}</div><div class="g">4- Works required: Maintenance, Supply of Central Gas System</div>`,
      `<div class="g">1-المشروع:&nbsp; بناية السيد : ${esc(ownerAr)}</div><div class="g">2-الموقع : ${esc([b.cityAr, b.street || b.zone, b.nameAr || b.nameEn].filter(Boolean).join(' - '))}</div>
       <div class="g">3- رقم المشروع: ${esc(b.code ?? '')}</div><div class="g">4-الاعمال المطلوبة :صيانة وتزويد نظام الغاز المركزى</div>`)}
  ${A(`<div class="just">${AMC_STATIC.art3En}</div>`, `<div>${AMC_STATIC.art3Ar}</div>`)}
  ${A(`<div>${AMC_STATIC.art4En}</div>${d.scope.length ? `<div style="margin-top:2mm" class="b">Included services:</div><ul class="dash ind">${d.scope.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
       ${d.excluded.length ? `<div class="b">Not included:</div><ul class="dash ind">${d.excluded.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`,
      `<div>${AMC_STATIC.art4Ar}</div>${d.scope.length ? `<div style="margin-top:2mm" class="b">الخدمات المشمولة:</div><ul class="dash ind">${d.scope.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
       ${d.excluded.length ? `<div class="b">خارج نطاق العقد:</div><ul class="dash ind">${d.excluded.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`)}
  ${H('Gas Cylinders', 'استخدام اسطوانات الغاز:', `<div class="just">${AMC_STATIC.cylEn}</div>`, `<div class="just">${AMC_STATIC.cylAr}</div>`)}
  ${A(`<div>Period of this agreement will be ${yearsEn[years] ?? `${years} years`}:</div><div>Commencing on: ${dmy(c.startDate)}</div><div>And valid till:&nbsp; ${dmy(c.endDate)}</div>
       ${c.autoRenew !== false ? '<div>Automatically renewable to similar periods unless either party informs other of his unwillingness in renewal of this agreement Fifteen days prior to the expiry date of the agreement.</div>' : ''}`,
      `<div>مدة هذا العقد&nbsp; ${yearsAr[years] ?? `${years} سنوات`}</div><div>&nbsp;تبدأ من تاريخ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${ymdSlash(c.startDate)}</div><div>و لغاية تاريخ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${ymdSlash(c.endDate)}</div>
       ${c.autoRenew !== false ? '<div class="just">وتجدد تلقائيا بنفس المدة ما لم يخطر احد الطرفين الاخر بعدم الرغبة فى التجديد قبل مدة خمسة عشر يوماً من نهاية العقد .</div>' : ''}`)}
  ${A(`<div>It is mutually agreed between the parties that the amount that the second party entitles in return of the necessary maintenance works central gas system will be yearly a total amount: <span class="b">AED ${int(value)}</span><br>(${wordsEn(value)} Dirhams Only) excluding VAT</div>`,
      `<div>من المتفق عليه بين الطرفين ان القيمة المستحقة للطرف الثاني عن القيام باعمال الصيانة لنظام الغاز المركزى تحددت بمبلغ اجمالى وقدره <span class="b">${int(value)} درهم</span> سنوياً (${wordsAr(value)} درهم) غير شامل القيمة الضريبة المضافة</div>`)}
  ${d.schedule.length ? A(`<div><span class="b">A-</span>The above amount will be:</div><div>${scheduleEn}</div><div><span class="b">B-</span> The contract will not be accepted by the Second Party if the First Party will not accept the condition in the ${ORD_EN[art].toLowerCase()} Article as agreed</div>`,
      `<div><span class="b">أ-</span>يتم صرف القيمة كالآتي :</div><div>${scheduleAr}</div><div><span class="b">ب-</span> يعتبر العقد غير ملزم للطرف الثانى ما لم&nbsp; يتم الالتزام من قبل الطرف الاول حسب المتفق عليه فى البند ${ORD_AR[art]}</div>`) : ''}
  ${A(`<div>${AMC_STATIC.art8En}</div>`, `<div>${AMC_STATIC.art8Ar}</div>`)}
  ${A(`<div>${AMC_STATIC.art9En}</div>`, `<div>${AMC_STATIC.art9Ar}</div>`)}
  ${A(`<div>1-Any dispute arises out of this agreement shall be referred to jurisdiction of ${esc(cityEn)} courts</div><div>2-This agreement is issued in two copies and each party has one to act accordingly</div>`,
      `<div>1-اى نزاع ينشأ بخصوص هذا العقد يكون من اختصاص محاكم ${esc(cityAr)}</div><div>2-حرر هذا العقد من نسختين بيد كل طرف نسخة للعمل بموجبها</div>`)}
  ${extra.length ? A(extra.map((t, i) => `<div>${i + 1}- ${nl(t.en || t.ar)}</div>`).join(''), extra.map((t, i) => `<div>${i + 1}- ${nl(t.ar || t.en)}</div>`).join('')) : ''}
  ${c.notes ? H('Remarks', 'ملاحظات', `<div>${nl(c.notes)}</div>`, `<div>${nl(c.notes)}</div>`) : ''}
  <div class="row sign" style="margin-top:14mm"><div class="en"><div class="g" style="text-decoration:underline">First Party:</div><div class="g">Mr.&nbsp; ${esc(ownerEn)}</div></div>
    <div class="ar"><div class="g" style="text-decoration:underline">الطرف الاول :</div><div class="g">السيد : ${esc(ownerAr)}</div></div></div>
  <div class="row sign" style="margin-top:8mm"><div class="en"><div class="g" style="text-decoration:underline">Second Party</div><div class="g">${esc(coEn)}</div></div>
    <div class="ar"><div class="g" style="text-decoration:underline">الطرف الثاني</div><div class="g">${esc(coAr)}</div></div></div>`;
  return documentHtml(`AMC ${c.contractNo}`, AMC_CSS, body);
}
