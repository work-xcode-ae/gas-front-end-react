import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Tag, Typography, Button, Progress, Descriptions, Divider, Empty, Modal, Form, DatePicker, InputNumber, Space, message } from 'antd';
import {
  ToolOutlined, FireOutlined, PlusOutlined, SafetyCertificateOutlined, CheckCircleOutlined, CalendarOutlined, UserOutlined, PrinterOutlined,
  ExclamationCircleOutlined, WarningOutlined, EditOutlined, BellOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api, errorMessage, type Paged } from '../../api/client';
import { RecordVisitModal, UploadReportModal } from '../Buildings/AmcVisitModals';
import AmcInvoicesPanel from '../Buildings/AmcInvoicesPanel';
import { openPrintWindow, printAmcContract } from '../../utils/printDocs';
import VillaGasContracts from './VillaGasContracts';
import { PremisesAmcModal, VISIT_FREQ } from './premisesAmc';
import { PRIMARY } from './forms';

const { Text } = Typography;
const STATUS: Record<string, { color: string; label: string }> = {
  active: { color: 'success', label: 'نشط' }, pending: { color: 'warning', label: 'لم يبدأ' }, expired: { color: 'error', label: 'منتهي' },
  cancelled: { color: 'default', label: 'ملغى' }, terminated: { color: 'default', label: 'منهى' },
};

/**
 * «العقود» of a restaurant — the same look as the building / villa contracts tab:
 * two switcher cards (عقد الصيانة السنوي / عقود توريد الغاز), the restaurant's OWN AMCs as the building AMC cards
 * (scope, visits, owner, print, visit, report, renew, instalment invoices), and the gas supply contracts (price per litre).
 */
export default function SiteContractsTab({ site, reloadKey, onChanged, onNeedSignatory }: {
  site: any; reloadKey?: number; onChanged?: () => void; onNeedSignatory?: () => void;
}) {
  const [tab, setTab] = useState<'amc' | 'supply'>('supply');
  const [amcs, setAmcs] = useState<any[] | null>(null);
  const [key, setKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [visitFor, setVisitFor] = useState<any>(null);
  const [reportFor, setReportFor] = useState<any>(null);
  const [renewFor, setRenewFor] = useState<any>(null);
  const [renewBusy, setRenewBusy] = useState(false);
  const [renewForm] = Form.useForm();

  const load = useCallback(() => {
    api<Paged<any>>('/amc-contracts', { query: { premisesId: site.id, pageSize: 0 } }).then(r => setAmcs(r.items)).catch(() => setAmcs([]));
  }, [site.id]);
  useEffect(() => { load(); }, [load, key, reloadKey]);
  const changed = () => { setKey(k => k + 1); onChanged?.(); };

  const gas: any[] = site.contracts ?? [];
  const list = amcs ?? [];
  const amcActive = list.filter(c => c.status === 'active').length;

  const openRenew = (c: any) => {
    const start = c.endDate ? dayjs(c.endDate).add(1, 'day') : dayjs();
    renewForm.resetFields();
    renewForm.setFieldsValue({ startDate: start, endDate: start.add(1, 'year').subtract(1, 'day'), annualValue: c.annualValue });
    setRenewFor(c);
  };
  const submitRenew = async () => {
    const v = await renewForm.validateFields();
    setRenewBusy(true);
    try {
      const r = await api<any>(`/amc-contracts/${renewFor.id}/renew`, { method: 'POST', body: {
        startDate: v.startDate.format('YYYY-MM-DD'), endDate: v.endDate.format('YYYY-MM-DD'), annualValue: v.annualValue ?? null } });
      message.success(`تم إنشاء عقد الصيانة المجدد ${r?.contractNo ?? ''}`);
      setRenewFor(null); changed();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setRenewBusy(false); }
  };

  const switcher = (k: 'amc' | 'supply', color: string, bg: string, icon: React.ReactNode, title: string, sub: string, tags: React.ReactNode) => (
    <div onClick={() => setTab(k)} style={{
      flex: 1, padding: '14px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
      border: tab === k ? `2px solid ${color}` : '2px solid #e0e0e0', background: tab === k ? bg : '#fafafa', transition: 'all 0.2s',
    }}>
      <div style={{ fontSize: 24, marginBottom: 4, color: tab === k ? color : '#bbb' }}>{icon}</div>
      <Text strong style={{ color: tab === k ? color : '#666', display: 'block' }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: 11 }}>{sub}</Text>
      <div style={{ marginTop: 8 }}>{tags}</div>
    </div>
  );

  return (
    <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {switcher('amc', PRIMARY, '#e8f5e9', <ToolOutlined />, 'عقد الصيانة السنوي', 'AMC Gas Contract — صيانة مواسير الغاز وفحص السلامة (خاص بالمطعم)',
          <>{amcActive > 0 ? <Tag color="success">نشط</Tag> : <Tag color="error">لا يوجد عقد ساري</Tag>}<Tag>{list.length} عقود</Tag></>)}
        {switcher('supply', '#fa8c16', '#fff7e6', <FireOutlined />, 'عقود توريد الغاز', 'Gas Supply Contract — سعر اللتر وفاتورة لكل تعبئة',
          <><Tag color="success">{gas.filter(c => c.status === 'active').length} نشط</Tag><Tag color="error">{gas.filter(c => c.status === 'expired' || c.status === 'terminated').length} منتهي</Tag></>)}
      </div>

      {tab === 'supply' && <VillaGasContracts villaId={site.id} reloadKey={(reloadKey ?? 0) + key} onChanged={changed} onNeedSignatory={onNeedSignatory} />}

      {tab === 'amc' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong style={{ fontSize: 14 }}><ToolOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />سجل عقود الصيانة السنوية</Text>
            {site.isActive && <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8, background: PRIMARY }} onClick={() => setNewOpen(true)}>عقد AMC جديد</Button>}
          </div>
          {amcs !== null && list.length === 0 && (
            <Empty style={{ padding: '24px 0' }} description="لا توجد عقود صيانة لهذا المطعم — بدون عقد ساري لا يمكن فتح طلبات الخدمة" />
          )}
          {list.map(c => {
            const isExpired = c.status === 'expired';
            const daysLeft = c.endDate ? Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000) : null;
            const soon = daysLeft !== null && daysLeft > 0 && daysLeft <= 60;
            const visitPct = c.visitsTotal ? Math.round(((c.visitsDone ?? 0) / c.visitsTotal) * 100) : 0;
            const freq = VISIT_FREQ.find(f => f.value === c.visitFrequency)?.label ?? c.visitFrequency;
            return (
              <Card key={c.id} bordered={false} style={{
                borderRadius: 12, marginBottom: 16, background: isExpired ? '#fff8f8' : '#f6ffed',
                border: isExpired ? '2px solid #ff4d4f' : soon ? '2px solid #fa8c16' : `2px solid ${PRIMARY}33`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{c.vendor}</Text>
                    <div style={{ fontSize: 12, color: '#888' }}>رقم العقد: <Text style={{ fontFamily: 'monospace' }}>{c.contractNo}</Text></div>
                    <div style={{ fontSize: 12, color: '#888' }}>الفترة: {c.startDate} — {c.endDate}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Tag color={STATUS[c.status]?.color} style={{ fontWeight: 600 }}>{c.statusLabel ?? STATUS[c.status]?.label ?? c.status}</Tag>
                    {soon && <Tag color="warning" icon={<ExclamationCircleOutlined />}>ينتهي خلال {daysLeft} يوم</Tag>}
                    {isExpired && <Tag color="error" icon={<WarningOutlined />}>منتهي</Tag>}
                    <Tag color="blue">{Number(c.annualValue ?? 0).toLocaleString()} د.إ / سنة</Tag>
                  </div>
                </div>
                <Row gutter={[16, 12]}>
                  <Col xs={24} md={10}>
                    <Text strong style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 8 }}>
                      <SafetyCertificateOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />نطاق الصيانة
                    </Text>
                    {(c.scope ?? []).map((s: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11, flexShrink: 0 }} /><Text style={{ fontSize: 12 }}>{s}</Text>
                      </div>
                    ))}
                    {c.notes && <div style={{ marginTop: 8, padding: '5px 8px', background: '#fff', borderRadius: 6, border: '1px dashed #d9d9d9' }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>{c.notes}</Text></div>}
                  </Col>
                  <Col xs={24} md={8}>
                    <Text strong style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 8 }}>
                      <CalendarOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />الزيارات ({freq})
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>{c.visitsDone ?? 0} من {c.visitsTotal ?? 0} زيارة</Text>
                      <Text strong style={{ fontSize: 12, color: visitPct === 100 ? '#52c41a' : PRIMARY }}>{visitPct}%</Text>
                    </div>
                    <Progress percent={visitPct} strokeColor={visitPct === 100 ? '#52c41a' : PRIMARY} showInfo={false} size="small" style={{ marginBottom: 10 }} />
                    <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888' }} contentStyle={{ fontSize: 11 }}>
                      {c.lastVisit && <Descriptions.Item label="آخر زيارة">{c.lastVisit}</Descriptions.Item>}
                      {c.nextVisit && <Descriptions.Item label="الزيارة القادمة">{c.nextVisit}</Descriptions.Item>}
                      {c.lastVisitReport && <Descriptions.Item label="تقرير آخر زيارة">{c.lastVisitReport}</Descriptions.Item>}
                      <Descriptions.Item label="زمن الاستجابة">{c.responseTime ?? '—'}{c.emergencyIncluded ? ' · يشمل الطوارئ' : ''}</Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col xs={24} md={6}>
                    <Card size="small" bordered={false} style={{ borderRadius: 8, background: '#fff', height: '100%' }}>
                      <Text strong style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
                        <UserOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />العميل (مالك المطعم)
                      </Text>
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888' }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="الاسم">{c.ownerName || site.owner?.name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="الهاتف">{c.ownerPhone || site.owner?.phone || '—'}</Descriptions.Item>
                        <Descriptions.Item label="البريد">{c.ownerEmail || '—'}</Descriptions.Item>
                      </Descriptions>
                      {(c.vendorContact || c.vendorEmail) && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                        مقدم الخدمة: {c.vendor}{c.vendorContact ? ` · ${c.vendorContact}` : ''}{c.vendorEmail ? ` · ${c.vendorEmail}` : ''}</div>}
                      <Button size="small" block icon={<PrinterOutlined />} style={{ borderRadius: 6, fontSize: 11, marginTop: 8 }}
                        onClick={() => printAmcContract(openPrintWindow(), Number(c.id))}>طباعة العقد</Button>
                      <Divider style={{ margin: '8px 0' }} />
                      {isExpired ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}><ExclamationCircleOutlined style={{ color: '#ff4d4f', marginInlineEnd: 4 }} />انتهى العقد — اختر:</Text>
                          <Button type="primary" icon={<PlusOutlined />} size="small" block style={{ borderRadius: 6, fontSize: 11 }} onClick={() => setNewOpen(true)}>إنشاء عقد جديد</Button>
                          <Button icon={<EditOutlined />} size="small" block style={{ borderRadius: 6, fontSize: 11, borderColor: PRIMARY, color: PRIMARY }} onClick={() => openRenew(c)}>تجديد العقد</Button>
                        </div>
                      ) : soon ? (
                        <Button icon={<BellOutlined />} size="small" block style={{ borderRadius: 6, fontSize: 11, borderColor: '#fa8c16', color: '#fa8c16' }} onClick={() => openRenew(c)}>تجديد مبكر</Button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <Button size="small" block style={{ borderRadius: 6, fontSize: 11 }} onClick={() => setVisitFor(c)}>تسجيل زيارة</Button>
                          <Button size="small" block style={{ borderRadius: 6, fontSize: 11 }} onClick={() => setReportFor(c)}>رفع تقرير</Button>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
                <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #f0f0f0' }}>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                    <FileTextOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />فواتير العقد والأقساط
                  </Text>
                  <AmcInvoicesPanel contractId={c.id} schedule={c.paymentSchedule ?? []} onChanged={changed} />
                </div>
              </Card>
            );
          })}
          <RecordVisitModal open={!!visitFor} contract={visitFor} onClose={() => setVisitFor(null)} onDone={changed} />
          <UploadReportModal open={!!reportFor} contract={reportFor} onClose={() => setReportFor(null)} onDone={changed} />
        </div>
      )}

      <PremisesAmcModal site={site} open={newOpen} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); setTab('amc'); changed(); }} />
      <Modal open={!!renewFor} okText="تجديد" cancelText="إلغاء" onOk={submitRenew} confirmLoading={renewBusy} onCancel={() => setRenewFor(null)} destroyOnHidden
        title={`تجديد عقد الصيانة ${renewFor?.contractNo ?? ''}`}>
        <Form form={renewForm} layout="vertical">
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>يُنشأ عقد جديد للمطعم بنفس مقدم الخدمة والعميل والنطاق والشروط وتكرار الزيارات، وتُولد الزيارات وجدول الدفعات للفترة الجديدة.</Text>
          <Space style={{ display: 'flex' }} wrap>
            <Form.Item name="startDate" label="بداية العقد الجديد" rules={[{ required: true }]}><DatePicker /></Form.Item>
            <Form.Item name="endDate" label="نهاية العقد الجديد" rules={[{ required: true }]}><DatePicker /></Form.Item>
          </Space>
          <Form.Item name="annualValue" label="القيمة السنوية (د.إ)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
