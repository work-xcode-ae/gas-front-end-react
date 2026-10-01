import { frappe } from './client';

export interface DashboardStats {
  buildings: number;
  apartments: number;
  activeCustomers: number;
  totalInvoices: number;
  collected: number;
  overdue: number;
  overdueCount: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [buildingsRes, unitsRes, tenantsRes, invoicesRes] = await Promise.all([
    // Property Management
    frappe.getList('Building', { fields: JSON.stringify(['name']), limit: 500 }),
    frappe.getList('Building Unit', { fields: JSON.stringify(['name']), limit: 0 }),
    // Tenant Management — active tenants
    frappe.getList('Tenant', {
      fields: JSON.stringify(['name']),
      filters: JSON.stringify([['status', '=', 'Active']]),
      limit: 0,
    }),
    // ERPNext Sales Invoice — all invoices (billing is through standard ERPNext)
    frappe.getList('Sales Invoice', {
      fields: JSON.stringify(['grand_total', 'outstanding_amount', 'status', 'customer']),
      filters: JSON.stringify([['docstatus', '=', 1]]),
      limit: 500,
    }),
  ]);

  const invoices: Array<{
    grand_total: number; outstanding_amount: number; status: string; customer: string;
  }> = invoicesRes.data.data || [];

  const totalInvoices = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
  const collected = invoices.reduce((s, i) => s + ((i.grand_total || 0) - (i.outstanding_amount || 0)), 0);
  const overdueInvoices = invoices.filter(i => i.status === 'Overdue');
  const overdue = overdueInvoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0);
  const overdueCustomers = new Set(overdueInvoices.map(i => i.customer)).size;

  return {
    buildings: (buildingsRes.data.data || []).length,
    apartments: (unitsRes.data.data || []).length,
    activeCustomers: (tenantsRes.data.data || []).length,
    totalInvoices,
    collected,
    overdue,
    overdueCount: overdueCustomers,
  };
}

export async function getRecentInvoices(limit = 5) {
  const res = await frappe.getList('Sales Invoice', {
    fields: JSON.stringify(['name', 'customer', 'grand_total', 'status']),
    filters: JSON.stringify([['docstatus', '=', 1]]),
    order_by: 'creation desc',
    limit,
  });
  return (res.data.data || []).map((inv: any) => ({
    ...inv,
    building: inv.customer,  // will enrich later when building link exists
  }));
}

export async function getRecentMeterReadings(limit = 5) {
  // Try Gas Meter Reading first, fallback to Meter Reading
  try {
    const res = await frappe.getList('Gas Meter Reading', {
      fields: JSON.stringify(['name', 'reading_date', 'building', 'current_reading', 'previous_reading', 'consumption']),
      order_by: 'reading_date desc',
      limit,
    });
    if ((res.data.data || []).length > 0) return res.data.data;
  } catch {}
  const res = await frappe.getList('Meter Reading', {
    fields: JSON.stringify(['name', 'reading_date', 'building', 'current_reading', 'previous_reading', 'consumption']),
    order_by: 'reading_date desc',
    limit,
  });
  return res.data.data || [];
}

export async function getRecentServiceRequests(limit = 5) {
  const res = await frappe.getList('AMC Visit', {
    fields: JSON.stringify(['name', 'visit_type', 'building', 'status']),
    order_by: 'creation desc',
    limit,
  });
  return (res.data.data || []).map((r: any) => ({
    name: r.name,
    request_type: r.visit_type || 'صيانة',
    building: r.building || '—',
    status: r.status,
  }));
}

export async function getRefillRequests(limit = 5) {
  const res = await frappe.getList('Refill Request', {
    fields: JSON.stringify([
      'name', 'building', 'customer', 'tank', 'current_tank_level',
      'requested_quantity', 'unit_of_measure', 'gas_type',
      'priority', 'status', 'requested_date',
    ]),
    order_by: 'creation desc',
    limit,
  });
  return (res.data.data || []).map((r: any) => ({
    name: r.name,
    building: r.building,
    customer: r.customer,
    tank: r.tank,
    levelPct: r.current_tank_level ?? 0,
    qty: r.requested_quantity,
    unit: r.unit_of_measure,
    gasType: r.gas_type,
    priority: (r.priority || 'Normal').toLowerCase(),
    status: r.status,
    date: r.requested_date,
  }));
}
