/**
 * Fields that can be placed inside a contract term, e.g. "يقدم الطرف الأول فاتورة كل {billing_months} أشهر بسعر {gas_price} درهم".
 * The terms editor inserts them; the printed contract replaces each one with the contract's value (Arabic text gets the Arabic value,
 * English text the English value).
 */
export type TermContractKind = 'supply' | 'amc';
export interface TermField { key: string; ar: string; en: string }

export const TERM_FIELDS: Record<TermContractKind, TermField[]> = {
  supply: [
    { key: 'customer_name', ar: 'اسم العميل', en: 'Customer name' },
    { key: 'contract_no', ar: 'رقم العقد', en: 'Contract no.' },
    { key: 'start_date', ar: 'تاريخ البداية', en: 'Start date' },
    { key: 'end_date', ar: 'تاريخ الانتهاء', en: 'End date' },
    { key: 'building', ar: 'المبنى', en: 'Building' },
    { key: 'flat_no', ar: 'رقم الشقة', en: 'Flat no.' },
    { key: 'meter_no', ar: 'رقم العداد', en: 'Meter no.' },
    { key: 'contract_type', ar: 'نوع العقد', en: 'Contract type' },
    { key: 'service_type', ar: 'نوع الخدمة', en: 'Service type' },
    { key: 'gas_price', ar: 'سعر الغاز / م³', en: 'Gas price / m³' },
    { key: 'service_fee', ar: 'رسوم الخدمة الشهرية', en: 'Monthly service fee' },
    { key: 'maintenance_fee', ar: 'رسوم الصيانة', en: 'Maintenance fee' },
    { key: 'admin_fee', ar: 'الرسوم الإدارية', en: 'Administration fee' },
    { key: 'connection_fee', ar: 'رسوم التوصيل', en: 'Connection fee' },
    { key: 'disconnection_fee', ar: 'رسوم القطع', en: 'Disconnection fee' },
    { key: 'deposit', ar: 'مبلغ التأمين', en: 'Deposit' },
    { key: 'advance_total', ar: 'إجمالي المقدم', en: 'Total advance' },
    { key: 'billing_months', ar: 'الفوترة كل (أشهر)', en: 'Billing every (months)' },
    { key: 'company_name', ar: 'اسم الشركة', en: 'Company name' },
  ],
  amc: [
    { key: 'owner_name', ar: 'اسم المالك', en: 'Owner name' },
    { key: 'contract_no', ar: 'رقم العقد', en: 'Contract no.' },
    { key: 'start_date', ar: 'تاريخ البداية', en: 'Start date' },
    { key: 'end_date', ar: 'تاريخ الانتهاء', en: 'End date' },
    { key: 'building', ar: 'المبنى', en: 'Building' },
    { key: 'contract_value', ar: 'قيمة العقد', en: 'Contract value' },
    { key: 'yearly_value', ar: 'القيمة السنوية', en: 'Yearly value' },
    { key: 'visits_total', ar: 'عدد الزيارات', en: 'Number of visits' },
    { key: 'response_hours', ar: 'وقت الاستجابة (ساعة)', en: 'Response time (hours)' },
    { key: 'company_name', ar: 'اسم الشركة', en: 'Company name' },
  ],
};

const ALL = new Map<string, TermField>([...TERM_FIELDS.supply, ...TERM_FIELDS.amc].map(f => [f.key, f]));
export const termField = (key: string) => ALL.get(key);

export type TermValues = Record<string, string | number | null | undefined | { en?: string | null; ar?: string | null }>;

const FIELD_RE = /\{(\w+)\}/g;

/** Replace {fields} with the contract's values; an empty value prints as dots, like the paper form. */
export function fillTerm(text: string, values: TermValues, lang: 'ar' | 'en' = 'ar') {
  return (text ?? '').replace(FIELD_RE, (m, k: string) => {
    if (!(k in values)) return termField(k) ? '........' : m;
    const v = values[k];
    const s = v != null && typeof v === 'object' ? (lang === 'en' ? v.en ?? v.ar : v.ar ?? v.en) : v;
    return s != null && String(s) !== '' ? String(s) : '........';
  });
}

/** Split a term into plain text and {field} parts (for highlighting in the editor). */
export function termParts(text: string): { text: string; field?: string }[] {
  const out: { text: string; field?: string }[] = [];
  let last = 0;
  for (const m of (text ?? '').matchAll(FIELD_RE)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], field: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < (text ?? '').length) out.push({ text: text.slice(last) });
  return out;
}
