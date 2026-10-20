import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { api, errorMessage } from '../../api/client';
import {
  Drawer, Form, Input, InputNumber, Select, Button, Space, Typography,
  Tag, Row, Col, Card, Switch, Descriptions, Modal, message, Tooltip, Steps, Alert,
} from 'antd';
import {
  FileTextOutlined, ShoppingOutlined, DollarOutlined, CarOutlined,
  FileProtectOutlined, CalendarOutlined, FireOutlined, SafetyCertificateOutlined,
  LockOutlined, CheckOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const PRIMARY = '#1a5c2a';

/** Sample fleet for the demo building only (real buildings load /api/vehicles). */
const FLEET_VEHICLES: { id: string; plate: string; driver: string; driverPhone: string; type: string; capacity: number; unit: string; status: string }[] = [];

const METHOD_OPTIONS = [
  { code: 'bank_transfer', label: 'تحويل بنكي' }, { code: 'cheque', label: 'شيك' },
  { code: 'cash', label: 'نقداً' }, { code: 'card', label: 'بطاقة ائتمان' },
];
const METHOD_LABEL: Record<string, string> = Object.fromEntries(METHOD_OPTIONS.map(m => [m.code, m.label]));
const d10 = (v: any) => (v ? String(v).slice(0, 10) : '');

/** Server stage (0 requested … 8 completed) → the stage whose form is open in the drawer. */
export const uiStage = (server: number) => (server <= 5 ? server + 1 : server <= 7 ? 7 : 8);

/** GET /refill-requests row → RefillRequestItem used by this drawer and the refill tab. */
export function mapLiveRefill(x: any): RefillRequestItem {
  const sd = x.stageData ?? {};
  const n = (v: any) => Number(v ?? 0);
  const STATUS_BY_UI: Record<number, string> = { 1: 'requested', 2: 'po_issued', 3: 'paid', 4: 'collecting', 5: 'invoiced', 6: 'scheduled', 7: 'pending_approval', 8: 'completed' };
  const stage = x.status === 'cancelled' ? 0 : uiStage(Number(x.stage ?? 0));
  return {
    id: String(x.id), requestNo: x.requestNo, stage, status: x.status === 'cancelled' ? 'cancelled' : STATUS_BY_UI[stage] ?? x.status, priority: x.priority ?? 'medium',
    requestDate: d10(x.requestDate), requestedBy: x.requestedBy ?? '—', tank: String(x.tankId), tankLabel: x.tankLabel ?? x.tank ?? '—',
    requestedQty: n(x.requestedQty), quantityUnit: 'لتر', currentLevel: n(x.currentLevel), capacity: n(x.capacity), levelPct: n(x.levelPct), notes: x.notes ?? undefined,
    completedDate: x.completedDate ? d10(x.completedDate) : undefined, deliveredQty: x.deliveredQty ?? undefined,
    newTankLevel: x.newTankLevel ?? undefined, newLevelPct: x.newLevelPct ?? undefined,
    stageData: {
      po: sd.po ? { supplierId: sd.po.supplierId ?? undefined, supplier: sd.po.supplier ?? '', poNumber: sd.po.poNumber ?? '', poDate: d10(sd.po.poDate), poQty: n(sd.po.poQty), unitPrice: n(sd.po.unitPrice), totalAmount: n(sd.po.totalAmount), supplierContact: sd.po.supplierContact } : undefined,
      payment: sd.payment ? { amount: n(sd.payment.amount), date: d10(sd.payment.date), method: sd.payment.method ?? '', reference: sd.payment.reference ?? '' } : undefined,
      collection: sd.collection ? { tankerPlate: sd.collection.tankerPlate ?? '', driverName: sd.collection.driverName ?? '', vehicleId: sd.collection.vehicleId ? String(sd.collection.vehicleId) : undefined,
        collectionDate: d10(sd.collection.collectionDate), meterBefore: n(sd.collection.meterBefore), meterAfter: sd.collection.meterAfter != null ? n(sd.collection.meterAfter) : n(sd.collection.meterBefore) + n(sd.collection.collectedQty) } : undefined,
      invoice: sd.invoice ? { invoiceNumber: sd.invoice.invoiceNumber ?? '', invoiceDate: d10(sd.invoice.invoiceDate), amount: n(sd.invoice.amount) } : undefined,
      schedule: sd.schedule ? { deliveryDate: d10(sd.schedule.deliveryDate), deliveryTime: sd.schedule.deliveryTime ?? '', civilDefenseConfirmed: !!sd.schedule.civilDefenseConfirmed, civilDefenseRef: sd.schedule.civilDefenseRef } : undefined,
      refill: sd.refill ? { refillDate: d10(sd.refill.refillDate), refillTime: sd.refill.refillTime ?? '', tankMeterBefore: n(sd.refill.tankMeterBefore), tankMeterAfter: n(sd.refill.tankMeterAfter), driverName: sd.refill.driverName ?? '', tankerPlate: sd.refill.tankerPlate ?? '' } : undefined,
      approval: sd.approval ? { approvedBy: sd.approval.approvedBy ?? '', approvalDate: d10(sd.approval.approvalDate), notes: sd.approval.notes } : undefined,
    },
  };
}

export interface RefillStageData {
  po?: { supplierId?: number; supplier: string; poNumber: string; poDate: string; poQty: number; unitPrice: number; totalAmount: number; supplierContact?: string; };
  payment?: { amount: number; date: string; method: string; reference: string; };
  collection?: { tankerPlate: string; driverName: string; driverPhone?: string; vehicleId?: string; collectionDate: string; meterBefore: number; meterAfter: number; };
  invoice?: { invoiceNumber: string; invoiceDate: string; amount: number; };
  schedule?: { deliveryDate: string; deliveryTime: string; civilDefenseConfirmed: boolean; civilDefenseRef?: string; };
  refill?: { refillDate: string; refillTime: string; tankMeterBefore: number; tankMeterAfter: number; driverName: string; tankerPlate: string; };
  approval?: { approvedBy: string; approvalDate: string; notes?: string; };
}
export interface RefillRequestItem {
  id: string; requestNo?: string; stage: number; status: string; priority: string;
  requestDate: string; requestedBy: string; tank: string; tankLabel: string;
  requestedQty: number; quantityUnit: string;
  currentLevel: number; capacity: number; levelPct: number; notes?: string;
  stageData: RefillStageData;
  completedDate?: string; deliveredQty?: number; newTankLevel?: number; newLevelPct?: number;
}

const STAGES = [
  { title: 'طلب التعبئة',    icon: <FileTextOutlined />,         desc: 'الكمية المطلوبة والخزان المستهدف',         color: PRIMARY },
  { title: 'أمر الشراء',     icon: <ShoppingOutlined />,          desc: 'اختيار المورد وإصدار أمر الشراء',         color: '#1677ff' },
  { title: 'الدفع للمورد',   icon: <DollarOutlined />,            desc: 'تسجيل عملية الدفع للمورد',                color: '#52c41a' },
  { title: 'استلام الغاز',   icon: <CarOutlined />,               desc: 'الصهريج يستلم الغاز من المورد + قراءات العداد', color: '#fa8c16' },
  { title: 'فاتورة الشراء',  icon: <FileProtectOutlined />,       desc: 'إصدار وتسجيل فاتورة الشراء',              color: '#722ed1' },
  { title: 'جدولة التوصيل',  icon: <CalendarOutlined />,          desc: 'تحديد موعد التعبئة + تأكيد الدفاع المدني', color: '#13c2c2' },
  { title: 'تعبئة الخزان',   icon: <FireOutlined />,              desc: 'قراءة خزان المبنى قبل وبعد التعبئة',      color: '#eb2f96' },
  { title: 'موافقة الإدارة', icon: <SafetyCertificateOutlined />, desc: 'الاعتماد النهائي من الإدارة',             color: '#fa541c' },
  { title: 'مكتمل',           icon: <CheckOutlined />,             desc: 'تم تحديث مستوى الخزان',                   color: '#52c41a' },
];

const STATUS_MAP: Record<number, string> = {
  0: 'requested', 1: 'po_issued', 2: 'paid', 3: 'collecting',
  4: 'invoiced',  5: 'scheduled', 6: 'delivering', 7: 'pending_approval', 8: 'completed',
};

interface Props {
  open: boolean;
  request: RefillRequestItem | null;
  onClose: () => void;
  onUpdate: (r: RefillRequestItem) => void;
  /** Save every stage to the API (POST /refill-requests/{id}/…). Without it the drawer works on local data only. */
  live?: boolean;
}

export const RefillRequestDrawer: React.FC<Props> = ({ open, request, onClose, onUpdate, live }) => {
  const [form] = Form.useForm();
  const [completing, setCompleting] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [vendors, setVendors] = useState<{ id: number; name: string; phone?: string; code?: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: number; plateNo: string; capacityLitres?: number; isActive: boolean; vendorId?: number | null }[]>([]);
  const [vendorKey, setVendorKey] = useState(0);
  const [newVendorOpen, setNewVendorOpen] = useState(false);
  const [vendorForm] = Form.useForm();
  const [tankerOwner, setTankerOwner] = useState<'supplier' | 'own'>('supplier');
  useEffect(() => {
    if (!live || !open) return;
    // gas suppliers are third parties: never our own company or the Civil Defense payee
    const third = (r: any[]) => r.filter(v => v.code !== 'OWN-COMPANY' && v.code !== 'CIVIL-DEFENSE');
    api<any[]>('/vendors/options', { query: { type: 'gas_supplier' } })
      .then(r => (third(r).length ? third(r) : api<any[]>('/vendors/options').then(third)))
      .then(setVendors).catch(() => setVendors([]));
    api<{ items: any[] }>('/vehicles', { query: { pageSize: 0 } }).then(r => setVehicles(r.items)).catch(() => setVehicles([]));
  }, [live, open, vendorKey]);

  const addVendor = async () => {
    const v = await vendorForm.validateFields();
    try {
      const types = await api<{ id: number; code: string }[]>('/lookups/VENDOR_TYPE');
      const created = await api<any>('/vendors', { method: 'POST', body: { nameAr: v.nameAr, nameEn: v.nameEn || null, phone: v.phone || null, email: v.email || null, trn: v.trn || null, isActive: true, vendorTypeId: types.find(t => t.code === 'gas_supplier')?.id ?? types[0]?.id } });
      message.success('تمت إضافة المورد');
      setNewVendorOpen(false);
      setVendorKey(k => k + 1);
      if (created?.id) form.setFieldsValue({ vendorId: created.id, supplierContact: v.phone });
    } catch (e) { message.error(errorMessage(e), 6); }
  };

  if (!request) return null;
  const cur = request.stage;
  const sd  = request.stageData;

  const handleComplete = async () => {
    try {
      const vals = await form.validateFields();
      setCompleting(true);
      if (live) {
        const id = request.id;
        const post = (path: string, body: any) => api(`/refill-requests/${id}/${path}`, { method: 'POST', body });
        if (cur === 1) await post('po', { vendorId: vals.vendorId, poNumber: vals.poNumber || null, poDate: vals.poDate || null, qty: vals.poQty, unitPrice: vals.unitPrice });
        if (cur === 2) await post('payment', { amount: vals.amount, date: vals.date, method: vals.method, reference: vals.reference });
        if (cur === 3) await post('collection', {
          vehicleId: vals.vehicleId ? Number(vals.vehicleId) : null, tankerPlate: vals.tankerPlate, driverName: vals.driverName, driverPhone: vals.driverPhone || null, ownVehicle: tankerOwner === 'own',
          collectionDate: vals.collectionDate, meterBefore: vals.meterBefore, meterAfter: vals.meterAfter,
        });
        if (cur === 4) await post('purchase-invoice', { invoiceNumber: vals.invoiceNumber, invoiceDate: vals.invoiceDate, amount: vals.amount, vatRate: vals.vatRate ?? 5 });
        if (cur === 5) await post('schedule', { deliveryDate: vals.deliveryDate, timeSlot: vals.deliveryTime, civilDefenseConfirmed: !!vals.civilDefenseConfirmed, civilDefenseRef: vals.civilDefenseRef || null });
        if (cur === 6 && sd.schedule && !sd.schedule.civilDefenseConfirmed) {
          // the tank cannot be refilled before Civil Defense confirms — record the confirmation on the schedule first
          await post('schedule', { deliveryDate: sd.schedule.deliveryDate, timeSlot: sd.schedule.deliveryTime || null, civilDefenseConfirmed: true, civilDefenseRef: vals.civilDefenseRef || null });
        }
        if (cur === 6) await post('refill', {
          refillDate: vals.refillDate, refillTime: vals.refillTime, tankerPlate: vals.tankerPlate, driverName: vals.driverName, driverPhone: vals.driverPhone || null,
          levelBefore: vals.tankMeterBefore, levelAfter: vals.tankMeterAfter,
        });
        if (cur === 7) await post('approve', { notes: vals.notes || null });
        const fresh = mapLiveRefill(await api<any>(`/refill-requests/${id}`));
        onUpdate(fresh);
        form.resetFields();
        setCompleting(false);
        if (fresh.stage >= 8) { message.success('تم اكتمال طلب التعبئة بنجاح'); onClose(); }
        else message.success('تم حفظ المرحلة');
        return;
      }
      await new Promise(r => setTimeout(r, 350));
      const newSd: RefillStageData = { ...sd };
      if (cur === 1) newSd.po = vals;
      if (cur === 2) newSd.payment = vals;
      if (cur === 3) {
        const vehicle = FLEET_VEHICLES.find(v => v.id === vals.vehicleId);
        newSd.collection = {
          ...vals,
          tankerPlate: vals.tankerPlate || vehicle?.plate || '',
          driverName: vals.driverName || vehicle?.driver || '',
          driverPhone: vals.driverPhone || vehicle?.driverPhone || '',
          vehicleId: vals.vehicleId,
        };
      }
      if (cur === 4) newSd.invoice = vals;
      if (cur === 5) newSd.schedule = vals;
      if (cur === 6) newSd.refill = vals;
      if (cur === 7) newSd.approval = vals;
      const newStage = cur + 1;
      const done = newStage >= 9;
      let deliveredQty = request.deliveredQty;
      let newTankLevel = request.newTankLevel;
      let newLevelPct  = request.newLevelPct;
      if (cur === 7 && newSd.refill) {
        deliveredQty = newSd.refill.tankMeterAfter - newSd.refill.tankMeterBefore;
        newTankLevel = newSd.refill.tankMeterAfter;
        newLevelPct  = Math.round((newTankLevel / request.capacity) * 100);
      }
      onUpdate({
        ...request,
        stage: newStage,
        status: STATUS_MAP[newStage] || 'completed',
        stageData: newSd,
        ...(done ? { completedDate: dayjs().format('YYYY-MM-DD'), deliveredQty, newTankLevel, newLevelPct } : {}),
      });
      form.resetFields();
      setCompleting(false);
      if (done) { message.success('تم اكتمال طلب التعبئة بنجاح'); onClose(); }
    } catch (e: any) {
      setCompleting(false);
      if (e && !e.errorFields) message.error(errorMessage(e), 6);
    }
  };

  const summary = (idx: number) => {
    if (idx === 0) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="الخزان">{request.tankLabel}</Descriptions.Item>
        <Descriptions.Item label="الكمية المطلوبة">{request.requestedQty.toLocaleString()} {request.quantityUnit}</Descriptions.Item>
        <Descriptions.Item label="تاريخ الطلب">{request.requestDate}</Descriptions.Item>
        <Descriptions.Item label="طلب بواسطة">{request.requestedBy}</Descriptions.Item>
        {request.notes && <Descriptions.Item label="ملاحظات" span={2}>{request.notes}</Descriptions.Item>}
      </Descriptions>
    );
    if (idx === 1 && sd.po) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="المورد">{sd.po.supplier}</Descriptions.Item>
        <Descriptions.Item label="رقم أمر الشراء">{sd.po.poNumber}</Descriptions.Item>
        <Descriptions.Item label="تاريخ الطلب">{sd.po.poDate}</Descriptions.Item>
        <Descriptions.Item label="الكمية">{sd.po.poQty.toLocaleString()} {request.quantityUnit}</Descriptions.Item>
        <Descriptions.Item label="سعر الوحدة">{sd.po.unitPrice} درهم</Descriptions.Item>
        <Descriptions.Item label="الإجمالي"><Text style={{ color: PRIMARY, fontWeight: 700 }}>{sd.po.totalAmount.toLocaleString()} درهم</Text></Descriptions.Item>
      </Descriptions>
    );
    if (idx === 2 && sd.payment) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="المبلغ المدفوع"><Text style={{ color: '#52c41a', fontWeight: 700 }}>{sd.payment.amount.toLocaleString()} درهم</Text></Descriptions.Item>
        <Descriptions.Item label="تاريخ الدفع">{sd.payment.date}</Descriptions.Item>
        <Descriptions.Item label="طريقة الدفع">{METHOD_LABEL[sd.payment.method] ?? sd.payment.method}</Descriptions.Item>
        <Descriptions.Item label="رقم المرجع">{sd.payment.reference}</Descriptions.Item>
      </Descriptions>
    );
    if (idx === 3 && sd.collection) {
      const fleet = FLEET_VEHICLES.find(v => v.id === sd.collection!.vehicleId);
      return (
        <div>
          {fleet && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#e8f5e9', borderRadius: 8, border: '1.5px solid #b7eb8f', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CarOutlined style={{ color: PRIMARY, fontSize: 18 }} />
              <div>
                <Text strong style={{ color: PRIMARY }}>{fleet.plate}</Text>
                <Text style={{ marginRight: 8, fontSize: 12 }}>{fleet.type} — {fleet.capacity.toLocaleString()} {fleet.unit}</Text>
              </div>
              <Tag color="green" style={{ marginRight: 'auto' }}>من الأسطول</Tag>
            </div>
          )}
          <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
            <Descriptions.Item label="لوحة الصهريج">{sd.collection.tankerPlate}</Descriptions.Item>
            <Descriptions.Item label="السائق">{sd.collection.driverName}</Descriptions.Item>
            {sd.collection.driverPhone && <Descriptions.Item label="هاتف السائق">{sd.collection.driverPhone}</Descriptions.Item>}
            <Descriptions.Item label="تاريخ الاستلام">{sd.collection.collectionDate}</Descriptions.Item>
            <Descriptions.Item label="الكمية المستلمة"><Text style={{ color: '#fa8c16', fontWeight: 700 }}>{(sd.collection.meterAfter - sd.collection.meterBefore).toLocaleString()} {request.quantityUnit}</Text></Descriptions.Item>
            <Descriptions.Item label="عداد الصهريج قبل">{sd.collection.meterBefore.toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="عداد الصهريج بعد">{sd.collection.meterAfter.toLocaleString()}</Descriptions.Item>
          </Descriptions>
        </div>
      );
    }
    if (idx === 4 && sd.invoice) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="رقم الفاتورة">{sd.invoice.invoiceNumber}</Descriptions.Item>
        <Descriptions.Item label="تاريخ الفاتورة">{sd.invoice.invoiceDate}</Descriptions.Item>
        <Descriptions.Item label="مبلغ الفاتورة"><Text style={{ color: '#722ed1', fontWeight: 700 }}>{sd.invoice.amount.toLocaleString()} درهم</Text></Descriptions.Item>
      </Descriptions>
    );
    if (idx === 5 && sd.schedule) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="تاريخ التوصيل">{sd.schedule.deliveryDate}</Descriptions.Item>
        <Descriptions.Item label="وقت التوصيل">{sd.schedule.deliveryTime}</Descriptions.Item>
        <Descriptions.Item label="الدفاع المدني">
          <Tag color={sd.schedule.civilDefenseConfirmed ? 'green' : 'orange'}>
            {sd.schedule.civilDefenseConfirmed ? '✓ مؤكد' : 'قيد الانتظار'}
          </Tag>
        </Descriptions.Item>
        {sd.schedule.civilDefenseRef && <Descriptions.Item label="رقم التأكيد">{sd.schedule.civilDefenseRef}</Descriptions.Item>}
      </Descriptions>
    );
    if (idx === 6 && sd.refill) {
      const qty = sd.refill.tankMeterAfter - sd.refill.tankMeterBefore;
      return (
        <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
          <Descriptions.Item label="تاريخ التعبئة">{sd.refill.refillDate}</Descriptions.Item>
          <Descriptions.Item label="الوقت">{sd.refill.refillTime}</Descriptions.Item>
          <Descriptions.Item label="لوحة الصهريج">{sd.refill.tankerPlate}</Descriptions.Item>
          <Descriptions.Item label="السائق">{sd.refill.driverName}</Descriptions.Item>
          <Descriptions.Item label="قراءة الخزان قبل">{sd.refill.tankMeterBefore.toLocaleString()} {request.quantityUnit}</Descriptions.Item>
          <Descriptions.Item label="قراءة الخزان بعد">{sd.refill.tankMeterAfter.toLocaleString()} {request.quantityUnit}</Descriptions.Item>
          <Descriptions.Item label="الكمية المضافة" span={2}><Text style={{ color: '#eb2f96', fontWeight: 700 }}>{qty.toLocaleString()} {request.quantityUnit}</Text></Descriptions.Item>
        </Descriptions>
      );
    }
    if (idx === 7 && sd.approval) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="اعتمد بواسطة">{sd.approval.approvedBy}</Descriptions.Item>
        <Descriptions.Item label="تاريخ الاعتماد">{sd.approval.approvalDate}</Descriptions.Item>
        {sd.approval.notes && <Descriptions.Item label="ملاحظات" span={2}>{sd.approval.notes}</Descriptions.Item>}
      </Descriptions>
    );
    if (idx === 8) return (
      <Descriptions size="small" column={2} style={{ direction: 'rtl' }}>
        <Descriptions.Item label="تاريخ الاكتمال">{request.completedDate}</Descriptions.Item>
        <Descriptions.Item label="الكمية المسلمة"><Text style={{ color: '#52c41a', fontWeight: 700 }}>{request.deliveredQty?.toLocaleString()} {request.quantityUnit}</Text></Descriptions.Item>
        <Descriptions.Item label="مستوى الخزان الجديد">{request.newTankLevel?.toLocaleString()} {request.quantityUnit}</Descriptions.Item>
        <Descriptions.Item label="نسبة الامتلاء">{request.newLevelPct}%</Descriptions.Item>
      </Descriptions>
    );
    return null;
  };

  const stageForm = (idx: number) => {
    if (idx === 0) return (
      <>
        {summary(0)}
        <div style={{ marginTop: 14 }}>
          <Button type="primary" onClick={handleComplete} loading={completing} style={{ background: PRIMARY }}>
            الانتقال إلى مرحلة أمر الشراء ←
          </Button>
        </div>
      </>
    );
    if (idx === 1) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}>{live ? (
            <Form.Item name="vendorId" label="المورد" rules={[{ required: true, message: 'اختر المورد' }]}>
              <Select showSearch optionFilterProp="label" placeholder="اختر المورد (طرف ثالث)..." notFoundContent="لا يوجد موردون — أضف مورداً"
                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                onChange={(id: number) => form.setFieldsValue({ supplierContact: vendors.find(v => v.id === id)?.phone })}
                dropdownRender={menu => (<>{menu}<div style={{ borderTop: '1px solid #f0f0f0', padding: 6 }}>
                  <Button type="link" size="small" onClick={() => { vendorForm.resetFields(); setNewVendorOpen(true); }}>+ إضافة مورد جديد</Button></div></>)} />
            </Form.Item>
          ) : <Form.Item name="supplier" label="اسم المورد" rules={[{ required: true, message: '' }]}><Input placeholder="مثال: EMGAS" /></Form.Item>}</Col>
          <Col span={12}><Form.Item name="poNumber" label="رقم أمر الشراء" rules={[{ required: true, message: '' }]}><Input placeholder="PO-2026-XXXX" /></Form.Item></Col>
          <Col span={12}><Form.Item name="poDate" label="تاريخ الطلب" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="poQty" label={`الكمية (${request.quantityUnit})`} initialValue={request.requestedQty} rules={[{ required: true, message: 'الكمية مطلوبة' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="unitPrice" label="سعر الوحدة (درهم)" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          {!live && <Col span={12}><Form.Item name="totalAmount" label="المبلغ الإجمالي (درهم)" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>}
          <Col span={24}><Form.Item name="supplierContact" label="جهة الاتصال بالمورد"><Input placeholder="اختياري" /></Form.Item></Col>
        </Row>
      </Form>
    );
    if (idx === 2) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="amount" label="المبلغ المدفوع (درهم)" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="date" label="تاريخ الدفع" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="method" label="طريقة الدفع" rules={[{ required: true, message: '' }]}>
            <Select placeholder="اختر..." options={METHOD_OPTIONS.map(m => ({ value: live ? m.code : m.label, label: m.label }))} />
          </Form.Item></Col>
          <Col span={12}><Form.Item name="reference" label="رقم المرجع / الشيك" rules={[{ required: true, message: '' }]}><Input /></Form.Item></Col>
        </Row>
      </Form>
    );
    if (idx === 3) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={24}>
            {live ? (
              <>
                <Form.Item label="الصهريج تابع لـ" style={{ marginBottom: 8 }}>
                  <Select value={tankerOwner} onChange={(v: 'supplier' | 'own') => { setTankerOwner(v); form.setFieldsValue({ vehicleId: undefined, tankerPlate: undefined }); }}
                    options={[{ value: 'supplier', label: `المورد (طرف ثالث)${sd.po?.supplier ? ` — ${sd.po.supplier}` : ''}` }, { value: 'own', label: 'أسطول الشركة' }]} />
                </Form.Item>
                <Form.Item name="vehicleId" label="اختر الصهريج / المركبة">
                  <Select allowClear placeholder={tankerOwner === 'own' ? 'اختر من أسطول الشركة…' : 'اختر من صهاريج المورد أو اكتب اللوحة أدناه…'}
                    notFoundContent={tankerOwner === 'own' ? 'لا توجد مركبات في الأسطول' : 'لا توجد صهاريج مسجلة لهذا المورد — اكتب اللوحة وستُسجل للمورد'}
                    options={vehicles.filter(v => v.isActive && (tankerOwner === 'own' ? !v.vendorId : v.vendorId === sd.po?.supplierId))
                      .map(v => ({ value: v.id, label: `${v.plateNo}${v.capacityLitres ? ` — ${Number(v.capacityLitres).toLocaleString()} لتر` : ''}` }))}
                    onChange={(id: number) => { const v = vehicles.find(x => x.id === id); if (v) form.setFieldsValue({ tankerPlate: v.plateNo }); }} />
                </Form.Item>
              </>
            ) : (
            <Form.Item name="vehicleId" label="اختر الصهريج / المركبة" rules={[{ required: true, message: 'اختر المركبة' }]}>
              <Select
                placeholder="اختر من أسطول المركبات..."
                onChange={(val) => {
                  const v = FLEET_VEHICLES.find(x => x.id === val);
                  if (v) form.setFieldsValue({ tankerPlate: v.plate, driverName: v.driver, driverPhone: v.driverPhone });
                }}
              >
                {FLEET_VEHICLES.map(v => (
                  <Option key={v.id} value={v.id} disabled={v.status !== 'active'}>
                    <Space>
                      <CarOutlined style={{ color: v.status === 'active' ? '#1a5c2a' : '#aaa' }} />
                      <span style={{ fontWeight: 600 }}>{v.plate}</span>
                      <span style={{ color: '#888', fontSize: 12 }}>{v.type} — {v.capacity.toLocaleString()} {v.unit}</span>
                      {v.status !== 'active' && <Tag color="orange" style={{ fontSize: 10 }}>تحت الصيانة</Tag>}
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
            )}
          </Col>
          <Col span={12}><Form.Item name="tankerPlate" label="لوحة الصهريج" rules={[{ required: true, message: '' }]}><Input placeholder="تعبئة تلقائياً عند الاختيار" /></Form.Item></Col>
          <Col span={12}><Form.Item name="driverName" label="اسم السائق" rules={[{ required: true, message: '' }]}><Input placeholder="تعبئة تلقائياً عند الاختيار" /></Form.Item></Col>
          <Col span={12}><Form.Item name="driverPhone" label="هاتف السائق"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="collectionDate" label="تاريخ الاستلام" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="meterBefore" label="قراءة عداد الصهريج قبل" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="meterAfter" label="قراءة عداد الصهريج بعد" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
      </Form>
    );
    if (idx === 4) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="invoiceNumber" label="رقم الفاتورة" rules={[{ required: true, message: '' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="invoiceDate" label="تاريخ الفاتورة" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="amount" label="المبلغ قبل الضريبة (درهم)" initialValue={sd?.po?.totalAmount || undefined}
            extra="قيمة الغاز بدون ضريبة القيمة المضافة — تُضاف الضريبة تلقائياً" rules={[{ required: true, message: 'المبلغ مطلوب' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="vatRate" label="نسبة الضريبة %" initialValue={5}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const net = Number(getFieldValue('amount') ?? 0); const vat = Math.round(net * Number(getFieldValue('vatRate') ?? 0)) / 100;
              return <Col span={24}><Text type="secondary" style={{ fontSize: 12 }}>الضريبة {vat.toLocaleString()} درهم — إجمالي فاتورة المورد {(net + vat).toLocaleString()} درهم</Text></Col>;
            }}
          </Form.Item>
        </Row>
      </Form>
    );
    if (idx === 5) return (
      <Form form={form} layout="vertical" size="small" initialValues={{ civilDefenseConfirmed: false }}>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="deliveryDate" label="تاريخ التوصيل" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="deliveryTime" label="وقت التوصيل" rules={[{ required: true, message: '' }]}><Input type="time" /></Form.Item></Col>
          <Col span={12}>
            <Form.Item name="civilDefenseConfirmed" label="تأكيد الدفاع المدني" valuePropName="checked">
              <Switch checkedChildren="✓ مؤكد" unCheckedChildren="قيد الانتظار" />
            </Form.Item>
          </Col>
          <Col span={12}><Form.Item name="civilDefenseRef" label="رقم تأكيد الدفاع المدني"><Input placeholder="اختياري" /></Form.Item></Col>
        </Row>
      </Form>
    );
    if (idx === 6) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="refillDate" label="تاريخ التعبئة" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="refillTime" label="وقت التعبئة" rules={[{ required: true, message: '' }]}><Input type="time" /></Form.Item></Col>
          <Col span={12}><Form.Item name="tankerPlate" label="لوحة الصهريج" initialValue={sd.collection?.tankerPlate} rules={[{ required: true, message: '' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="driverName" label="اسم السائق" initialValue={sd.collection?.driverName} rules={[{ required: true, message: '' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="tankMeterBefore" label="قراءة خزان المبنى قبل التعبئة" initialValue={request.currentLevel} rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="tankMeterAfter" label="قراءة خزان المبنى بعد التعبئة" dependencies={['tankMeterBefore']}
            rules={[{ required: true, message: '' }, ({ getFieldValue }) => ({ validator: (_, v) => {
              if (v == null) return Promise.resolve();
              if (v <= Number(getFieldValue('tankMeterBefore') ?? 0)) return Promise.reject(new Error('يجب أن تكون أكبر من القراءة قبل التعبئة'));
              if (request.capacity && v > request.capacity) return Promise.reject(new Error(`تتجاوز سعة الخزان (${request.capacity.toLocaleString()})`));
              return Promise.resolve();
            } })]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          {live && sd.schedule && !sd.schedule.civilDefenseConfirmed && (<>
            <Col span={24}><Alert type="warning" showIcon style={{ marginBottom: 10 }} message="لم يُؤكَّد الدفاع المدني بعد — لا تتم التعبئة قبل التأكيد" /></Col>
            <Col span={12}><Form.Item name="civilDefenseConfirmed" label="تأكيد الدفاع المدني" valuePropName="checked"
              rules={[{ validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('التأكيد مطلوب قبل التعبئة'))) }]}><Switch checkedChildren="مؤكد" unCheckedChildren="قيد الانتظار" /></Form.Item></Col>
            <Col span={12}><Form.Item name="civilDefenseRef" label="رقم تأكيد الدفاع المدني"><Input placeholder="اختياري" /></Form.Item></Col>
          </>)}
        </Row>
      </Form>
    );
    if (idx === 7) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={12}><Form.Item name="approvedBy" label="اعتمد بواسطة" rules={[{ required: true, message: '' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="approvalDate" label="تاريخ الاعتماد" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={24}><Form.Item name="notes" label="ملاحظات الاعتماد"><TextArea rows={3} /></Form.Item></Col>
        </Row>
      </Form>
    );
    return null;
  };

  const progressBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
      {STAGES.map((s, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <React.Fragment key={i}>
            <Tooltip title={`${i + 1}. ${s.title}`}>
              <div style={{
                minWidth: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 13, fontWeight: 700, cursor: 'default', flexShrink: 0,
                background: done ? '#52c41a' : active ? PRIMARY : '#e8e8e8',
                color: done || active ? '#fff' : '#aaa',
                border: active ? `2px solid ${PRIMARY}` : 'none',
                boxShadow: active ? `0 0 0 3px #c8e6c9` : 'none',
              }}>
                {done ? <CheckOutlined style={{ fontSize: 12 }} /> : i + 1}
              </div>
            </Tooltip>
            {i < STAGES.length - 1 && (
              <div style={{ flex: 1, height: 3, minWidth: 8, background: i < cur ? '#52c41a' : '#e8e8e8', borderRadius: 2 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const priorityColors: Record<string, string> = { low: 'default', medium: 'blue', high: 'orange', urgent: 'red' };
  const priorityLabels: Record<string, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل' };
  const statusColors: Record<string, string> = {
    requested: 'orange', po_issued: 'blue', paid: 'cyan', collecting: 'purple',
    invoiced: 'geekblue', scheduled: 'processing', delivering: 'magenta',
    pending_approval: 'gold', completed: 'green',
  };
  const statusLabels: Record<string, string> = {
    requested: 'طلب مقدم', po_issued: 'أمر شراء', paid: 'تم الدفع', collecting: 'استلام الغاز',
    invoiced: 'تم الإفوترة', scheduled: 'مجدول', delivering: 'قيد التوصيل',
    pending_approval: 'انتظار الموافقة', completed: 'مكتمل',
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={() => setExitConfirm(true)}
        title={
          <Space wrap>
            <FireOutlined style={{ color: '#fa8c16' }} />
            <span style={{ fontWeight: 700 }}>طلب تعبئة</span>
            <Tag style={{ fontFamily: 'monospace', fontSize: 12 }}>{request.requestNo ?? request.id}</Tag>
            <Tag color={statusColors[request.status]}>{statusLabels[request.status]}</Tag>
            <Tag color={priorityColors[request.priority]}>{priorityLabels[request.priority]}</Tag>
          </Space>
        }
        width={Math.min(typeof window !== 'undefined' ? window.innerWidth - 40 : 860, 860)}
        styles={{ body: { padding: '20px 24px', background: '#f5f7fa' } }}
        footer={
          cur < 9 && cur > 0 ? (
            <Space>
              <Button type="primary" onClick={handleComplete} loading={completing} style={{ background: PRIMARY }}>
                {cur === 7 ? '✓ اعتماد واكتمال الطلب' : 'إتمام هذه المرحلة ←'}
              </Button>
              <Button onClick={() => setExitConfirm(true)}>إغلاق</Button>
            </Space>
          ) : (
            <Button onClick={() => setExitConfirm(true)}>إغلاق</Button>
          )
        }
      >
        {progressBar}
        <div style={{ marginBottom: 12, fontSize: 12, color: '#888' }}>
          المرحلة الحالية: <Text strong style={{ color: PRIMARY }}>{STAGES[Math.min(cur, 8)].title}</Text>
          {' '}({Math.min(cur + 1, 9)} / {STAGES.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STAGES.map((stage, idx) => {
            const done   = idx < cur;
            const active = idx === cur;
            const future = idx > cur;
            return (
              <Card key={idx} size="small" bordered={false}
                style={{
                  borderRadius: 10,
                  border: active ? `2px solid ${PRIMARY}` : done ? '1.5px solid #b7eb8f' : '1px solid #eee',
                  background: active ? '#f0f7f2' : done ? '#f6ffed' : '#fafafa',
                  opacity: future ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 13, flexShrink: 0,
                      background: done ? '#52c41a' : active ? PRIMARY : '#d9d9d9',
                      color: done || active ? '#fff' : '#999',
                    }}>
                      {done ? <CheckOutlined /> : future ? <LockOutlined /> : stage.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13, color: future ? '#aaa' : active ? PRIMARY : '#333' }}>
                        {idx + 1}. {stage.title}
                      </Text>
                      <div style={{ fontSize: 11, color: '#999' }}>{stage.desc}</div>
                    </div>
                    {done   && <Tag color="green"      style={{ fontSize: 11, marginInlineStart: 'auto' }}>✓ مكتملة</Tag>}
                    {active && <Tag color="processing" style={{ fontSize: 11, marginInlineStart: 'auto' }}>← الآن</Tag>}
                  </div>
                }
              >
                {done   && summary(idx)}
                {active && stageForm(idx)}
                {future && <Text type="secondary" style={{ fontSize: 12 }}><LockOutlined style={{ marginInlineEnd: 6 }} />متاحة بعد اكتمال المرحلة السابقة</Text>}
              </Card>
            );
          })}
        </div>
      </Drawer>
      <Modal open={newVendorOpen} title="مورد غاز جديد (طرف ثالث)" okText="إضافة" cancelText="إلغاء" onOk={addVendor} onCancel={() => setNewVendorOpen(false)} destroyOnClose>
        <Form form={vendorForm} layout="vertical">
          <Form.Item name="nameAr" label="اسم المورد" rules={[{ required: true, message: 'مطلوب' }]}><Input /></Form.Item>
          <Form.Item name="nameEn" label="الاسم بالإنجليزية"><Input dir="ltr" /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="البريد"><Input dir="ltr" /></Form.Item></Col>
            <Col span={12}><Form.Item name="trn" label="الرقم الضريبي"><Input dir="ltr" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
      <Modal open={exitConfirm} onCancel={() => setExitConfirm(false)} footer={null} width={380} centered closable={false}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fa8c16', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <ExclamationCircleOutlined style={{ color: '#fff', fontSize: 22 }} />
          </div>
          <Title level={5} style={{ margin: '0 0 8px' }}>إغلاق تفاصيل الطلب؟</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>التقدم محفوظ — يمكنك العودة لاستكمال المراحل المتبقية في أي وقت.</Text>
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Button danger onClick={() => { setExitConfirm(false); onClose(); }}>إغلاق</Button>
            <Button type="primary" style={{ background: PRIMARY }} onClick={() => setExitConfirm(false)}>متابعة</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

interface NewRefillModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (r: RefillRequestItem) => void;
  tanks: Array<{ id: string; label: string; currentLevel: number; capacity: number; levelPct: number; unit?: string; }>;
  /** Live mode: create the request through the API (POST /refill-requests) instead of a local record. */
  onCreate?: (v: { tankId: number; requestedQty: number; priority: string; requestDate?: string; notes?: string }) => Promise<void>;
}

export const NewRefillRequestModal: React.FC<NewRefillModalProps> = ({ open, onClose, onSave, tanks, onCreate }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const vals = await form.validateFields();
      setSubmitting(true);
      if (onCreate) {
        try {
          await onCreate({ tankId: Number(vals.tank), requestedQty: vals.requestedQty, priority: vals.priority, requestDate: vals.requestDate || undefined, notes: vals.notes || undefined });
          form.resetFields();
          message.success('تم إنشاء طلب التعبئة بنجاح');
        } catch (e) { message.error(errorMessage(e), 6); }
        setSubmitting(false);
        return;
      }
      await new Promise(r => setTimeout(r, 300));
      const tank = tanks.find(t => t.id === vals.tank);
      const id = `RFR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      onSave({
        id, stage: 0, status: 'requested',
        priority: vals.priority,
        requestDate: vals.requestDate || dayjs().format('YYYY-MM-DD'),
        requestedBy: 'مدير المبنى',
        tank: vals.tank,
        tankLabel: tank?.label || vals.tank,
        requestedQty: vals.requestedQty,
        quantityUnit: tank?.unit || 'لتر',
        currentLevel: tank?.currentLevel || 0,
        capacity: tank?.capacity || 0,
        levelPct: tank?.levelPct || 0,
        notes: vals.notes,
        stageData: {},
      });
      form.resetFields();
      setSubmitting(false);
      message.success('تم إنشاء طلب التعبئة بنجاح');
    } catch { setSubmitting(false); }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={<Space><FireOutlined style={{ color: '#fa8c16' }} /><span>طلب تعبئة جديد</span></Space>}
      onOk={handleOk}
      okText="إنشاء الطلب"
      cancelText="إلغاء"
      okButtonProps={{ loading: submitting, style: { background: PRIMARY } }}
      width={720}
      centered
    >
      <div style={{ background: '#f6faf7', border: '1px solid #e3efe6', borderRadius: 10, padding: '14px 6px 6px', marginTop: 12 }}>
        <Steps size="small" labelPlacement="vertical" current={0}
          items={STAGES.map(s => ({ title: <span style={{ fontSize: 10.5, whiteSpace: 'nowrap' }}>{s.title}</span> }))} />
      </div>
      <Alert type="info" showIcon style={{ margin: '12px 0 0', fontSize: 12 }}
        message={<span><Text strong>المرحلة 1 — طلب التعبئة:</Text> اختر الخزان والكمية. بعد الإنشاء تُفتح مراحل الطلب لمتابعتها: أمر الشراء ← الدفع للمورد ← استلام الغاز ← فاتورة الشراء ← جدولة التوصيل ← تعبئة الخزان ← موافقة الإدارة.</span>} />
      <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}
        initialValues={{ priority: 'medium', requestDate: dayjs().format('YYYY-MM-DD') }}>
        <Form.Item name="tank" label="الخزان" rules={[{ required: true, message: 'اختر الخزان' }]}>
          <Select placeholder="اختر الخزان..." notFoundContent={onCreate ? 'لا توجد خزانات لهذا المبنى — أضف خزاناً أولاً' : undefined}
            onChange={(id: string) => { const t = tanks.find(x => x.id === id); if (t && onCreate && !form.getFieldValue('requestedQty')) form.setFieldsValue({ requestedQty: Math.max(0, Math.round(t.capacity - t.currentLevel)) }); }}>
            {tanks.length > 0 ? tanks.map(t => (
              <Option key={t.id} value={t.id}>
                {t.label} — {t.levelPct}% ({t.currentLevel.toLocaleString()} {t.unit || 'لتر'})
              </Option>
            )) : onCreate ? null : (
              <Option value="main-tank">الخزان الرئيسي</Option>
            )}
          </Select>
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="requestedQty" label="الكمية المطلوبة" rules={[{ required: true, message: '' }]}>
              <InputNumber min={1} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="priority" label="الأولوية">
              <Select>
                <Option value="low">منخفض</Option>
                <Option value="medium">متوسط</Option>
                <Option value="high">عالي</Option>
                <Option value="urgent">عاجل</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="requestDate" label="تاريخ الطلب">
              <Input type="date" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="ملاحظات">
          <TextArea rows={2} placeholder="اختياري" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RefillRequestDrawer;
