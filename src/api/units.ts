import { api, type Paged } from './client';

/** Row of GET /units (UnitsController.UnitDto) */
export interface UnitDto {
  id: number;
  key: string;
  buildingId: number;
  buildingCode?: string;
  buildingName?: string;
  no: string;
  floor?: number | null;
  type?: string;
  typeLabel?: string;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rent?: number | null;
  status?: string;
  statusLabel?: string;
  tenantId?: number | null;
  tenant?: string | null;
  contractId?: number | null;
  contractNo?: string | null;
  meterId?: number | null;
  meter?: string | null;
  meterStatus?: string | null;
  meterStatusLabel?: string | null;
  lastInspectionDate?: string | null;
  notes?: string | null;
  /** false = deactivated (kept with its history, no new tenant contracts) */
  isActive?: boolean;
}

/** Body of POST /units, PUT /units/{id} and the rows of POST /units/bulk */
export interface UnitSaveInput {
  buildingId?: number;
  no: string;
  floor?: number | null;
  type?: string;
  status?: string;
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  rent?: number | null;
  lastInspectionDate?: string | null;
  notes?: string | null;
}

export const unitsApi = {
  /** all units of one building (pageSize=0 → no paging) */
  byBuilding: (buildingId: number, signal?: AbortSignal) =>
    api<Paged<UnitDto>>('/units', { query: { buildingId, pageSize: 0 }, signal }),
  get: (id: number) => api<UnitDto>(`/units/${id}`),
  create: (input: UnitSaveInput) => api<{ id: number }>('/units', { body: input }),
  createBulk: (buildingId: number, units: UnitSaveInput[]) =>
    api<{ id: number; unitNo: string }[]>('/units/bulk', { body: { buildingId, units } }),
  update: (id: number, input: UnitSaveInput) => api<void>(`/units/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => api<void>(`/units/${id}`, { method: 'DELETE' }),
  /** deactivate / re-activate (PATCH /units/{id}/active) */
  setActive: (id: number, isActive: boolean, reason?: string) => api<void>(`/units/${id}/active`, { method: 'PATCH', body: { isActive, reason } }),
};
