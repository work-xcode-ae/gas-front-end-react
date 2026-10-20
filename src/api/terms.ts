import { api } from './client';

/** Contract kinds that use the terms & conditions setup (the «type code» of a term). */
export type TermContractType = 'supply' | 'amc';

export const TERM_CONTRACT_TYPES: Record<TermContractType, { label: string; short: string; color: string }> = {
  supply: { label: 'عقود توريد الغاز (المستأجرين)', short: 'توريد الغاز', color: '#1a5c2a' },
  amc: { label: 'عقود الصيانة السنوية (AMC)', short: 'الصيانة AMC', color: '#1565c0' },
};

export const TERM_CATEGORIES: Record<string, { label: string; color: string }> = {
  general: { label: 'أحكام عامة', color: '#1565c0' },
  payment: { label: 'الدفع والرسوم', color: '#b7791f' },
  service: { label: 'مستوى الخدمة', color: '#2e7d32' },
  safety: { label: 'السلامة', color: '#c62828' },
  liability: { label: 'المسؤولية', color: '#d46b08' },
  renewal: { label: 'التجديد والإنهاء', color: '#6a1b9a' },
  dispute: { label: 'تسوية النزاعات', color: '#ad2102' },
  other: { label: 'أخرى', color: '#595959' },
};
export const termCategory = (c?: string) => TERM_CATEGORIES[c ?? ''] ?? TERM_CATEGORIES.other;

/** Row of GET /contract-term-templates (Settings). */
export interface TermTemplate {
  id: number; contractType: TermContractType; category: string; textAr: string; textEn?: string | null;
  isDefault: boolean; sortOrder: number; isActive: boolean;
}
/** Row of GET /contract-term-templates/options (contract forms). */
export interface TermOption { id: number; category: string; text: string; textAr: string; textEn?: string | null; isDefault: boolean }

/** One term of a contract being written: from the setup (templateId) or custom. */
export interface ContractTermItem {
  key: string;
  templateId?: number | null;
  category: string;
  text: string;
}

export const termsApi = {
  list: (contractType?: TermContractType) => api<TermTemplate[]>('/contract-term-templates', { query: { contractType } }),
  options: (contractType: TermContractType) => api<TermOption[]>('/contract-term-templates/options', { query: { contractType } }),
  create: (body: Partial<TermTemplate>) => api<TermTemplate>('/contract-term-templates', { body }),
  update: (id: number, body: Partial<TermTemplate>) => api<TermTemplate>(`/contract-term-templates/${id}`, { method: 'PUT', body }),
  remove: (id: number) => api<void>(`/contract-term-templates/${id}`, { method: 'DELETE' }),
  reorder: (ids: number[]) => api<void>('/contract-term-templates/reorder', { body: { ids } }),
};

/** Body for the API (ContractService.TermItemInput). */
export const toTermInputs = (items: ContractTermItem[]) =>
  items.map(x => ({ templateId: x.templateId ?? null, category: x.category, text: x.text.trim() })).filter(x => x.text);
