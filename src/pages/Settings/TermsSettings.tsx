import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, Empty, Form, Input, Modal, Popconfirm, Radio, Row, Select, Spin, Switch, Tag, Tooltip, message } from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, FileProtectOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, StarFilled,
} from '@ant-design/icons';
import { errorMessage } from '../../api/client';
import { TERM_CATEGORIES, TERM_CONTRACT_TYPES, termCategory, termsApi, type TermContractType, type TermTemplate } from '../../api/terms';
import { TermText, TermTextArea } from '../../components/TermFields';

const PRIMARY = '#1a5c2a';
const DARK = '#0b2e18';
const GOLD = '#c9a84c';

/** Settings → Terms & conditions: one list for all contracts, the type code (supply / amc) decides which contract form uses each term. */
const TermsSettings: React.FC = () => {
  const [type, setType] = useState<TermContractType>('supply');
  const [rows, setRows] = useState<TermTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);
  const [edit, setEdit] = useState<TermTemplate | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    termsApi.list().then(setRows).catch(e => message.error(errorMessage(e))).finally(() => setLoading(false));
  }, [key]);

  const counts = useMemo(() => ({
    supply: rows.filter(r => r.contractType === 'supply').length,
    amc: rows.filter(r => r.contractType === 'amc').length,
  }), [rows]);
  const ofType = rows.filter(r => r.contractType === type).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const q = search.trim();
  const shown = ofType.filter(r => (!cat || r.category === cat) && (showInactive || r.isActive)
    && (!q || r.textAr.includes(q) || (r.textEn ?? '').toLowerCase().includes(q.toLowerCase())));
  const groups = Object.keys(TERM_CATEGORIES).map(c => [c, shown.filter(r => r.category === c)] as const).filter(([, l]) => l.length);

  const openForm = (t: TermTemplate | 'new') => {
    form.resetFields();
    form.setFieldsValue(t === 'new'
      ? { contractType: type, category: cat ?? 'general', isDefault: type === 'supply', isActive: true }
      : { contractType: t.contractType, category: t.category, textAr: t.textAr, textEn: t.textEn, isDefault: t.isDefault, isActive: t.isActive });
    setEdit(t);
  };

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      if (edit === 'new') await termsApi.create(v);
      else if (edit) await termsApi.update(edit.id, { ...v, sortOrder: edit.sortOrder });
      message.success(edit === 'new' ? 'تمت إضافة البند' : 'تم حفظ البند');
      if (v.contractType !== type) setType(v.contractType);
      setEdit(null); setKey(k => k + 1);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  const quick = async (t: TermTemplate, patch: Partial<TermTemplate>) => {
    setRows(rs => rs.map(r => (r.id === t.id ? { ...r, ...patch } : r)));
    try { await termsApi.update(t.id, { ...t, ...patch }); }
    catch (e) { message.error(errorMessage(e)); setKey(k => k + 1); }
  };

  /** move inside its category (the order is also the order on the contract) */
  const move = async (t: TermTemplate, dir: -1 | 1) => {
    const list = [...ofType];
    const i = list.findIndex(r => r.id === t.id);
    const sameCat = list.map((r, idx) => ({ r, idx })).filter(x => x.r.category === t.category);
    const pos = sameCat.findIndex(x => x.r.id === t.id);
    const other = sameCat[pos + dir];
    if (!other) return;
    [list[i], list[other.idx]] = [list[other.idx], list[i]];
    const ids = list.map(r => r.id);
    setRows(rs => rs.map(r => { const n = ids.indexOf(r.id); return n >= 0 ? { ...r, sortOrder: (n + 1) * 10 } : r; }));
    try { await termsApi.reorder(ids); } catch (e) { message.error(errorMessage(e)); setKey(k => k + 1); }
  };

  const remove = async (t: TermTemplate) => {
    try { await termsApi.remove(t.id); message.success('تم حذف البند'); setKey(k => k + 1); }
    catch (e) { message.error(errorMessage(e)); }
  };

  return (
    <div>
      <style>{`
        .ts-types { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 14px; }
        .ts-type { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 2px solid #e6ebe6; background: #fff; cursor: pointer; transition: all .15s; }
        .ts-type:hover { border-color: #b7d3b9; }
        .ts-type.on { border-color: ${PRIMARY}; background: #f3faf3; box-shadow: 0 2px 10px rgba(26,92,42,.10); }
        .ts-type-ic { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 19px; }
        .ts-type-t { font-weight: 700; font-size: 14px; color: ${DARK}; }
        .ts-type-s { font-size: 12px; color: #888; }
        .ts-type code { margin-inline-start: auto; background: ${DARK}; color: ${GOLD}; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
        .ts-cat { margin-bottom: 16px; }
        .ts-cat-head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13.5px; margin-bottom: 8px; }
        .ts-cat-head i { width: 9px; height: 9px; border-radius: 50%; }
        .ts-row { display: flex; gap: 12px; align-items: flex-start; background: #fff; border: 1px solid #e8ece8; border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; }
        .ts-row.off { background: #fafafa; }
        .ts-row.off .ts-text { color: #aaa; text-decoration: line-through; }
        .ts-num { width: 26px; height: 26px; border-radius: 8px; background: #f0f4f0; color: ${PRIMARY}; font-weight: 700; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ts-text { flex: 1; font-size: 13.5px; line-height: 1.85; color: #263238; }
        .ts-en { font-size: 12px; color: #8a8f8a; direction: ltr; text-align: left; margin-top: 2px; }
        .ts-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      `}</style>

      <div className="ts-types">
        {(Object.keys(TERM_CONTRACT_TYPES) as TermContractType[]).map(k => {
          const m = TERM_CONTRACT_TYPES[k];
          return (
            <div key={k} className={`ts-type${type === k ? ' on' : ''}`} role="button" tabIndex={0} onClick={() => { setType(k); setCat(null); }}
              onKeyDown={e => { if (e.key === 'Enter') setType(k); }}>
              <span className="ts-type-ic" style={{ background: `${m.color}14`, color: m.color }}><FileProtectOutlined /></span>
              <div><div className="ts-type-t">{m.label}</div><div className="ts-type-s">{counts[k]} بند · {rows.filter(r => r.contractType === k && r.isDefault && r.isActive).length} محدد افتراضياً</div></div>
              <code>{k}</code>
            </div>
          );
        })}
      </div>

      <Card styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 12, marginBottom: 14 }}>
        <Row gutter={[10, 10]} align="middle">
          <Col flex="auto">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <Tag.CheckableTag checked={!cat} onChange={() => setCat(null)}>الكل ({ofType.length})</Tag.CheckableTag>
              {Object.entries(TERM_CATEGORIES).map(([k, m]) => {
                const n = ofType.filter(r => r.category === k).length;
                return n ? <Tag.CheckableTag key={k} checked={cat === k} onChange={on => setCat(on ? k : null)}>{m.label} ({n})</Tag.CheckableTag> : null;
              })}
            </div>
          </Col>
          <Col>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#777' }}>إظهار غير النشطة <Switch size="small" checked={showInactive} onChange={setShowInactive} /></span>
              <Input allowClear prefix={<SearchOutlined style={{ color: '#bbb' }} />} placeholder="بحث في البنود" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
              <Tooltip title="تحديث"><Button icon={<ReloadOutlined />} onClick={() => setKey(k => k + 1)} loading={loading} /></Tooltip>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm('new')} style={{ background: PRIMARY, borderColor: PRIMARY, fontWeight: 600 }}>إضافة بند</Button>
            </div>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {!loading && groups.length === 0 ? (
          <Empty description={ofType.length ? 'لا توجد بنود مطابقة' : `لا توجد بنود لـ ${TERM_CONTRACT_TYPES[type].label} بعد`}>
            <Button type="primary" icon={<PlusOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => openForm('new')}>إضافة أول بند</Button>
          </Empty>
        ) : groups.map(([c, list]) => {
          const m = termCategory(c);
          return (
            <div key={c} className="ts-cat">
              <div className="ts-cat-head" style={{ color: m.color }}><i style={{ background: m.color }} />{m.label}<span style={{ color: '#aaa', fontWeight: 400, fontSize: 12 }}>({list.length})</span></div>
              {list.map((t, i) => (
                <div key={t.id} className={`ts-row${t.isActive ? '' : ' off'}`}>
                  <span className="ts-num">{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div className="ts-text"><TermText text={t.textAr} /></div>
                    {t.textEn && <div className="ts-en"><TermText text={t.textEn} lang="en" /></div>}
                  </div>
                  <div className="ts-meta">
                    <Tooltip title={t.isDefault ? 'محدد افتراضياً في العقود الجديدة — اضغط لإلغاء' : 'اجعله محدداً افتراضياً في العقود الجديدة'}>
                      <Tag color={t.isDefault ? 'gold' : 'default'} style={{ cursor: 'pointer', margin: 0 }} icon={t.isDefault ? <StarFilled /> : undefined}
                        onClick={() => quick(t, { isDefault: !t.isDefault })}>{t.isDefault ? 'افتراضي' : 'اختياري'}</Tag>
                    </Tooltip>
                    <Tooltip title={t.isActive ? 'نشط — يظهر في نماذج العقود' : 'غير نشط — لا يظهر في العقود الجديدة'}>
                      <Switch size="small" checked={t.isActive} onChange={on => quick(t, { isActive: on })} />
                    </Tooltip>
                    <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(t, -1)} />
                    <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === list.length - 1} onClick={() => move(t, 1)} />
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openForm(t)} />
                    <Popconfirm title="حذف هذا البند؟" description="العقود السابقة تحتفظ بنسختها من النص." okText="حذف" cancelText="إلغاء" okButtonProps={{ danger: true }} onConfirm={() => remove(t)}>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </Spin>

      <Modal open={!!edit} onCancel={() => setEdit(null)} onOk={save} confirmLoading={saving} width={640} destroyOnHidden centered
        title={<span><FileProtectOutlined style={{ color: PRIMARY }} /> {edit === 'new' ? 'إضافة بند جديد' : 'تعديل البند'}</span>}
        okText={edit === 'new' ? 'إضافة' : 'حفظ'} cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY, borderColor: PRIMARY } }}>
        <Form form={form} layout="vertical" requiredMark="optional">
          <Form.Item name="contractType" label="نوع العقد (الرمز)" rules={[{ required: true }]}>
            <Radio.Group optionType="button" buttonStyle="solid"
              options={(Object.keys(TERM_CONTRACT_TYPES) as TermContractType[]).map(k => ({ value: k, label: `${TERM_CONTRACT_TYPES[k].short} — ${k}` }))} />
          </Form.Item>
          <Form.Item name="category" label="الفئة" rules={[{ required: true, message: 'اختر الفئة' }]}>
            <Select options={Object.entries(TERM_CATEGORIES).map(([k, m]) => ({ value: k, label: <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: m.color, marginInlineEnd: 6 }} />{m.label}</span> }))} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.contractType !== b.contractType}>
            {({ getFieldValue }) => (
              <>
                <Form.Item name="textAr" label="نص البند (عربي)" rules={[{ required: true, whitespace: true, message: 'أدخل نص البند' }]}
                  extra="الأزرار تُدرج حقلاً مثل {gas_price} يُستبدل بقيمة العقد عند الطباعة">
                  <TermTextArea contractType={getFieldValue('contractType') ?? 'supply'} minRows={3} maxRows={8} showCount />
                </Form.Item>
                <Form.Item name="textEn" label="نص البند (إنجليزي)" extra="يُطبع بجانب النص العربي في العقد — استخدم نفس الحقول">
                  <TermTextArea contractType={getFieldValue('contractType') ?? 'supply'} dir="ltr" lang="en" minRows={2} maxRows={6} />
                </Form.Item>
              </>
            )}
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="isDefault" label="محدد افتراضياً في العقود الجديدة" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={12}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TermsSettings;
