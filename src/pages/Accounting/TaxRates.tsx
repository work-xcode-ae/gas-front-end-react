import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import { PlusOutlined, BranchesOutlined, EditOutlined, StopOutlined, CheckOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, PercentageOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { AccountSelect, useAccounts, money, PRIMARY } from './shared';

const { Text } = Typography;

export const TAX_CATEGORIES: Record<string, { label: string; color: string }> = {
  standard: { label: 'أساسي', color: 'green' }, zero_rated: { label: 'نسبة صفر', color: 'blue' }, exempt: { label: 'معفى', color: 'default' },
  out_of_scope: { label: 'خارج النطاق', color: 'default' }, reverse_charge: { label: 'احتساب عكسي', color: 'purple' },
};
const SIDES: Record<string, string> = { both: 'المبيعات والمشتريات', sales: 'المبيعات', purchases: 'المشتريات' };
const STATUS: Record<string, { label: string; color: string }> = {
  current: { label: 'سارية', color: 'green' }, future: { label: 'مستقبلية', color: 'blue' }, expired: { label: 'منتهية', color: 'default' }, inactive: { label: 'موقوفة', color: 'red' },
};

/** Tax codes with validity periods: each code has versions (rate valid from … to). */
export default function TaxRates() {
  const { can } = useAuth();
  const manage = can('accounting.manage');
  const accounts = useAccounts();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [edit, setEdit] = useState<any | null>(null);          // {} = new, row = edit
  const [version, setVersion] = useState<any | null>(null);
  const [checkDate, setCheckDate] = useState<Dayjs>(dayjs());
  const [checkRes, setCheckRes] = useState<{ sales?: any; purchases?: any }>({});
  const [form] = Form.useForm();
  const [vform] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [summaryRange, setSummaryRange] = useState<[Dayjs, Dayjs]>([dayjs().month(Math.floor(dayjs().month() / 3) * 3).startOf('month'), dayjs().month(Math.floor(dayjs().month() / 3) * 3 + 2).endOf('month')]);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    api<any[]>('/tax-rates').then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const check = useCallback(() => {
    const date = checkDate.format('YYYY-MM-DD');
    Promise.all(['sales', 'purchases'].map(side => api<any>('/tax-rates/effective', { query: { date, side } }).catch(() => null)))
      .then(([sales, purchases]) => setCheckRes({ sales, purchases }));
  }, [checkDate]);
  useEffect(() => { check(); }, [check, rows]);

  const loadSummary = () => api<any>('/tax-rates/summary', { query: { from: summaryRange[0].format('YYYY-MM-DD'), to: summaryRange[1].format('YYYY-MM-DD') } })
    .then(setSummary).catch(e => message.error(errorMessage(e)));

  // group versions by code
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    rows.forEach(r => { if (!m.has(r.code)) m.set(r.code, []); m.get(r.code)!.push(r); });
    return [...m.entries()].map(([code, versions]) => {
      const cur = versions.find(v => v.status === 'current') ?? versions[0];
      return { key: code, code, name: cur.name, category: cur.category, appliesTo: cur.appliesTo, current: versions.find(v => v.status === 'current'),
        next: versions.filter(v => v.status === 'future').sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0], isDefault: versions.some(v => v.isDefault && v.status === 'current'), versions };
    }).filter(g => filter === 'all' || (filter === 'current' ? !!g.current : filter === 'future' ? !!g.next : !g.current));
  }, [rows, filter]);

  const openEdit = (r?: any) => {
    form.resetFields();
    form.setFieldsValue(r ? { ...r, validFrom: dayjs(r.validFrom), validTo: r.validTo ? dayjs(r.validTo) : null }
      : { category: 'standard', appliesTo: 'both', rate: 5, validFrom: dayjs().startOf('month'), isDefault: false, isActive: true });
    setEdit(r ?? {});
  };
  const save = async () => {
    const v = await form.validateFields();
    const body = { ...v, code: String(v.code).toUpperCase().trim(), validFrom: v.validFrom.format('YYYY-MM-DD'), validTo: v.validTo ? v.validTo.format('YYYY-MM-DD') : null };
    setSaving(true);
    try {
      if (edit?.id) await api(`/tax-rates/${edit.id}`, { method: 'PUT', body }); else await api('/tax-rates', { method: 'POST', body });
      message.success('تم الحفظ'); setEdit(null); load();
    } catch (e) { message.error(errorMessage(e), 8); } finally { setSaving(false); }
  };
  const openVersion = (r: any) => {
    vform.resetFields();
    vform.setFieldsValue({ rate: r.rate, validFrom: dayjs().add(1, 'month').startOf('month'), validTo: null });
    setVersion(r);
  };
  const saveVersion = async () => {
    const v = await vform.validateFields();
    setSaving(true);
    try {
      await api(`/tax-rates/${version.id}/new-version`, { method: 'POST', body: { rate: v.rate, validFrom: v.validFrom.format('YYYY-MM-DD'), validTo: v.validTo ? v.validTo.format('YYYY-MM-DD') : null, notes: v.notes || null } });
      message.success('تمت إضافة الإصدار الجديد وإغلاق الإصدار السابق'); setVersion(null); load();
    } catch (e) { message.error(errorMessage(e), 8); } finally { setSaving(false); }
  };
  const act = (r: any, value: boolean) => api(`/tax-rates/${r.id}/active`, { method: 'POST', query: { value } }).then(() => { message.success('تم'); load(); }).catch(e => message.error(errorMessage(e), 8));
  const del = (r: any) => api(`/tax-rates/${r.id}`, { method: 'DELETE' }).then(() => { message.success('تم الحذف'); load(); }).catch(e => message.error(errorMessage(e), 8));

  const period = (r: any) => <span>{r.validFrom} ← {r.validTo ?? <Text type="secondary">مفتوح</Text>}</span>;
  const versionCols = [
    { title: 'النسبة', dataIndex: 'rate', width: 80, render: (v: number) => <b>{Number(v)}%</b> },
    { title: 'السريان (من ← إلى)', key: 'p', render: (_: any, r: any) => period(r) },
    { title: 'الحالة', dataIndex: 'status', width: 90, render: (s: string) => <Tag color={STATUS[s]?.color}>{STATUS[s]?.label ?? s}</Tag> },
    { title: 'افتراضي', dataIndex: 'isDefault', width: 70, render: (v: boolean) => (v ? <Tag color="gold">افتراضي</Tag> : null) },
    { title: 'حساب المخرجات', dataIndex: 'outputAccount', render: (v: string) => v ?? <Text type="secondary">حسب الربط</Text> },
    { title: 'حساب المدخلات', dataIndex: 'inputAccount', render: (v: string) => v ?? <Text type="secondary">حسب الربط</Text> },
    { title: 'مستخدم', dataIndex: 'usedLines', width: 70, render: (n: number) => (n ? <Tooltip title="عدد بنود الفواتير التي استخدمت هذا الإصدار — النسبة وتاريخ البداية مقفلة"><Tag>{n}</Tag></Tooltip> : '—') },
    ...(manage ? [{
      title: '', key: 'a', width: 150, render: (_: any, r: any) => (
        <Space size={0}>
          <Tooltip title="تعديل"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          {r.isActive
            ? <Popconfirm title="إيقاف هذا الإصدار؟ لن يظهر في الفواتير الجديدة." onConfirm={() => act(r, false)}><Tooltip title="إيقاف"><Button type="text" size="small" danger icon={<StopOutlined />} /></Tooltip></Popconfirm>
            : <Tooltip title="تفعيل"><Button type="text" size="small" icon={<CheckOutlined />} onClick={() => act(r, true)} /></Tooltip>}
          {!r.usedLines && <Popconfirm title="حذف هذا الإصدار؟" onConfirm={() => del(r)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
        </Space>
      ),
    }] : []),
  ];

  const eff = (x: any, label: string) => (
    <Col xs={24} md={8}>
      <Statistic title={label} value={x ? Number(x.rate) : '—'} suffix={x ? '%' : ''} valueStyle={{ color: PRIMARY }} />
      <Text type="secondary" style={{ fontSize: 12 }}>{x?.taxRate ? `${x.taxRate.code} · ${x.taxRate.validFrom} ← ${x.taxRate.validTo ?? 'مفتوح'}` : x ? 'لا يوجد رمز ضريبي — النسبة الافتراضية من الإعدادات' : ''}</Text>
    </Col>
  );

  return (
    <div>
      <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} md={8}>
            <Space direction="vertical" size={4}>
              <Text strong><SearchOutlined /> النسبة السارية في تاريخ</Text>
              <DatePicker value={checkDate} onChange={d => d && setCheckDate(d)} allowClear={false} />
            </Space>
          </Col>
          {eff(checkRes.sales, 'المبيعات (ضريبة المخرجات)')}
          {eff(checkRes.purchases, 'المشتريات (ضريبة المدخلات)')}
        </Row>
      </Card>

      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="كل رمز ضريبي له إصدارات بفترات سريان (من تاريخ ← إلى تاريخ) لا تتداخل. الفاتورة تأخذ الإصدار الساري في تاريخ إصدارها وتُثبَّت النسبة عليها، فتغيير النسبة لاحقاً لا يغيّر الفواتير السابقة. لتغيير النسبة استخدم «إصدار جديد» — يُغلق الإصدار الحالي في اليوم السابق تلقائياً." />

      <Space style={{ marginBottom: 12 }} wrap>
        <Segmented value={filter} onChange={v => setFilter(v as string)} options={[
          { value: 'all', label: 'الكل' }, { value: 'current', label: 'سارية' }, { value: 'future', label: 'لها إصدار قادم' }, { value: 'expired', label: 'غير سارية' }]} />
        <Button icon={<ReloadOutlined />} onClick={load}>تحديث</Button>
        {manage && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>رمز ضريبي جديد</Button>}
      </Space>

      <Table size="small" loading={loading} dataSource={groups} pagination={false} rowKey="key"
        expandable={{ expandedRowRender: g => <Table size="small" rowKey="id" pagination={false} dataSource={g.versions} columns={versionCols as any} />, defaultExpandAllRows: false }}
        columns={[
          { title: 'الرمز', dataIndex: 'code', width: 120, render: v => <Text code>{v}</Text> },
          { title: 'الاسم', dataIndex: 'name' },
          { title: 'الفئة', dataIndex: 'category', width: 110, render: c => <Tag color={TAX_CATEGORIES[c]?.color}>{TAX_CATEGORIES[c]?.label ?? c}</Tag> },
          { title: 'يطبق على', dataIndex: 'appliesTo', width: 160, render: s => SIDES[s] ?? s },
          { title: 'النسبة الحالية', key: 'cur', width: 200, render: (_, g: any) => g.current ? <span><b>{Number(g.current.rate)}%</b> <Text type="secondary" style={{ fontSize: 12 }}>منذ {g.current.validFrom}{g.current.validTo ? ` حتى ${g.current.validTo}` : ''}</Text></span> : <Tag>غير سارية اليوم</Tag> },
          { title: 'القادمة', key: 'next', width: 170, render: (_, g: any) => g.next ? <Tag color="blue">{Number(g.next.rate)}% من {g.next.validFrom}</Tag> : '—' },
          { title: 'افتراضي', dataIndex: 'isDefault', width: 80, render: v => (v ? <Tag color="gold">افتراضي</Tag> : null) },
          { title: 'الإصدارات', key: 'n', width: 80, render: (_, g: any) => g.versions.length },
          ...(manage ? [{ title: '', key: 'a', width: 120, render: (_: any, g: any) => (
            <Button size="small" icon={<BranchesOutlined />} onClick={() => openVersion(g.versions[0])}>إصدار جديد</Button>
          ) }] : []),
        ]} />

      <Card size="small" title={<span><PercentageOutlined /> ملخص ضريبة القيمة المضافة حسب الرمز</span>} style={{ borderRadius: 12, marginTop: 16 }}
        extra={<Space><DatePicker.RangePicker value={summaryRange} onChange={r => r && setSummaryRange(r as [Dayjs, Dayjs])} allowClear={false} /><Button type="primary" onClick={loadSummary}>عرض</Button></Space>}>
        {!summary ? <Text type="secondary">اختر الفترة ثم «عرض» — أساس إعداد الإقرار الضريبي.</Text> : (
          <>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={8}><Statistic title="ضريبة المخرجات (المبيعات)" value={money(summary.outputVat)} /></Col>
              <Col span={8}><Statistic title="ضريبة المدخلات (المشتريات)" value={money(summary.inputVat)} /></Col>
              <Col span={8}><Statistic title={summary.netPayable >= 0 ? 'صافي المستحق للهيئة' : 'صافي المسترد'} value={money(Math.abs(summary.netPayable))} valueStyle={{ color: PRIMARY }} /></Col>
            </Row>
            <Row gutter={16}>
              {[['المبيعات', summary.sales], ['المشتريات', summary.purchases]].map(([t, list]: any) => (
                <Col xs={24} md={12} key={t}>
                  <Table size="small" pagination={false} title={() => <b>{t}</b>} rowKey={(r: any, i) => `${r.taxRateId}-${r.rate}-${i}`} dataSource={list}
                    columns={[
                      { title: 'الرمز', key: 'c', render: (_, r: any) => r.code ?? <Text type="secondary">بدون رمز</Text> },
                      { title: 'النسبة', dataIndex: 'rate', render: v => `${Number(v)}%` },
                      { title: 'الصافي', dataIndex: 'net', render: v => money(v) },
                      { title: 'الضريبة', dataIndex: 'vat', render: v => money(v) },
                    ]} />
                </Col>
              ))}
            </Row>
          </>
        )}
      </Card>

      <Modal open={!!edit} title={edit?.id ? `تعديل ${edit.code} (${edit.validFrom})` : 'رمز ضريبي جديد'} onCancel={() => setEdit(null)} onOk={save} confirmLoading={saving} okText="حفظ" width={720} destroyOnHidden>
        {edit?.usedLines > 0 && <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="هذا الإصدار مستخدم في فواتير: الرمز والنسبة والفئة وتاريخ البداية مقفلة. يمكن تحديد «إلى تاريخ» أو تعديل الاسم والحسابات، ولتغيير النسبة استخدم «إصدار جديد»." />}
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="code" label="الرمز" rules={[{ required: true }]}><Input placeholder="VAT-STD" disabled={edit?.usedLines > 0} style={{ textTransform: 'uppercase' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="nameAr" label="الاسم (عربي)" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="nameEn" label="الاسم (إنجليزي)"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="category" label="الفئة" rules={[{ required: true }]}>
              <Select disabled={edit?.usedLines > 0} onChange={c => { if (c !== 'standard' && c !== 'reverse_charge') form.setFieldValue('rate', 0); }}
                options={Object.entries(TAX_CATEGORIES).map(([value, x]) => ({ value, label: x.label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="rate" label="النسبة %" rules={[{ required: true }]}><InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} disabled={edit?.usedLines > 0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="appliesTo" label="يطبق على"><Select options={Object.entries(SIDES).map(([value, label]) => ({ value, label }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="validFrom" label="ساري من" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} disabled={edit?.usedLines > 0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="validTo" label="ساري إلى (فارغ = مفتوح)" dependencies={['validFrom']}
              rules={[({ getFieldValue }) => ({ validator: (_, v) => (!v || !getFieldValue('validFrom') || !v.isBefore(getFieldValue('validFrom'), 'day') ? Promise.resolve() : Promise.reject(new Error('يجب أن يكون بعد تاريخ البداية'))) })]}>
              <DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item label=" "><Space><Form.Item name="isDefault" valuePropName="checked" noStyle><Checkbox>افتراضي</Checkbox></Form.Item>
              <Form.Item name="isActive" valuePropName="checked" noStyle><Checkbox>فعّال</Checkbox></Form.Item></Space></Form.Item></Col>
            <Col span={12}><Form.Item name="outputAccountId" label="حساب ضريبة المخرجات (المبيعات)" extra="فارغ = حسب ربط الحسابات «vat»"><AccountSelect accounts={accounts} allowClear /></Form.Item></Col>
            <Col span={12}><Form.Item name="inputAccountId" label="حساب ضريبة المدخلات (المشتريات)" extra="فارغ = حسب ربط الحسابات «vat_input»"><AccountSelect accounts={accounts} allowClear /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal open={!!version} title={`إصدار جديد للرمز ${version?.code ?? ''}`} onCancel={() => setVersion(null)} onOk={saveVersion} confirmLoading={saving} okText="إضافة الإصدار" destroyOnHidden>
        {version && (
          <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label="آخر إصدار">{Number(version.rate)}% · {version.validFrom} ← {version.validTo ?? 'مفتوح'}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={vform} layout="vertical">
          <Row gutter={12}>
            <Col span={8}><Form.Item name="rate" label="النسبة الجديدة %" rules={[{ required: true }]}><InputNumber min={0} max={100} step={0.5} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="validFrom" label="ساري من" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="validTo" label="ساري إلى (اختياري)"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={24}><Form.Item name="notes" label="ملاحظات / مرجع القرار"><Input /></Form.Item></Col>
          </Row>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>سيُغلق الإصدار الساري في اليوم السابق لتاريخ البداية. الفواتير بتاريخ سابق تبقى على النسبة القديمة.</Text>
      </Modal>
    </div>
  );
}
