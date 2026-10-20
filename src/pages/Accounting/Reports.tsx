import { useEffect, useState, type ReactNode } from 'react';
import { Segmented, Card, Space, DatePicker, Button, Table, Typography, Empty, Tag, Row, Col, Statistic, Checkbox, message } from 'antd';
import { PrinterOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { AccountSelect, ACCOUNT_TYPES, BranchSelect, DARK, GOLD, PRIMARY, PRINT_CSS, SOURCE_TYPES, downloadCsv, num, useAccounts } from './shared';

const { Text } = Typography;
type Kind = 'tb' | 'gl' | 'pl' | 'bs' | 'ap';
const TITLES: Record<Kind, { ar: string; en: string }> = {
  tb: { ar: 'ميزان المراجعة', en: 'TRIAL BALANCE' }, gl: { ar: 'دفتر الأستاذ العام', en: 'GENERAL LEDGER' },
  pl: { ar: 'قائمة الدخل (الأرباح والخسائر)', en: 'PROFIT & LOSS' }, bs: { ar: 'الميزانية العمومية (المركز المالي)', en: 'BALANCE SHEET' },
  ap: { ar: 'أعمار ديون الموردين', en: 'ACCOUNTS PAYABLE AGING' },
};
const neg = (v: number) => v < 0 ? <span style={{ color: '#cf1322' }}>({num(-v)})</span> : num(v);

function Sheet({ kind, subtitle, children }: { kind: Kind; subtitle: string; children: ReactNode }) {
  return (
    <div className="print-sheet" style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `3px solid ${GOLD}`, paddingBottom: 10, marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div><div style={{ fontSize: 20, fontWeight: 900, color: PRIMARY }}>{TITLES[kind].ar}</div><div style={{ fontSize: 11, color: '#888' }}>{TITLES[kind].en}</div></div>
        <div style={{ fontSize: 12, textAlign: 'left', color: DARK }}><div>{subtitle}</div><div style={{ color: '#999' }}>تاريخ الطباعة {dayjs().format('YYYY-MM-DD HH:mm')}</div></div>
      </div>
      {children}
    </div>
  );
}

export default function Reports({ ledgerAccountId }: { ledgerAccountId?: number }) {
  const [kind, setKind] = useState<Kind>(ledgerAccountId ? 'gl' : 'tb');
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [asOf, setAsOf] = useState<Dayjs>(dayjs());
  const [branchId, setBranchId] = useState<number>();
  const [accountId, setAccountId] = useState<number | undefined>(ledgerAccountId);
  const [hideZero, setHideZero] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const accounts = useAccounts();
  const from = range[0].format('YYYY-MM-DD'), to = range[1].format('YYYY-MM-DD'), asOfS = asOf.format('YYYY-MM-DD');

  const run = (k = kind, acc = accountId) => {
    let path = '', query: any = { branchId };
    if (k === 'tb') { path = '/accounting/trial-balance'; query = { ...query, from, to }; }
    if (k === 'gl') { if (!acc) { setData(null); return; } path = `/accounting/ledger/${acc}`; query = { ...query, from, to }; }
    if (k === 'pl') { path = '/accounting/profit-loss'; query = { ...query, from, to }; }
    if (k === 'bs') { path = '/accounting/balance-sheet'; query = { ...query, asOf: asOfS }; }
    if (k === 'ap') { path = '/accounting/ap-aging'; query = { ...query, asOf: asOfS }; }
    setLoading(true);
    api<any>(path, { query }).then(setData).catch(e => { setData(null); message.error(errorMessage(e)); }).finally(() => setLoading(false));
  };
  useEffect(() => { setData(null); run(kind); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (ledgerAccountId) { setKind('gl'); setAccountId(ledgerAccountId); run('gl', ledgerAccountId); } }, [ledgerAccountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodText = `من ${from} إلى ${to}`, asOfText = `كما في ${asOfS}`;

  const exportCsv = () => {
    if (!data) return;
    if (kind === 'tb') downloadCsv(`ميزان-المراجعة-${from}-${to}`, ['الرقم', 'الحساب', 'النوع', 'رصيد أول المدة', 'مدين', 'دائن', 'رصيد مدين', 'رصيد دائن'],
      data.rows.map((r: any) => [r.accountCode, r.account, ACCOUNT_TYPES[r.type]?.label ?? r.type, r.opening, r.debit, r.credit, r.closingDebit, r.closingCredit]));
    if (kind === 'gl') downloadCsv(`دفتر-الأستاذ-${data.account?.accountCode ?? ''}-${from}-${to}`, ['التاريخ', 'رقم القيد', 'المصدر', 'البيان', 'مدين', 'دائن', 'الرصيد'],
      [['', '', '', 'رصيد افتتاحي', '', '', data.opening], ...data.lines.map((l: any) => [l.entryDate, l.journalNo, SOURCE_TYPES[l.sourceType] ?? l.sourceType, l.description, l.debit, l.credit, l.balance]), ['', '', '', 'رصيد ختامي', '', '', data.closing]]);
    if (kind === 'pl') downloadCsv(`قائمة-الدخل-${from}-${to}`, ['القسم', 'الرقم', 'الحساب', 'الفترة الحالية', 'الفترة السابقة', 'التغير', 'التغير %'],
      [...data.revenue.rows.map((r: any) => ['إيرادات', r.accountCode, r.account, r.current, r.previous, r.change, r.changePct]), ['إجمالي الإيرادات', '', '', data.revenue.current, data.revenue.previous],
       ...data.expenses.rows.map((r: any) => ['مصروفات', r.accountCode, r.account, r.current, r.previous, r.change, r.changePct]), ['إجمالي المصروفات', '', '', data.expenses.current, data.expenses.previous],
       ['صافي الربح', '', '', data.netProfit.current, data.netProfit.previous]]);
    if (kind === 'bs') downloadCsv(`الميزانية-${asOfS}`, ['القسم', 'الرقم', 'الحساب', 'الرصيد'],
      [...['assets', 'liabilities', 'equity'].flatMap(s => data[s].rows.map((r: any) => [s === 'assets' ? 'أصول' : s === 'liabilities' ? 'خصوم' : 'حقوق ملكية', r.accountCode, r.account, r.balance])),
       ['حقوق ملكية', '', 'أرباح السنة الحالية', data.currentYearProfit], ['حقوق ملكية', '', 'أرباح سنوات سابقة (غير مرحلة)', data.priorYearsProfit],
       ['إجمالي الأصول', '', '', data.totals.assets], ['إجمالي الخصوم وحقوق الملكية', '', '', data.totals.liabilitiesAndEquity]]);
    if (kind === 'ap') downloadCsv(`أعمار-الموردين-${asOfS}`, ['المورد', 'الرمز', 'غير مستحق', '1-30', '31-60', '61-90', '+90', 'الإجمالي'],
      data.vendors.map((v: any) => [v.vendor, v.vendorCode, v.current, v.d1_30, v.d31_60, v.d61_90, v.d90_plus, v.total]));
  };

  const plSection = (title: string, sec: any) => (<>
    <Table size="small" rowKey="id" pagination={false} dataSource={sec.rows} title={() => <b style={{ color: PRIMARY }}>{title}</b>}
      columns={[
        { title: 'الحساب', key: 'a', render: (_, r: any) => <span><Text style={{ fontFamily: 'monospace' }}>{r.accountCode}</Text> {r.account}</span> },
        { title: 'الفترة الحالية', dataIndex: 'current', width: 140, render: neg },
        { title: 'الفترة السابقة', dataIndex: 'previous', width: 140, render: neg },
        { title: 'التغير', dataIndex: 'change', width: 120, render: neg },
        { title: '%', dataIndex: 'changePct', width: 80, render: v => v == null ? '—' : <Tag color={v >= 0 ? 'green' : 'red'}>{Number(v).toFixed(1)}%</Tag> },
      ]}
      summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
        <Table.Summary.Cell index={0}><b>إجمالي {title}</b></Table.Summary.Cell>
        <Table.Summary.Cell index={1}><b>{num(sec.current)}</b></Table.Summary.Cell>
        <Table.Summary.Cell index={2}><b>{num(sec.previous)}</b></Table.Summary.Cell>
        <Table.Summary.Cell index={3} colSpan={2}><b>{neg(sec.current - sec.previous)}</b></Table.Summary.Cell>
      </Table.Summary.Row>} />
  </>);

  const bsSection = (title: string, sec: any, extra: { label: string; v: number }[] = [], total?: number) => (
    <Table size="small" rowKey={(r: any) => r.id ?? r.label} pagination={false} dataSource={[...sec.rows, ...extra.map(e => ({ id: e.label, account: e.label, balance: e.v, virtual: true }))]}
      title={() => <b style={{ color: PRIMARY }}>{title}</b>}
      columns={[
        { title: 'الحساب', key: 'a', render: (_, r: any) => r.virtual ? <i>{r.account}</i> : <span><Text style={{ fontFamily: 'monospace' }}>{r.accountCode}</Text> {r.account}</span> },
        { title: 'الرصيد', dataIndex: 'balance', width: 150, render: neg },
      ]}
      summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
        <Table.Summary.Cell index={0}><b>الإجمالي</b></Table.Summary.Cell>
        <Table.Summary.Cell index={1}><b>{num(total ?? sec.total)}</b></Table.Summary.Cell>
      </Table.Summary.Row>} />
  );

  let body: ReactNode = <Empty style={{ padding: 40 }} description={kind === 'gl' ? 'اختر الحساب ثم اضغط «عرض»' : 'لا توجد بيانات'} />;
  if (data && kind === 'tb') {
    const rows = hideZero ? data.rows.filter((r: any) => r.opening || r.debit || r.credit || r.closing) : data.rows;
    body = <Sheet kind="tb" subtitle={periodText}>
      <Table size="small" rowKey="id" pagination={false} dataSource={rows} scroll={{ x: 900 }}
        columns={[
          { title: 'الرقم', dataIndex: 'accountCode', width: 90, render: v => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
          { title: 'الحساب', dataIndex: 'account' },
          { title: 'النوع', dataIndex: 'type', width: 100, render: t => <Tag color={ACCOUNT_TYPES[t]?.color}>{ACCOUNT_TYPES[t]?.label ?? t}</Tag> },
          { title: 'أول المدة', dataIndex: 'opening', width: 120, render: neg },
          { title: 'مدين', dataIndex: 'debit', width: 120, render: num },
          { title: 'دائن', dataIndex: 'credit', width: 120, render: num },
          { title: 'رصيد مدين', dataIndex: 'closingDebit', width: 120, render: v => Number(v) ? num(v) : '' },
          { title: 'رصيد دائن', dataIndex: 'closingCredit', width: 120, render: v => Number(v) ? num(v) : '' },
        ]}
        summary={() => { const t = data.totals ?? {}; const sum = (f: string) => rows.reduce((s: number, r: any) => s + Number(r[f] ?? 0), 0);
          const cd = t.closingDebit ?? sum('closingDebit'), cc = t.closingCredit ?? sum('closingCredit');
          return <Table.Summary.Row style={{ background: '#fafafa' }}>
            <Table.Summary.Cell index={0} colSpan={4}><Space><b>الإجمالي</b>{Math.abs(cd - cc) < 0.01 ? <Tag color="green">متوازن</Tag> : <Tag color="red">غير متوازن</Tag>}</Space></Table.Summary.Cell>
            <Table.Summary.Cell index={4}><b>{num(t.debit ?? sum('debit'))}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={5}><b>{num(t.credit ?? sum('credit'))}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={6}><b>{num(cd)}</b></Table.Summary.Cell>
            <Table.Summary.Cell index={7}><b>{num(cc)}</b></Table.Summary.Cell>
          </Table.Summary.Row>; }} />
    </Sheet>;
  }
  if (data && kind === 'gl') body = <Sheet kind="gl" subtitle={`${data.account?.accountCode ?? ''} ${data.account?.name ?? data.account?.nameAr ?? ''} · ${periodText}`}>
    <Table size="small" rowKey="id" pagination={false} dataSource={data.lines} scroll={{ x: 900 }}
      title={() => <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">رصيد افتتاحي</Text><b>{neg(data.opening)}</b></div>}
      columns={[
        { title: 'التاريخ', dataIndex: 'entryDate', width: 100 },
        { title: 'رقم القيد', dataIndex: 'journalNo', width: 130, render: v => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
        { title: 'المصدر', dataIndex: 'sourceType', width: 120, render: v => <Tag>{SOURCE_TYPES[v] ?? v}</Tag> },
        { title: 'البيان', dataIndex: 'description' },
        { title: 'مدين', dataIndex: 'debit', width: 115, render: v => Number(v) ? num(v) : '' },
        { title: 'دائن', dataIndex: 'credit', width: 115, render: v => Number(v) ? num(v) : '' },
        { title: 'الرصيد', dataIndex: 'balance', width: 130, render: v => <b>{neg(v)}</b> },
      ]}
      summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
        <Table.Summary.Cell index={0} colSpan={4}><b>رصيد ختامي</b></Table.Summary.Cell>
        <Table.Summary.Cell index={4}><b>{num(data.lines.reduce((s: number, l: any) => s + Number(l.debit ?? 0), 0))}</b></Table.Summary.Cell>
        <Table.Summary.Cell index={5}><b>{num(data.lines.reduce((s: number, l: any) => s + Number(l.credit ?? 0), 0))}</b></Table.Summary.Cell>
        <Table.Summary.Cell index={6}><b style={{ color: PRIMARY }}>{neg(data.closing)}</b></Table.Summary.Cell>
      </Table.Summary.Row>} />
  </Sheet>;
  if (data && kind === 'pl') body = <Sheet kind="pl" subtitle={`${periodText} · مقارنة بـ ${data.previousFrom} — ${data.previousTo}`}>
    <Row gutter={12} style={{ marginBottom: 12 }}>
      <Col xs={12} md={6}><Card size="small"><Statistic title="الإيرادات" value={num(data.revenue.current)} /></Card></Col>
      <Col xs={12} md={6}><Card size="small"><Statistic title="المصروفات" value={num(data.expenses.current)} /></Card></Col>
      <Col xs={12} md={6}><Card size="small"><Statistic title="صافي الربح" value={num(data.netProfit.current)} valueStyle={{ color: data.netProfit.current >= 0 ? PRIMARY : '#cf1322' }} /></Card></Col>
      <Col xs={12} md={6}><Card size="small"><Statistic title="هامش الربح" value={data.margin == null ? '—' : `${Number(data.margin).toFixed(1)}%`} /></Card></Col>
    </Row>
    {plSection('الإيرادات', data.revenue)}
    <div style={{ height: 12 }} />
    {plSection('المصروفات', data.expenses)}
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', marginTop: 12, background: '#e8f5e9', borderRadius: 8, fontWeight: 800 }}>
      <span>صافي الربح / (الخسارة)</span><span>{neg(data.netProfit.current)} <Text type="secondary" style={{ fontWeight: 400 }}>(السابقة {num(data.netProfit.previous)})</Text></span>
    </div>
  </Sheet>;
  if (data && kind === 'bs') body = <Sheet kind="bs" subtitle={asOfText}>
    {!data.totals.balanced && <Tag color="red" style={{ marginBottom: 8 }}>فرق غير متوازن: {num(data.totals.difference)}</Tag>}
    <Row gutter={16}>
      <Col xs={24} md={12}>{bsSection('الأصول', data.assets)}</Col>
      <Col xs={24} md={12}>
        {bsSection('الخصوم', data.liabilities)}
        <div style={{ height: 12 }} />
        {bsSection('حقوق الملكية', data.equity, [{ label: 'أرباح السنة الحالية', v: data.currentYearProfit }, { label: 'أرباح سنوات سابقة غير مرحّلة', v: data.priorYearsProfit }], data.totals.equity)}
      </Col>
    </Row>
    <Row gutter={16} style={{ marginTop: 12, fontWeight: 800 }}>
      <Col xs={24} md={12}><div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}><span>إجمالي الأصول</span><span>{num(data.totals.assets)}</span></div></Col>
      <Col xs={24} md={12}><div style={{ background: '#e8f5e9', padding: 10, borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}><span>إجمالي الخصوم وحقوق الملكية</span><span>{num(data.totals.liabilitiesAndEquity)}</span></div></Col>
    </Row>
  </Sheet>;
  if (data && kind === 'ap') {
    const bucket = (f: string) => ({ title: f === 'current' ? 'غير مستحق' : f === 'd90_plus' ? '+90' : f.slice(1).replace('_', '-'), dataIndex: f, width: 110, render: (v: number) => Number(v) ? num(v) : '' });
    body = <Sheet kind="ap" subtitle={`${asOfText} · حسب تاريخ الاستحقاق`}>
      <Table size="small" rowKey="vendorId" pagination={false} dataSource={data.vendors} scroll={{ x: 900 }}
        expandable={{ expandedRowRender: (v: any) => <Table size="small" rowKey="id" pagination={false} dataSource={data.bills.filter((b: any) => b.vendorId === v.vendorId)}
          columns={[{ title: 'الفاتورة', dataIndex: 'billNo' }, { title: 'التاريخ', dataIndex: 'billDate' }, { title: 'الاستحقاق', dataIndex: 'dueDate' },
            { title: 'الإجمالي', dataIndex: 'total', render: num }, { title: 'المدفوع', dataIndex: 'paid', render: num }, { title: 'الرصيد', dataIndex: 'balance', render: num },
            { title: 'أيام التأخير', dataIndex: 'daysPastDue', render: d => d > 0 ? <Tag color={d > 90 ? 'red' : d > 30 ? 'orange' : 'gold'}>{d}</Tag> : '—' }]} /> }}
        columns={[
          { title: 'المورد', key: 'v', render: (_, v: any) => <span>{v.vendor} {v.vendorCode && <Tag>{v.vendorCode}</Tag>}</span> },
          { title: 'عدد', dataIndex: 'count', width: 60 },
          bucket('current'), bucket('d1_30'), bucket('d31_60'), bucket('d61_90'), bucket('d90_plus'),
          { title: 'الإجمالي', dataIndex: 'total', width: 130, render: v => <b>{num(v)}</b> },
        ]}
        summary={() => <Table.Summary.Row style={{ background: '#fafafa' }}>
          <Table.Summary.Cell index={0} colSpan={3}><b>الإجمالي</b></Table.Summary.Cell>
          {['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'].map((f, i) => <Table.Summary.Cell key={f} index={3 + i}><b>{num(data.totals[f])}</b></Table.Summary.Cell>)}
          <Table.Summary.Cell index={8}><b style={{ color: PRIMARY }}>{num(data.total)}</b></Table.Summary.Cell>
        </Table.Summary.Row>} />
    </Sheet>;
  }

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <Card size="small" className="no-print" style={{ borderRadius: 12, marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Segmented value={kind} onChange={v => setKind(v as Kind)} options={(Object.keys(TITLES) as Kind[]).map(k => ({ value: k, label: TITLES[k].ar.split(' (')[0] }))} />
          <Space wrap>
            {kind === 'bs' || kind === 'ap'
              ? <DatePicker value={asOf} onChange={d => d && setAsOf(d)} allowClear={false} />
              : <DatePicker.RangePicker value={range} onChange={r => r && setRange(r as [Dayjs, Dayjs])} allowClear={false} />}
            {kind === 'gl' && <AccountSelect accounts={accounts} value={accountId} onChange={(v: any) => setAccountId(v)} style={{ width: 300 }} placeholder="اختر الحساب…" />}
            <BranchSelect allowClear placeholder="كل الفروع" style={{ width: 180 }} value={branchId} onChange={(v: any) => setBranchId(v)} />
            {kind === 'tb' && <Checkbox checked={hideZero} onChange={e => setHideZero(e.target.checked)}>إخفاء الأرصدة الصفرية</Checkbox>}
            <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => run()}>عرض</Button>
            <Button icon={<PrinterOutlined />} disabled={!data} onClick={() => window.print()}>طباعة / PDF</Button>
            <Button icon={<DownloadOutlined />} disabled={!data} onClick={exportCsv}>Excel</Button>
          </Space>
        </Space>
      </Card>
      {body}
    </div>
  );
}
