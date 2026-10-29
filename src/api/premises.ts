import { api, type Paged } from './client';
import type { NewPartyInput, TankInput } from './buildings';

/** Restaurants & Villas — client for /api/premises (additive module). */
export type PremisesType = 'villa' | 'restaurant';

export const PREMISES_LABEL: Record<PremisesType, { one: string; many: string; color: string }> = {
  villa: { one: 'فيلا', many: 'الفلل', color: 'purple' },
  restaurant: { one: 'مطعم', many: 'المطاعم', color: 'volcano' },
};

/** Row of GET /premises */
export interface PremisesListItem {
  id: number;
  type: PremisesType;
  code: string;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  branchId: number;
  branch?: string;
  buildingId: number;
  buildingCode: string;
  building?: string;
  zone?: string;
  unitId?: number | null;
  unitNo?: string | null;
  ownerPartyId: number;
  owner?: string;
  ownerPhone?: string;
  tanks: number;
  capacityLitres: number;
  levelLitres: number;
  levelPct?: number | null;
  signatories: number;
  contractId?: number | null;
  contractNo?: string | null;
  pricePerLitre?: number | null;
  contractEnd?: string | null;
  invoicedTotal: number;
  readyToInvoice: number;
  isActive: boolean;
}

export interface PremisesKpis {
  total: number; active: number; withContract: number; tanks: number; lowTanks: number;
  readyToInvoice: number; readyLitres: number; invoicedThisMonth: number; litresThisMonth: number;
}

export interface SignatoryInput {
  nameEn?: string | null; nameAr?: string | null; emiratesId?: string | null; position?: string | null;
  phone?: string | null; email?: string | null; canSignContracts: boolean; notes?: string | null; isActive?: boolean;
}

export interface ContractInput {
  startDate: string; endDate?: string | null; durationMonths?: number | null; pricePerLitre: number; taxRateId?: number | null;
  paymentTermsDays?: number | null; signatoryId?: number | null; signatoryIndex?: number | null; signedByName?: string | null;
  signedDate?: string | null; autoRenew: boolean; renewalPeriodMonths?: number | null; notes?: string | null;
}

export interface OwnerRef { partyId?: number | null; party?: NewPartyInput | null }

export interface VillaInput {
  branchId?: number | null; nameEn?: string | null; nameAr?: string | null; owner?: OwnerRef | null;
  cityId?: number | null; zone?: string | null; street?: string | null; poBox?: string | null; address?: string | null;
  latitude?: number | null; longitude?: number | null;
  community?: string | null; plotNo?: string | null; villaNo?: string | null; makaniNo?: string | null; bedrooms?: number | null;
  notes?: string | null; tanks?: TankInput[]; contract?: ContractInput | null;
}

export interface RestaurantInput {
  buildingId: number; unitId?: number | null; nameEn?: string | null; nameAr?: string | null; owner?: OwnerRef | null;
  tradeName?: string | null; tradeLicenseNo?: string | null; tradeLicenseExpiry?: string | null;
  seatingCapacity?: number | null; burnersCount?: number | null; kitchenType?: string | null;
  cuisine?: string | null; operatingHours?: string | null; notes?: string | null;
  signatories?: SignatoryInput[]; tanks?: TankInput[]; contract?: ContractInput | null;
}

/** Row of GET /premises/refills */
export interface PremisesRefillRow {
  refillRequestId: number; requestNo: string; premisesId: number; premisesType: PremisesType; premisesCode: string; premises?: string;
  buildingCode?: string; tankId: number; tankNo: string; requestDate: string; statusCode?: string; stage: number;
  deliveredAt?: string | null; deliveredLitres?: number | null; completedAt?: string | null;
  invoiceId?: number | null; invoiceNo?: string | null; invoicedAmount?: number | null; readyToInvoice: boolean;
  pricePerLitre?: number | null; estimatedAmount?: number | null; missingContract: boolean;
}

export const premisesApi = {
  list: (q: { page?: number; pageSize?: number; search?: string; type?: PremisesType; buildingId?: number; branchId?: number; active?: boolean }) =>
    api<Paged<PremisesListItem>>('/premises', { query: { ...q } }),
  kpis: (type?: PremisesType, branchId?: number) => api<PremisesKpis>('/premises/kpis', { query: { type, branchId } }),
  byBuilding: () => api<{ buildingId: number; villaId?: number | null; restaurants: number }[]>('/premises/by-building'),
  get: (id: number) => api<any>(`/premises/${id}`),
  createVilla: (v: VillaInput) => api<{ id: number; code: string; buildingId: number; contractId?: number }>('/premises/villas', { body: v }),
  updateVilla: (id: number, v: VillaInput) => api(`/premises/villas/${id}`, { method: 'PUT', body: v }),
  createRestaurant: (v: RestaurantInput) => api<{ id: number; code: string; contractId?: number }>('/premises/restaurants', { body: v }),
  updateRestaurant: (id: number, v: RestaurantInput) => api(`/premises/restaurants/${id}`, { method: 'PUT', body: v }),
  setActive: (id: number, isActive: boolean) => api(`/premises/${id}/active`, { method: 'PATCH', body: { isActive } }),
  remove: (id: number) => api(`/premises/${id}`, { method: 'DELETE' }),
  addSignatory: (id: number, s: SignatoryInput) => api(`/premises/${id}/signatories`, { body: s }),
  updateSignatory: (id: number, sid: number, s: SignatoryInput) => api(`/premises/${id}/signatories/${sid}`, { method: 'PUT', body: s }),
  removeSignatory: (id: number, sid: number) => api(`/premises/${id}/signatories/${sid}`, { method: 'DELETE' }),
  addTank: (id: number, t: TankInput) => api<{ id: number; tankNo: string }>(`/premises/${id}/tanks`, { body: t }),
  removeTank: (id: number, tankId: number) => api(`/premises/${id}/tanks/${tankId}`, { method: 'DELETE' }),
  addContract: (id: number, c: ContractInput) => api<{ id: number; contractNo: string }>(`/premises/${id}/contracts`, { body: c }),
  updateContract: (cid: number, c: ContractInput) => api(`/premises/contracts/${cid}`, { method: 'PUT', body: c }),
  terminateContract: (cid: number, date?: string, reason?: string) => api(`/premises/contracts/${cid}/terminate`, { body: { date: date ?? null, reason: reason ?? null } }),
  refills: (q: { premisesId?: number; type?: PremisesType; readyOnly?: boolean }) => api<PremisesRefillRow[]>('/premises/refills', { query: { ...q } }),
  invoiceRefill: (refillRequestId: number, issueDate?: string, notes?: string) =>
    api<{ id: number; invoiceNo: string; subtotal: number; vatAmount: number; totalAmount: number }>(`/premises/refills/${refillRequestId}/invoice`, { body: { issueDate: issueDate ?? null, notes: notes ?? null } }),
};
