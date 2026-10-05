import { frappe } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Building {
  name: string;
  building_name: string;
  building_name_en: string;
  building_code: string;
  status: 'Active' | 'Inactive' | 'Under Maintenance';
  emirate: string;
  zone: string;
  area: string;
  total_floors: number;
  total_units: number;
  total_tanks: number;
  customer: string;
  city: string;
  civil_defense_number: string;
  civil_defense_expiry: string;
  civil_defense_status: string;
}

export interface BuildingUnit {
  name: string;
  unit_number: string;
  building: string;
  floor: number;
  status: 'Occupied' | 'Vacant' | 'Under Maintenance' | 'Reserved';
  unit_type: string;
  gas_meter: string;
  current_tenant: string;
  monthly_rent: number;
}

export interface BuildingOwner {
  name: string;
  owner_name: string;
  owner_name_en: string;
  owner_type: string;
  status: string;
  default_phone: string;
  default_email: string;
}

export interface AmcContract {
  name: string;
  building: string;
  customer: string;
  status: string;
  start_date: string;
  expiry_date: string;
  contract_value: number;
  total_invoiced: number;
  outstanding_amount: number;
  assigned_engineer: string;
}

export interface BuildingStats {
  total: number;
  active: number;
  totalUnits: number;
  vacantUnits: number;
  byEmirate: Record<string, number>;
  occupiedUnits: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getBuildings(): Promise<Building[]> {
  const res = await frappe.getList('Building', {
    fields: JSON.stringify([
      'name', 'building_name', 'building_name_en', 'building_code',
      'status', 'emirate', 'zone', 'area', 'city',
      'total_floors', 'total_units', 'total_tanks', 'customer',
      'civil_defense_number', 'civil_defense_expiry', 'civil_defense_status',
    ]),
    limit: 200,
    order_by: 'building_code asc',
  });
  return res.data.data || [];
}

export async function getBuilding(name: string): Promise<Building> {
  const res = await frappe.getDoc('Building', name);
  return res.data.data;
}

export async function getBuildingUnits(building: string): Promise<BuildingUnit[]> {
  const res = await frappe.getList('Building Unit', {
    fields: JSON.stringify([
      'name', 'unit_number', 'building', 'floor', 'status',
      'unit_type', 'gas_meter', 'current_tenant', 'monthly_rent',
    ]),
    filters: JSON.stringify([['building', '=', building]]),
    limit: 500,
    order_by: 'floor asc, unit_number asc',
  });
  return res.data.data || [];
}

export async function getBuildingOwners(building: string): Promise<BuildingOwner[]> {
  // Owners are a child table on Building — fetch via link
  const res = await frappe.getList('Building Owner Entry', {
    fields: JSON.stringify(['name', 'owner', 'ownership_percentage']),
    filters: JSON.stringify([['parent', '=', building], ['parenttype', '=', 'Building']]),
    limit: 50,
  }).catch(() => ({ data: { data: [] } }));
  return res.data.data || [];
}

export async function getAmcContracts(building?: string): Promise<AmcContract[]> {
  const filters: any[] = [];
  if (building) filters.push(['building', '=', building]);
  const res = await frappe.getList('AMC Maintenance Contract', {
    fields: JSON.stringify([
      'name', 'building', 'customer', 'status',
      'start_date', 'expiry_date', 'contract_value',
      'total_invoiced', 'outstanding_amount', 'assigned_engineer',
    ]),
    ...(filters.length ? { filters: JSON.stringify(filters) } : {}),
    limit: 500,
    order_by: 'start_date desc',
  });
  return res.data.data || [];
}


/** Fetch ALL units for ALL buildings in a single API call (no building filter). */
export async function getAllBuildingUnits(): Promise<BuildingUnit[]> {
  const res = await frappe.getList('Building Unit', {
    fields: JSON.stringify(['name','unit_number','building','floor','status',
      'unit_type','gas_meter','current_tenant','monthly_rent']),
    limit: 2000,
    order_by: 'building asc, floor asc, unit_number asc',
  });
  return res.data.data || [];
}

export async function getBuildingStats(buildings: Building[], units: BuildingUnit[]): Promise<BuildingStats> {
  const total = buildings.length;
  const active = buildings.filter(b => b.status === 'Active').length;
  const totalUnits = units.length || buildings.reduce((s, b) => s + (b.total_units || 0), 0);
  const vacantUnits = units.filter(u => u.status === 'Vacant').length;
  const occupiedUnits = units.filter(u => u.status === 'Occupied').length;

  const byEmirate: Record<string, number> = {};
  buildings.forEach(b => {
    const em = b.emirate || 'غير محدد';
    byEmirate[em] = (byEmirate[em] || 0) + 1;
  });

  return { total, active, totalUnits, vacantUnits, occupiedUnits, byEmirate };
}
