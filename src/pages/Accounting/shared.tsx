import { useEffect, useState } from 'react';
import { Select, message } from 'antd';
import type { SelectProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { useReference } from '../../api/reference';

export const PRIMARY = '#1a5c2a';
export const DARK = '#0b2e18';
export const GOLD = '#c9a84c';

export const num = (n?: number | null) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n?: number | null) => `${num(n)} د.إ`;

export const ACCOUNT_TYPES: Record<string, { label: string; color: string }> = {
  asset: { label: 'أصول', color: 'blue' }, liability: { label: 'خصوم', color: 'orange' }, equity: { label: 'حقوق ملكية', color: 'purple' },
  revenue: { label: 'إيرادات', color: 'green' }, expense: { label: 'مصروفات', color: 'red' },
};

export const SOURCE_TYPES: Record<string, string> = {
  manual: 'قيد يدوي', opening: 'أرصدة افتتاحية', invoice: 'فاتورة مبيعات', payment: 'سند قبض', vendor_bill: 'فاتورة مورد', vendor_payment: 'دفعة مورد',
  voucher: 'سند قبض/صرف', refill_request: 'طلب تعبئة', amc_contract: 'عقد صيانة', credit_note: 'إشعار دائن', refund: 'رد مبلغ', bank_transfer: 'تحويل بنكي',
};

export const JOURNAL_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'default' }, posted: { label: 'مرحّل', color: 'success' }, reversed: { label: 'معكوس', color: 'volcano' },
};

/** Print only the element with class «print-sheet». */
export const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .print-sheet, .print-sheet * { visibility: visible !important; }
  .print-sheet { position: absolute; inset: 0 0 auto 0; width: 100%; padding: 16px; background: #fff; direction: rtl; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 10mm; }
}`;

/** Download rows as a UTF-8 CSV that Excel opens with Arabic text. */
export function downloadCsv(fileName: string, head: string[], rows: (string | number | null | undefined)[][]) {
  const csv = '﻿' + [head, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  a.click();
}

/** Parse a simple CSV (comma or semicolon, quoted values) into rows. */
export function parseCsv(text: string): string[][] {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(x => x !== '')) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell.trim()); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

export interface AccountOption { id: number; accountCode: string; name: string; type?: string; isGroup?: boolean; isPostable?: boolean; isActive?: boolean; parentId?: number | null; level?: number }

/** Flattens /accounts/tree into a list (keeps parent ids). */
export function flattenTree(nodes: any[], parentId: number | null = null, out: AccountOption[] = []): AccountOption[] {
  nodes.forEach(n => {
    out.push({ id: n.id, accountCode: n.accountCode, name: n.name, type: n.type, isGroup: n.isGroup, isPostable: n.isPostable, isActive: n.isActive, parentId, level: n.level });
    flattenTree(n.children ?? [], n.id, out);
  });
  return out;
}

let accountsCache: Promise<AccountOption[]> | null = null;
export function loadAccounts(force = false): Promise<AccountOption[]> {
  if (!accountsCache || force) accountsCache = api<any[]>('/accounts/tree').then(t => flattenTree(t)).catch(e => { accountsCache = null; throw e; });
  return accountsCache;
}

export function useAccounts(reloadKey = 0) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  useEffect(() => { loadAccounts(reloadKey > 0).then(setAccounts).catch(e => message.error(String(e?.message ?? e))); }, [reloadKey]);
  return accounts;
}

/** Postable (or any) account picker grouped by account type. */
export function AccountSelect({ postableOnly = true, accounts, ...rest }: SelectProps & { postableOnly?: boolean; accounts?: AccountOption[] }) {
  const all = useAccounts();
  const list = (accounts ?? all).filter(a => (postableOnly ? a.isPostable && !a.isGroup && a.isActive !== false : true));
  const groups = Object.entries(ACCOUNT_TYPES).map(([k, t]) => ({
    label: t.label, options: list.filter(a => a.type === k).map(a => ({ value: a.id, label: `${a.accountCode} — ${a.name}` })),
  })).filter(g => g.options.length);
  const other = list.filter(a => !a.type || !ACCOUNT_TYPES[a.type]).map(a => ({ value: a.id, label: `${a.accountCode} — ${a.name}` }));
  return <Select showSearch optionFilterProp="label" placeholder="اختر الحساب…" options={other.length ? [...groups, { label: 'أخرى', options: other }] : groups} {...rest} />;
}

export function useBranches() {
  const { i18n } = useTranslation();
  const ref = useReference(i18n.language);
  return (ref.data?.branches ?? []).map(b => ({ value: b.id, label: b.nameAr ?? b.nameEn ?? b.code }));
}

export function BranchSelect(props: SelectProps) {
  const options = useBranches();
  return <Select allowClear placeholder="كل الفروع" options={options} style={{ width: 160 }} {...props} />;
}
