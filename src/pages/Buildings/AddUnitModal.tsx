import React, { useState } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Button, Table, Radio,
  Row, Col, Divider, Space, Typography, Tag, Tooltip, message,
  Switch, Tabs, Badge
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, HomeOutlined, AppstoreAddOutlined,
  SettingOutlined, CopyOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { Option } = Select;
const PRIMARY = '#1a5c2a';
const GOLD = '#c9a84c';

interface UnitRow {
  key: string;
  no: string;
  floor: number | null;
  type: string;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rent: number | null;
  notes: string;
}

interface AddUnitModalProps {
  open: boolean;
  onClose: () => void;
  buildingFloors: number;
  existingUnitsCount: number;
  onAdd?: (units: UnitRow[]) => void;
}

const unitTypes = [
  { value: 'apartment', label: 'شقة' },
  { value: 'penthouse', label: 'بنتهاوس' },
  { value: 'studio', label: 'استوديو' },
  { value: 'duplex', label: 'دوبلكس' },
  { value: 'villa', label: 'فيلا' },
  { value: 'commercial', label: 'تجاري' },
];

const statusOptions = [
  { value: 'vacant', label: 'شاغر', color: 'success' },
  { value: 'occupied', label: 'مشغول', color: 'error' },
  { value: 'reserved', label: 'محجوز', color: 'warning' },
  { value: 'maintenance', label: 'صيانة', color: 'default' },
];

const makeKey = () => `unit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyRow = (): UnitRow => ({
  key: makeKey(),
  no: '',
  floor: null,
  type: 'apartment',
  area: null,
  bedrooms: null,
  bathrooms: null,
  rent: null,
  notes: '',
});

const AddUnitModal: React.FC<AddUnitModalProps> = ({
  open,
  onClose,
  buildingFloors,
  existingUnitsCount,
  onAdd,
}) => {
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const doClose = () => { setCloseConfirmOpen(false); onClose(); };
  const handleCloseModal = () => { setCloseConfirmOpen(true); };
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [singleForm] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const [multiRows, setMultiRows] = useState<UnitRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [bulkGenerated, setBulkGenerated] = useState(false);

  const floorOptions = Array.from({ length: buildingFloors }, (_, i) => i + 1);

  // ─── Single Mode Submit ───────────────────────────────────────────
  const handleSingleSave = async () => {
    try {
      const values = await singleForm.validateFields();
      setLoading(true);
      await new Promise(r => setTimeout(r, 600));
      const unit: UnitRow = { key: makeKey(), ...values };
      onAdd?.([unit]);
      message.success('تم إضافة الوحدة بنجاح');
      singleForm.resetFields();
      onClose();
    } catch {
      // validation errors shown inline
    } finally {
      setLoading(false);
    }
  };

  // ─── Multi Rows Save ──────────────────────────────────────────────
  const handleMultiSave = async () => {
    const validRows = multiRows.filter(r => r.no && r.floor !== null);
    if (validRows.length === 0) {
      message.warning('أدخل بيانات وحدة واحدة على الأقل');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    onAdd?.(validRows);
    message.success(`تم إضافة ${validRows.length} وحدة بنجاح`);
    setMultiRows([emptyRow()]);
    setBulkGenerated(false);
    onClose();
  };

  // ─── Bulk Generator ───────────────────────────────────────────────
  const handleGenerate = async () => {
    try {
      const v = await bulkForm.validateFields();
      const rows: UnitRow[] = [];
      for (let fl = v.startFloor; fl <= v.endFloor; fl++) {
        for (let u = 1; u <= v.unitsPerFloor; u++) {
          const unitNum = fl * 100 + u;
          rows.push({
            key: makeKey(),
            no: `${unitNum}`,
            floor: fl,
            type: v.unitType || 'apartment',
            area: v.area || null,
            bedrooms: v.bedrooms || null,
            bathrooms: v.bathrooms || null,
            rent: v.rent || null,
            notes: '',
          });
        }
      }
      setMultiRows(rows);
      setBulkGenerated(true);
      message.success(`تم توليد ${rows.length} وحدة — راجع البيانات قبل الحفظ`);
    } catch {
      // validation
    }
  };

  const updateRow = (key: string, field: keyof UnitRow, value: unknown) => {
    setMultiRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  const removeRow = (key: string) => {
    setMultiRows(prev => prev.filter(r => r.key !== key));
  };

  const addRow = () => setMultiRows(prev => [...prev, emptyRow()]);

  // ─── Table columns for multi-add grid ─────────────────────────────
  const columns = [
    {
      title: '#',
      width: 40,
      render: (_: unknown, __: unknown, idx: number) => (
        <Text type="secondary" style={{ fontSize: 11 }}>{idx + 1}</Text>
      ),
    },
    {
      title: 'رقم الوحدة *',
      dataIndex: 'no',
      width: 110,
      render: (_: unknown, row: UnitRow) => (
        <Input
          size="small"
          placeholder="101"
          value={row.no}
          onChange={e => updateRow(row.key, 'no', e.target.value)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'الطابق *',
      dataIndex: 'floor',
      width: 90,
      render: (_: unknown, row: UnitRow) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          placeholder="—"
          value={row.floor}
          onChange={v => updateRow(row.key, 'floor', v)}
        >
          {floorOptions.map(f => <Option key={f} value={f}>{f}</Option>)}
        </Select>
      ),
    },
    {
      title: 'النوع',
      dataIndex: 'type',
      width: 105,
      render: (_: unknown, row: UnitRow) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={row.type}
          onChange={v => updateRow(row.key, 'type', v)}
        >
          {unitTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
        </Select>
      ),
    },
    {
      title: 'المساحة م²',
      dataIndex: 'area',
      width: 90,
      render: (_: unknown, row: UnitRow) => (
        <InputNumber
          size="small"
          min={10}
          max={2000}
          style={{ width: '100%' }}
          placeholder="120"
          value={row.area ?? undefined}
          onChange={v => updateRow(row.key, 'area', v)}
        />
      ),
    },
    {
      title: 'غرف',
      dataIndex: 'bedrooms',
      width: 65,
      render: (_: unknown, row: UnitRow) => (
        <InputNumber
          size="small"
          min={0}
          max={10}
          style={{ width: '100%' }}
          value={row.bedrooms ?? undefined}
          onChange={v => updateRow(row.key, 'bedrooms', v)}
        />
      ),
    },
    {
      title: 'حمام',
      dataIndex: 'bathrooms',
      width: 65,
      render: (_: unknown, row: UnitRow) => (
        <InputNumber
          size="small"
          min={0}
          max={10}
          style={{ width: '100%' }}
          value={row.bathrooms ?? undefined}
          onChange={v => updateRow(row.key, 'bathrooms', v)}
        />
      ),
    },
    {
      title: 'الإيجار د.إ',
      dataIndex: 'rent',
      width: 110,
      render: (_: unknown, row: UnitRow) => (
        <InputNumber
          size="small"
          min={0}
          formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: '100%' }}
          placeholder="45,000"
          value={row.rent ?? undefined}
          onChange={v => updateRow(row.key, 'rent', v)}
        />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, row: UnitRow) => (
        <Tooltip title="حذف">
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={multiRows.length === 1}
            onClick={() => removeRow(row.key)}
          />
        </Tooltip>
      ),
    },
  ];

  const modalFooter = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Button onClick={handleCloseModal}>إلغاء</Button>
      <Button
        type="primary"
        loading={loading}
        icon={<PlusOutlined />}
        onClick={mode === 'single' ? handleSingleSave : handleMultiSave}
        style={{ background: PRIMARY, borderColor: PRIMARY }}
      >
        {mode === 'single' ? 'إضافة الوحدة' : `حفظ ${multiRows.filter(r => r.no).length} وحدة`}
      </Button>
    </div>
  );

  return (
    <>
    <Modal
      open={open}
      onCancel={handleCloseModal}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${PRIMARY}, #2e7d32)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HomeOutlined style={{ color: '#fff', fontSize: 15 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>إضافة وحدة جديدة</div>
            <div style={{ fontWeight: 400, fontSize: 11, color: '#888', marginTop: 1 }}>
              المبنى · {existingUnitsCount} وحدة حالية
            </div>
          </div>
        </div>
      }
      width={mode === 'single' ? 620 : 960}
      footer={modalFooter}
      destroyOnClose
      style={{ direction: 'rtl' }}
      styles={{ body: { padding: '16px 24px' } }}
      afterClose={() => {
        singleForm.resetFields();
        bulkForm.resetFields();
        setMultiRows([emptyRow()]);
        setBulkGenerated(false);
        setMode('single');
      }}
    >
      {/* ── Mode Toggle ── */}
      <div style={{
        background: '#f5f7fa', borderRadius: 10, padding: '10px 14px',
        marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 13, color: '#555' }}>نوع الإضافة</Text>
        <Radio.Group
          value={mode}
          onChange={e => setMode(e.target.value)}
          buttonStyle="solid"
          size="small"
        >
          <Radio.Button value="single">
            <HomeOutlined style={{ marginInlineEnd: 6 }} />وحدة واحدة
          </Radio.Button>
          <Radio.Button value="multi">
            <AppstoreAddOutlined style={{ marginInlineEnd: 6 }} />وحدات متعددة
          </Radio.Button>
        </Radio.Group>
      </div>

      {/* ════════════ SINGLE MODE ════════════ */}
      {mode === 'single' && (
        <Form
          form={singleForm}
          layout="vertical"
          size="middle"
          initialValues={{ type: 'apartment', status: 'vacant' }}
          style={{ direction: 'rtl' }}
        >
          <Row gutter={[16, 0]}>
            {/* Unit Number */}
            <Col span={8}>
              <Form.Item
                name="no"
                label="رقم الوحدة"
                rules={[{ required: true, message: 'مطلوب' }]}
              >
                <Input placeholder="مثال: 101، A-05" />
              </Form.Item>
            </Col>

            {/* Floor */}
            <Col span={8}>
              <Form.Item
                name="floor"
                label="الطابق"
                rules={[{ required: true, message: 'مطلوب' }]}
              >
                <Select placeholder="اختر الطابق">
                  {floorOptions.map(f => (
                    <Option key={f} value={f}>الطابق {f}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Type */}
            <Col span={8}>
              <Form.Item
                name="type"
                label="نوع الوحدة"
                rules={[{ required: true, message: 'مطلوب' }]}
              >
                <Select>
                  {unitTypes.map(t => (
                    <Option key={t.value} value={t.value}>{t.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Area */}
            <Col span={8}>
              <Form.Item
                name="area"
                label="المساحة (م²)"
                rules={[{ required: true, message: 'مطلوب' }]}
              >
                <InputNumber min={10} max={2000} style={{ width: '100%' }} placeholder="120" addonAfter="م²" />
              </Form.Item>
            </Col>

            {/* Bedrooms */}
            <Col span={8}>
              <Form.Item name="bedrooms" label="غرف النوم">
                <InputNumber min={0} max={10} style={{ width: '100%' }} placeholder="2" />
              </Form.Item>
            </Col>

            {/* Bathrooms */}
            <Col span={8}>
              <Form.Item name="bathrooms" label="الحمامات">
                <InputNumber min={0} max={10} style={{ width: '100%' }} placeholder="1" />
              </Form.Item>
            </Col>

            <Divider style={{ margin: '4px 0 8px', gridColumn: '1/-1' }} />

            {/* Status */}
            <Col span={12}>
              <Form.Item name="status" label="الحالة الأولية">
                <Select>
                  {statusOptions.map(s => (
                    <Option key={s.value} value={s.value}>
                      <Tag color={s.color} style={{ margin: 0 }}>{s.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Rent */}
            <Col span={12}>
              <Form.Item name="rent" label="الإيجار السنوي المتوقع">
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder="45,000"
                  addonAfter="د.إ"
                  formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={v => v ? parseFloat(v.replace(/[^0-9.]/g, '')) : 0}
                />
              </Form.Item>
            </Col>

            {/* Notes */}
            <Col span={24}>
              <Form.Item name="notes" label="ملاحظات">
                <Input.TextArea
                  rows={2}
                  placeholder="أي ملاحظات إضافية عن الوحدة..."
                  maxLength={300}
                  showCount
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      )}

      {/* ════════════ MULTI MODE ════════════ */}
      {mode === 'multi' && (
        <div>
          {/* Bulk Generator Box */}
          <div style={{
            background: `linear-gradient(135deg, ${PRIMARY}08, ${PRIMARY}12)`,
            border: `1px solid ${PRIMARY}30`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <SettingOutlined style={{ color: PRIMARY }} />
              <Text strong style={{ fontSize: 13, color: PRIMARY }}>مولّد الوحدات التلقائي</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>— حدد النطاق وسيتم توليد الوحدات أدناه تلقائياً</Text>
            </div>
            <Form form={bulkForm} layout="inline" size="small" style={{ direction: 'rtl', flexWrap: 'wrap', gap: 4 }}>
              <Form.Item name="startFloor" label="من طابق" rules={[{ required: true }]}>
                <Select style={{ width: 100 }} placeholder="1">
                  {floorOptions.map(f => <Option key={f} value={f}>{f}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="endFloor" label="إلى طابق" rules={[{ required: true }]}>
                <Select style={{ width: 100 }} placeholder={String(buildingFloors)}>
                  {floorOptions.map(f => <Option key={f} value={f}>{f}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="unitsPerFloor" label="وحدات/طابق" rules={[{ required: true }]}>
                <InputNumber min={1} max={20} style={{ width: 90 }} placeholder="4" />
              </Form.Item>
              <Form.Item name="unitType" label="النوع">
                <Select style={{ width: 110 }} defaultValue="apartment">
                  {unitTypes.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
              <Form.Item name="area" label="المساحة م²">
                <InputNumber min={10} style={{ width: 90 }} placeholder="120" />
              </Form.Item>
              <Form.Item name="bedrooms" label="غرف">
                <InputNumber min={0} max={10} style={{ width: 70 }} placeholder="2" />
              </Form.Item>
              <Form.Item name="bathrooms" label="حمام">
                <InputNumber min={0} max={10} style={{ width: 70 }} placeholder="1" />
              </Form.Item>
              <Form.Item name="rent" label="الإيجار">
                <InputNumber min={0} style={{ width: 110 }} placeholder="45000" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<CopyOutlined />}
                  onClick={handleGenerate}
                  style={{ background: PRIMARY, borderColor: PRIMARY }}
                >
                  توليد
                </Button>
              </Form.Item>
            </Form>
          </div>

          {/* Editable Units Grid */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Space>
              <Text strong style={{ fontSize: 13 }}>قائمة الوحدات</Text>
              <Badge
                count={multiRows.filter(r => r.no).length}
                style={{ background: PRIMARY }}
                showZero
              />
              {bulkGenerated && (
                <Tag color="success" style={{ margin: 0 }}>تم التوليد — راجع البيانات</Tag>
              )}
            </Space>
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addRow}>
              إضافة صف
            </Button>
          </div>

          <Table
            dataSource={multiRows}
            columns={columns}
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ y: 300, x: 'max-content' }}
            style={{ direction: 'ltr' }}
            locale={{ emptyText: 'لا توجد وحدات — استخدم المولّد أو أضف صفاً' }}
          />
        </div>
      )}
    </Modal>

    {/* ── Exit confirmation ── */}
    <Modal
      open={closeConfirmOpen}
      onCancel={() => setCloseConfirmOpen(false)}
      width={380}
      centered
      closable={false}
      footer={null}
      style={{ direction: 'rtl' }}
      styles={{ body: { padding: '28px 24px 20px', direction: 'rtl' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>إلغاء إضافة الوحدة؟</span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fa8c16', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ExclamationCircleOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
        </div>
        <Text style={{ fontSize: 13, color: '#555', textAlign: 'right', display: 'block', width: '100%' }}>
          سيتم فقدان جميع البيانات المدخلة. هل أنت متأكد؟
        </Text>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-start', width: '100%' }}>
          <Button danger style={{ borderRadius: 8, minWidth: 100 }} onClick={doClose}>
            نعم، إلغاء
          </Button>
          <Button style={{ borderRadius: 8, minWidth: 100 }} onClick={() => setCloseConfirmOpen(false)}>
            لا، متابعة
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
};

export default AddUnitModal;
