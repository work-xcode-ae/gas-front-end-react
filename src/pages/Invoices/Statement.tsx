import { useEffect, useState } from 'react';
import { Card, Segmented, Select, DatePicker, Button, Space, Table, Typography, Empty, Tag, message, Row, Col } from 'antd';
import { PrinterOutlined, DownloadOutlined, SearchOutlined, UserOutlined, ShopOutlined, BankOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { api, errorMessage } from '../../api/client';
import { PRIMARY, DARK, GOLD, money, PRINT_CSS } from './shared';
import { InvoiceDrawer } from './SalesInvoices';
import { VoucherDrawer } from './Vouchers';

const { Text } = Typography;
type PartyType = 'customer' | 'supplier' | 'account';
const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  invoice: { label: 'فاتورة', color: 'blue' }, receipt: { label: 'سند قبض', color: 'green' }, bill: { label: 'فاتورة مورد', color: 'orange' },
  payment: { label: 'سند صرف', color: 'volcano' }, voucher: { label: 'سند', color: 'purple' }, vendor_payment: { label: 'سند صرف', color: 'volcano' },
  vendor_bill: { label: 'فاتورة مورد', color: 'orange' }, credit_note: { label: 'إشعار دائن', color: 'cyan' }, refund: { label: 'استرداد', color: 'magenta' }, manual: { label: 'قيد يدوي', color: 'default' }, journal: { label: 'قيد', color: 'default' },
};

/** Statement of account (كشف حساب) for a customer, supplier or ledger account. */
export default function Statement({ initial }: { initial?: { partyType: PartyType; id: number } }) {
  const [partyType, setPartyType] = useState<PartyType>(initial?.partyType ?? 'customer');
  const [partyId, setPartyId] = useState<number | undefined>(initial?.id);
  const [options, setOptions] = useState<{ id: number; code?: string; name?: string }[]>([]);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<number | null>(null);
  const [voucher, setVoucher] = useState<{ party: 'customer' | 'supplier' | 'account'; id: number } | null>(null);

  const searchParties = (s?: string) =>
    api<any[]>('/statements/parties', { query: { partyType, search: s || undefined } }).then(setOptions).catch(() => setOptions([]));
  useEffect(() => { searchParties(); if (!initial || initial.partyType !== partyType) { setPartyId(undefined); setData(null); } }, [partyType]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = () => {
    if (!partyId) { message.warning('اختر الطرف'); return; }
    setLoading(true);
    api<any>('/statements', { query: { partyType, id: partyId, from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD') } })
      .then(setData).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  };
  useEffect(() => { if (initial?.id) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = () => {
    if (!data) return;
    const head = ['التاريخ', 'النوع', 'المرجع', 'البيان', 'مدين', 'دائن', 'الرصيد'];
    const rows = [['', '', '', 'رصيد افتتاحي', '', '', data.opening],
      ...data.lines.map((l: any) => [l.date, TYPE_LABEL[l.type]?.label ?? l.type, l.reference, l.description ?? '', l.debit, l.credit, l.balance]),
      ['', '', '', 'الإجمالي', data.totalDebit, data.totalCredit, data.closing]];
    const csv = '﻿' + [head, ...rows].map(r => r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `كشف-حساب-${data.party?.code ?? data.party?.id}-${range[0].format('YYYYMMDD')}-${range[1].format('YYYYMMDD')}.csv`;
    a.click();
  };

  const open = (l: any) => {
    if (partyType === 'account') return; // ledger lines point to journal entries
    if (l.type === 'invoice') setOpenInvoice(l.id);
    else if (l.type === 'receipt') setVoucher({ party: 'customer', id: l.id });
    else if (l.type === 'payment' && partyType === 'supplier') setVoucher({ party: 'supplier', id: l.id });
    else if (l.type === 'voucher') setVoucher({ party: 'account', id: l.id });
  };
  const balLabel = (v: number) => {
    if (!data) return '';
    const dr = data.nature === 'debit' ? v >= 0 : v < 0;
    return `${money(Math.abs(v))} ${v === 0 ? '' : dr ? 'مدين' : 'دائن'}`;
  };

  return (
    <div>
      <style>{PRINT_CSS}</style>
      <Card size="small" style={{ borderRadius: 12, marginBottom: 12 }} className="no-print">
        <Space wrap>
          <Segmented value={partyType} onChange={v => setPartyType(v as PartyType)} options={[
            { value: 'customer', label: <span><UserOutlined /> عميل</span> }, { value: 'supplier', label: <span><ShopOutlined /> مورد</span> },
            { value: 'account', label: <span><BankOutlined /> حساب</span> }]} />
          <Select showSearch filterOption={false} onSearch={searchParties} style={{ width: 300 }} value={partyId} onChange={setPartyId}
            placeholder={partyType === 'customer' ? 'اختر العميل…' : partyType === 'supplier' ? 'اختر المورد…' : 'اختر الحساب…'}
            options={options.map(o => ({ value: o.id, label: `${o.code ? `${o.code} — ` : ''}${o.name ?? ''}` }))} />
          <DatePicker.RangePicker value={range} onChange={r => r && setRange(r as [Dayjs, Dayjs])} allowClear={false} />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={run}>عرض الكشف</Button>
          <Button icon={<PrinterOutlined />} disabled={!data} onClick={() => window.print()}>طباعة / PDF</Button>
          <Button icon={<DownloadOutlined />} disabled={!data} onClick={exportCsv}>Excel</Button>
        </Space>
      </Card>

      {!data ? <Empty description="اختر الطرف والفترة ثم اضغط «عرض الكشف»" style={{ padding: 40 }} /> : (
        <div className="print-sheet" style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: `3px solid ${GOLD}`, paddingBottom: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: DARK }}>{data.company?.nameAr ?? data.company?.nameEn}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{data.company?.address}{data.company?.trn ? ` · TRN ${data.company.trn}` : ''}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: PRIMARY }}>كشف حساب</div>
              <div style={{ fontSize: 12, color: '#888' }}>STATEMENT OF ACCOUNT</div>
            </div>
            <div style={{ fontSize: 13, textAlign: 'left' }}>
              <div>من {dayjs(data.from).format('YYYY-MM-DD')} إلى {dayjs(data.to).format('YYYY-MM-DD')}</div>
              <div style={{ color: '#888', fontSize: 11 }}>تاريخ الطباعة {dayjs().format('YYYY-MM-DD HH:mm')}</div>
            </div>
          </div>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col xs={24} md={12}>
              <div style={{ fontSize: 13 }}>
                <div><Text type="secondary">{partyType === 'customer' ? 'العميل' : partyType === 'supplier' ? 'المورد' : 'الحساب'}: </Text><b>{data.party?.name}</b> {data.party?.code && <Tag>{data.party.code}</Tag>}</div>
                {data.party?.phone && <div><Text type="secondary">الهاتف: </Text>{data.party.phone}</div>}
                {data.party?.trn && <div><Text type="secondary">الرقم الضريبي: </Text>{data.party.trn}</div>}
                {data.party?.typeLabel && <div><Text type="secondary">النوع: </Text>{data.party.typeLabel}</div>}
              </div>
            </Col>
            <Col xs={24} md={12}>
              <Row gutter={8}>
                {[
                  { l: 'رصيد افتتاحي', v: balLabel(data.opening) }, { l: 'مدين', v: money(data.totalDebit) },
                  { l: 'دائن', v: money(data.totalCredit) }, { l: 'الرصيد الختامي', v: balLabel(data.closing), strong: true },
                ].map(x => (
                  <Col span={6} key={x.l}><div style={{ background: x.strong ? '#e8f5e9' : '#fafafa', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#888' }}>{x.l}</div><div style={{ fontSize: 13, fontWeight: x.strong ? 800 : 600, color: x.strong ? PRIMARY : undefined }}>{x.v}</div>
                  </div></Col>
                ))}
              </Row>
            </Col>
          </Row>
          <Table size="small" rowKey={(l: any, i) => `${l.type}-${l.id}-${i}`} pagination={false} dataSource={data.lines} scroll={{ x: 800 }}
            onRow={(l: any) => ({ onClick: () => open(l), style: { cursor: partyType !== 'account' && ['invoice', 'receipt', 'payment'].includes(l.type) ? 'pointer' : undefined } })}
            locale={{ emptyText: 'لا توجد حركات في هذه الفترة' }}
            summary={() => (
              <>
                <Table.Summary.Row style={{ background: '#fafafa' }}>
                  <Table.Summary.Cell index={0} colSpan={4}><b>الإجمالي</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={4}><b>{money(data.totalDebit)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={5}><b>{money(data.totalCredit)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={6}><b style={{ color: PRIMARY }}>{balLabel(data.closing)}</b></Table.Summary.Cell>
                </Table.Summary.Row>
              </>
            )}
            columns={[
              { title: 'التاريخ', dataIndex: 'date', width: 100 },
              { title: 'النوع', dataIndex: 'type', width: 110, render: t => <Tag color={TYPE_LABEL[t]?.color}>{TYPE_LABEL[t]?.label ?? t}</Tag> },
              { title: 'المرجع', dataIndex: 'reference', width: 150, render: v => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text> },
              { title: 'البيان', dataIndex: 'description' },
              { title: 'مدين', dataIndex: 'debit', width: 120, render: v => (Number(v) ? money(v) : '') },
              { title: 'دائن', dataIndex: 'credit', width: 120, render: v => (Number(v) ? money(v) : '') },
              { title: 'الرصيد', dataIndex: 'balance', width: 150, render: v => <b>{balLabel(Number(v))}</b> },
            ]}
            title={() => <div style={{ display: 'flex', justifyContent: 'space-between' }}><Text type="secondary">رصيد افتتاحي في {dayjs(data.from).format('YYYY-MM-DD')}</Text><b>{balLabel(data.opening)}</b></div>} />
          <div style={{ fontSize: 11, color: '#999', marginTop: 10 }}>
            {data.nature === 'debit' ? 'الرصيد المدين = مستحق على الطرف / الدائن = لصالح الطرف.' : 'الرصيد الدائن = مستحق للطرف / المدين = مدفوع مقدماً.'}
          </div>
        </div>
      )}
      <InvoiceDrawer id={openInvoice} onClose={() => setOpenInvoice(null)} onChanged={run} />
      <VoucherDrawer party={voucher?.party ?? null} id={voucher?.id ?? null} onClose={() => setVoucher(null)} onChanged={run} />
    </div>
  );
}
