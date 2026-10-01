import { frappe } from './client';

export interface Building {
  name: string;
  building_name?: string;
  building_name_en?: string;
  emirate?: string;
  total_units?: number;
  status?: string;
  address?: string;
  city?: string;
}

export async function getBuildings(): Promise<Building[]> {
  const res = await frappe.getList('Building', {
    fields: JSON.stringify([
      'name', 'building_name', 'building_name_en',
      'emirate', 'total_units', 'status', 'address', 'city',
    ]),
    limit: 500,
    order_by: 'creation desc',
  });
  return res.data.data || [];
}

export async function getBuilding(name: string): Promise<Building> {
  const res = await frappe.getDoc('Building', name);
  return res.data.data;
}

export async function getBuildingUnits(building: string) {
  const res = await frappe.getList('Building Unit', {
    fields: JSON.stringify(['name', 'unit_no', 'floor', 'status', 'tenant', 'unit_type']),
    filters: JSON.stringify([['building', '=', building]]),
    limit: 500,
  });
  return res.data.data || [];
}
