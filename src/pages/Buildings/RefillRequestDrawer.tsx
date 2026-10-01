import React, { useState } from 'react';
import {
  Drawer, Form, Input, InputNumber, Select, Button, Space, Typography,
  Tag, Row, Col, Card, Switch, Descriptions, Modal, message, Tooltip,
} from 'antd';
import {
  FileTextOutlined, ShoppingOutlined, DollarOutlined, CarOutlined,
  FileProtectOutlined, CalendarOutlined, FireOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined, LockOutlined, CheckOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';

export interface RefillStageData {
  po?: { supplier: string; poNumber: string; poDate: string; poQty: number; unitPrice: number; totalAmount: number; supplierContact?: string; };
  payment?: { amount: number; date: string; method: string; reference: string; };
  collection?: { tankerPlate: string; driverName: string; driverPhone?: string; vehicleId?: string; collectionDate: string; meterBefore: number; meterAfter: number; };
  invoice?: { invoiceNumber: string; invoiceDate: string; amount: number; };
  schedule?: { deliveryDate: string; deliveryTime: string; civilDefenseConfirmed: boolean; civilDefenseRef?: string; };
  refill?: { refillDate: string; refillTime: string; tankMeterBefore: number; tankMeterAfter: number; driverName: string; tankerPlate: string; };
  approval?: { approvedBy: string; approvalDate: string; notes?: string; };
}
export interface RefillRequestItem {
  id: string; stage: number; status: string; priority: string;
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
}

export const RefillRequestDrawer: React.FC<Props> = ({ open, request, onClose, onUpdate }) => {
  const [form] = Form.useForm();
  const [completing, setCompleting] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);

  if (!request) return null;
  const cur = request.stage;
  const sd  = request.stageData;

  const handleComplete = async () => {
    try {
      const vals = await form.validateFields();
      setCompleting(true);
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
        ...(done ? { completedDate: new Date().toISOString().split('T')[0], deliveredQty, newTankLevel, newLevelPct } : {}),
      });
      form.resetFields();
      setCompleting(false);
      if (done) { message.success('تم اكتمال طلب التعبئة بنجاح'); onClose(); }
    } catch { setCompleting(false); }
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
        <Descriptions.Item label="طريقة الدفع">{sd.payment.method}</Descriptions.Item>
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
          <Col span={12}><Form.Item name="supplier" label="اسم المورد" rules={[{ required: true, message: '' }]}><Input placeholder="مثال: EMGAS" /></Form.Item></Col>
          <Col span={12}><Form.Item name="poNumber" label="رقم أمر الشراء" rules={[{ required: true, message: '' }]}><Input placeholder="PO-2026-XXXX" /></Form.Item></Col>
          <Col span={12}><Form.Item name="poDate" label="تاريخ الطلب" rules={[{ required: true, message: '' }]}><Input type="date" /></Form.Item></Col>
          <Col span={12}><Form.Item name="poQty" label={`الكمية (${request.quantityUnit})`} rules={[{ required: true, message: '' }]}><InputNumber min={1} style={{ width: '100%' }} defaultValue={request.requestedQty} /></Form.Item></Col>
          <Col span={12}><Form.Item name="unitPrice" label="سعر الوحدة (درهم)" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={12}><Form.Item name="totalAmount" label="المبلغ الإجمالي (درهم)" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
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
            <Select placeholder="اختر...">
              <Option value="تحويل بنكي">تحويل بنكي</Option>
              <Option value="شيك">شيك</Option>
              <Option value="نقداً">نقداً</Option>
              <Option value="بطاقة ائتمان">بطاقة ائتمان</Option>
            </Select>
          </Form.Item></Col>
          <Col span={12}><Form.Item name="reference" label="رقم المرجع / الشيك" rules={[{ required: true, message: '' }]}><Input /></Form.Item></Col>
        </Row>
      </Form>
    );
    if (idx === 3) return (
      <Form form={form} layout="vertical" size="small">
        <Row gutter={12}>
          <Col span={24}>
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
          <Col span={12}><Form.Item name="amount" label="مبلغ الفاتورة (درهم)" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
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
          <Col span={12}><Form.Item name="tankMeterAfter" label="قراءة خزان المبنى بعد التعبئة" rules={[{ required: true, message: '' }]}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
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
            <Tag style={{ fontFamily: 'monospace', fontSize: 12 }}>{request.id}</Tag>
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
}

export const NewRefillRequestModal: React.FC<NewRefillModalProps> = ({ open, onClose, onSave, tanks }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const vals = await form.validateFields();
      setSubmitting(true);
      await new Promise(r => setTimeout(r, 300));
      const tank = tanks.find(t => t.id === vals.tank);
      const id = `RFR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      onSave({
        id, stage: 0, status: 'requested',
        priority: vals.priority,
        requestDate: vals.requestDate || new Date().toISOString().split('T')[0],
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
      width={480}
      centered
    >
      <Form form={form} layout="vertical" size="small" style={{ marginTop: 16 }}
        initialValues={{ priority: 'medium', requestDate: new Date().toISOString().split('T')[0] }}>
        <Form.Item name="tank" label="الخزان" rules={[{ required: true, message: 'اختر الخزان' }]}>
          <Select placeholder="اختر الخزان...">
            {tanks.length > 0 ? tanks.map(t => (
              <Option key={t.id} value={t.id}>
                {t.label} — {t.levelPct}% ({t.currentLevel.toLocaleString()} {t.unit || 'لتر'})
              </Option>
            )) : (
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
