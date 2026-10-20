import React, { useState, useEffect } from 'react';
import {
  Modal, Form, InputNumber, Select, DatePicker,
  Input, Row, Col, Typography, Tag, Divider,
  Alert, Button, Upload, message, Progress
} from 'antd';
import {
  DashboardOutlined, HomeOutlined, UserOutlined,
  CameraOutlined, CheckCircleOutlined, WarningOutlined,
  RiseOutlined, FallOutlined, MinusOutlined,
  
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MeterRecord } from './meterTypes';

const { Text } = Typography;
const { Option } = Select;
const PRIMARY = '#1a5c2a';
const GOLD    = '#c9a84c';
const DANGER  = '#ff4d4f';

const readingMethods = [
  { value: 'manual',    label: 'يدوي — قراءة ميدانية',    icon: '👁️' },
  { value: 'remote',    label: 'عن بُعد — نظام ذكي',      icon: '📡' },
  { value: 'customer',  label: 'تقرير المستأجر',           icon: '👤' },
  { value: 'photo',     label: 'صورة العداد',              icon: '📷' },
];

interface MeterReadingModalProps {
  open: boolean;
  meter: MeterRecord | null;
  onClose: () => void;
  onSave?: (data: {
    meterId: string;
    newReading: number;
    readingDate: string;
    method: string;
    notes: string;
    consumption: number;
  }) => void;
}

const MeterReadingModal: React.FC<MeterReadingModalProps> = ({
  open, meter, onClose, onSave,
}) => {
  const [form] = Form.useForm();
  const [newReading, setNewReading] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setConfirmed] = useState(false);

  useEffect(() => {
    if (open && meter) {
      form.setFieldsValue({
        readingDate: dayjs(),
        method: meter.type === 'smart' ? 'remote' : 'manual',
      });
      setNewReading(null);
      setConfirmed(false);
    }
  }, [open, meter, form]);

  if (!meter) return null;

  const prev         = meter.lastReadValue;
  const consumption  = newReading !== null ? newReading - prev : null;
  const isNegative   = consumption !== null && consumption < 0;
  const isZero       = consumption === 0;
  const isSurge      = consumption !== null && meter.monthlyAvg > 0 && consumption > meter.monthlyAvg * 2;
  const pctOfAvg     = meter.monthlyAvg > 0 && consumption !== null
    ? Math.round((consumption / meter.monthlyAvg) * 100) : null;

  /* colour feedback */
  const consumptionColor = isNegative ? DANGER
    : isSurge ? '#fa8c16'
    : consumption !== null && consumption > 0 ? PRIMARY : '#aaa';

  const consumptionIcon = isNegative ? <FallOutlined />
    : isSurge ? <WarningOutlined />
    : consumption !== null && consumption > 0 ? <RiseOutlined /> : <MinusOutlined />;

  const handleSave = async () => {
    if (isNegative) { message.warning('القراءة الجديدة أقل من السابقة — تحقق من القيمة'); return; }
    try {
      const v = await form.validateFields();
      setLoading(true);
      await new Promise(r => setTimeout(r, 650));
      onSave?.({
        meterId:     meter.id,
        newReading:  v.newReading,
        readingDate: (v.readingDate as ReturnType<typeof dayjs>).format('YYYY-MM-DD'),
        method:      v.method,
        notes:       v.notes || '',
        consumption: consumption ?? 0,
      });
      message.success(`تم تسجيل قراءة العداد ${meter.id} بنجاح`);
      onClose();
    } catch {
      // antd shows inline errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${PRIMARY}, #2e7d32)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DashboardOutlined style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>تسجيل قراءة عداد</div>
            <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 1 }}>
              {meter.id} · {meter.serial}
            </div>
          </div>
          <div style={{ marginInlineStart: 'auto' }}>
            <Tag color={meter.status === 'active' ? 'success' : 'error'} style={{ margin: 0 }}>
              {meter.statusLabel}
            </Tag>
          </div>
        </div>
      }
      width={560}
      style={{ direction: 'rtl' }}
      styles={{ body: { padding: '16px 24px 8px' } }}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button onClick={onClose}>إلغاء</Button>
          <Button
            type="primary"
            loading={loading}
            icon={<CheckCircleOutlined />}
            disabled={newReading === null || isNegative}
            onClick={handleSave}
            style={{ background: PRIMARY, borderColor: PRIMARY }}
          >
            حفظ القراءة
          </Button>
        </div>
      }
    >
      {/* ── Meter summary strip ── */}
      <div style={{
        display: 'flex', gap: 12, background: '#f8fffe',
        border: `1px solid ${PRIMARY}22`, borderRadius: 10,
        padding: '10px 14px', marginBottom: 18,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
            <HomeOutlined style={{ color: PRIMARY, fontSize: 12 }} />
            <Text style={{ fontSize: 12 }}>وحدة <Text strong style={{ color: PRIMARY }}>{meter.unit}</Text> — طابق {meter.floor}</Text>
          </div>
          {meter.tenant && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <UserOutlined style={{ color: '#aaa', fontSize: 12 }} />
              <Text style={{ fontSize: 12 }}>{meter.tenant}</Text>
            </div>
          )}
        </div>
        <Divider type="vertical" style={{ height: 'auto', margin: 0 }} />
        <div style={{ textAlign: 'center', minWidth: 90 }}>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>آخر قراءة</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: PRIMARY, lineHeight: 1.1 }}>
            {prev.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>م³</div>
        </div>
        <Divider type="vertical" style={{ height: 'auto', margin: 0 }} />
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>متوسط شهري</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: GOLD, lineHeight: 1.1 }}>
            {meter.monthlyAvg || '—'}
          </div>
          <div style={{ fontSize: 10, color: '#aaa' }}>م³</div>
        </div>
        <Divider type="vertical" style={{ height: 'auto', margin: 0 }} />
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>آخر قراءة بتاريخ</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', lineHeight: 1.3 }}>
            {meter.lastRead}
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <Form form={form} layout="vertical" size="middle" style={{ direction: 'rtl' }}>
        <Row gutter={[14, 0]}>

          {/* New reading — the hero field */}
          <Col span={14}>
            <Form.Item
              name="newReading"
              label={<Text strong style={{ fontSize: 13 }}>القراءة الجديدة (م³)</Text>}
              rules={[{ required: true, message: 'أدخل قراءة العداد' }]}
            >
              <InputNumber
                size="large"
                min={0}
                style={{
                  width: '100%',
                  fontSize: 22,
                  fontWeight: 800,
                  borderColor: isNegative ? DANGER : newReading !== null ? PRIMARY : undefined,
                }}
                placeholder={`أكثر من ${prev.toLocaleString()}`}
                addonAfter="م³"
                onChange={v => setNewReading(typeof v === 'number' ? v : null)}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={((v?: string) => (v ? parseFloat(v.replace(/[^0-9.]/g, '')) : 0)) as any}
              />
            </Form.Item>
          </Col>

          {/* Date */}
          <Col span={10}>
            <Form.Item
              name="readingDate"
              label="تاريخ القراءة"
              rules={[{ required: true, message: 'مطلوب' }]}
            >
              <DatePicker
                size="large"
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={d => d && d.isAfter(dayjs())}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Live consumption display */}
        {consumption !== null && (
          <div style={{
            background: isNegative ? '#fff1f0' : isSurge ? '#fff7e6' : '#f6ffed',
            border: `1.5px solid ${consumptionColor}44`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 14,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: consumptionColor, fontSize: 16 }}>{consumptionIcon}</span>
                <Text style={{ fontSize: 13, color: '#555' }}>الاستهلاك المحسوب</Text>
              </div>
              <div style={{ textAlign: 'left' }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: consumptionColor }}>
                  {isNegative ? '⚠ ' : ''}{consumption.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, color: '#aaa', marginInlineStart: 4 }}>م³</span>
              </div>
            </div>

            {/* Comparison bar */}
            {!isNegative && !isZero && pctOfAvg !== null && meter.monthlyAvg > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    مقارنةً بالمتوسط الشهري ({meter.monthlyAvg} م³)
                  </Text>
                  <Text style={{ fontSize: 11, color: consumptionColor }}>
                    {pctOfAvg}%
                  </Text>
                </div>
                <Progress
                  percent={Math.min(pctOfAvg, 200)}
                  strokeColor={isSurge ? '#fa8c16' : PRIMARY}
                  trailColor="#e0e0e0"
                  size="small"
                  showInfo={false}
                />
              </div>
            )}

            {isNegative && (
              <Alert
                type="error" showIcon
                message="القراءة الجديدة أقل من السابقة — تحقق من القيمة أو سجل بلاغ عطل"
                style={{ marginTop: 8, borderRadius: 6, padding: '4px 10px', fontSize: 11 }}
              />
            )}
            {isSurge && !isNegative && (
              <Alert
                type="warning" showIcon
                message="الاستهلاك مرتفع بشكل غير اعتيادي — تأكد من القراءة أو تحقق من وجود تسرب"
                style={{ marginTop: 8, borderRadius: 6, padding: '4px 10px', fontSize: 11 }}
              />
            )}
          </div>
        )}

        <Row gutter={[14, 0]}>
          {/* Method */}
          <Col span={12}>
            <Form.Item name="method" label="طريقة القراءة" rules={[{ required: true }]}>
              <Select size="middle">
                {readingMethods.map(m => (
                  <Option key={m.value} value={m.value}>
                    {m.icon} {m.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>

          {/* Photo upload */}
          <Col span={12}>
            <Form.Item name="photo" label="صورة العداد (اختياري)">
              <Upload
                accept="image/*"
                maxCount={1}
                beforeUpload={() => false}
                listType="picture"
              >
                <Button icon={<CameraOutlined />} size="middle" style={{ width: '100%' }}>
                  رفع صورة
                </Button>
              </Upload>
            </Form.Item>
          </Col>
        </Row>

        {/* Notes */}
        <Form.Item name="notes" label="ملاحظات" style={{ marginBottom: 4 }}>
          <Input.TextArea
            rows={2}
            placeholder="أي ملاحظات عن حالة العداد أو القراءة..."
            maxLength={300}
            showCount
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default MeterReadingModal;
