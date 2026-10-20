import { api, apiUpload, type Paged } from './client';

/** Row of GET /buildings */
export interface BuildingListItem {
  id: number;
  code: string;
  name?: string;
  nameEn?: string;
  nameAr?: string;
  branchId: number;
  branch?: string;
  cityId?: number;
  city?: string;
  type?: string;
  typeLabel?: string;
  status?: string;
  isActive: boolean;
  zone?: string;
  units: number;
  occupied: number;
  vacant: number;
  meters: number;
  tanks: number;
  tankLevelPct?: number | null;
  openRequests: number;
  primaryOwner?: string;
}

/** GET /buildings/kpis */
export interface BuildingKpis {
  total: number;
  active: number;
  inactive: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  newThisMonth: number;
  byBranch: { branchId: number; branch?: string; buildings: number; units: number }[];
}

export interface NewPartyInput {
  partyType?: 'individual' | 'company';
  nameEn?: string;
  nameAr?: string;
  emiratesId?: string;
  nationality?: string;
  tradeLicenseNo?: string;
  taxNumber?: string;
  cityId?: number;
  poBox?: string;
  address?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  bankName?: string;
  iban?: string;
  /** all phone numbers, default first */
  phones?: string[];
  /** all emails, default first */
  emails?: string[];
}

export interface OwnerInput {
  partyId?: number;
  party?: NewPartyInput;
  ownershipPercentage?: number;
  isPrimary: boolean;
  fromDate?: string;
  toDate?: string;
}

export interface TankInput {
  tankNo?: string;
  gasTypeId?: number;
  gasType?: string;
  capacityLitres: number;
  currentLevelLitres?: number;
  serialNo?: string;
  manufacturer?: string;
  installDate?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  status?: string;
}

export interface UnitInput {
  no?: string;
  floor?: number;
  type?: string;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  rent?: number;
  status?: string;
  notes?: string;
}

export interface BuildingInput {
  branchId?: number;
  nameEn?: string;
  nameAr?: string;
  buildingType?: string;
  status?: string;
  cityId?: number;
  zone?: string;
  street?: string;
  poBox?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  totalFloors?: number;
  notes?: string;
  owners?: OwnerInput[];
  tanks?: TankInput[];
  units?: UnitInput[];
}

/** Owner row inside GET /buildings/{id} */
export interface BuildingOwnerDto {
  id: number;
  partyId: number;
  name?: string;
  isPrimary: boolean;
}

export interface BuildingListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  branchId?: number;
  status?: string;
  type?: string;
  cityId?: number;
  sort?: string;
  desc?: boolean;
}

export const buildingsApi = {
  list: (q: BuildingListQuery, signal?: AbortSignal) =>
    api<Paged<BuildingListItem>>('/buildings', { query: { ...q }, signal }),
  kpis: (branchId?: number, signal?: AbortSignal) =>
    api<BuildingKpis>('/buildings/kpis', { query: { branchId }, signal }),
  get: <T = { id: number; code: string; owners: BuildingOwnerDto[] }>(id: number) =>
    api<T>(`/buildings/${id}`),
  create: (input: BuildingInput) =>
    api<{ id: number; code: string }>('/buildings', { body: input }),
  update: (id: number, input: BuildingInput) =>
    api<{ id: number; code: string }>(`/buildings/${id}`, { method: 'PUT', body: input }),
  setStatus: (id: number, status: string) =>
    api<void>(`/buildings/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id: number) =>
    api<void>(`/buildings/${id}`, { method: 'DELETE' }),
};

/** POST /documents (multipart): attach a file to any record. */
export function uploadDocument(args: { file: File; entityType: string; entityId: number; documentType?: string; expiryDate?: string; branchId?: number }) {
  const fd = new FormData();
  fd.append('file', args.file);
  fd.append('entityType', args.entityType);
  fd.append('entityId', String(args.entityId));
  if (args.documentType) fd.append('documentType', args.documentType);
  if (args.expiryDate) fd.append('expiryDate', args.expiryDate);
  if (args.branchId != null) fd.append('branchId', String(args.branchId));
  return apiUpload<{ id: number; url: string }>('/documents', fd);
}
