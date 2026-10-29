import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Switch, Row, Col, Segmented, Button, Alert, Typography, Steps, Result, Card, Tooltip, Tag, Tabs, message } from 'antd';
import {
  PlusOutlined, DeleteOutlined, UserOutlined, ShopOutlined, HomeOutlined, DatabaseOutlined, FileProtectOutlined,
  EnvironmentOutlined, NumberOutlined, CheckCircleOutlined, SafetyCertificateOutlined, BankOutlined, PhoneOutlined, MailOutlined, IdcardOutlined,
  StarFilled, StarOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { premisesApi, type PremisesType } from '../../api/premises';
import { PartySelect, ContractFields, PRIMARY, blank, iso, tanksOf, signatoryOf, contractOf } from './forms';
import { AmcFields, amcBody, amcDefaults } from './premisesAmc';
import type { ContractTermItem } from '../../api/terms';

const { Text } = Typography;

/**
 * «إضافة فيلا / مطعم» — the same multi-step wizard look as «إضافة مبنى جديد»
 * (gradient header + steps, step body, السابق / التالي footer with step dots, success screen).
 * Create only; editing keeps PremisesFormModal (the building edit is also a plain modal).
 */

const VILLA_STEPS = [
  { title: 'معلومات الفيلا', icon: <HomeOutlined /> },
  { title: 'معلومات المالك', icon: <UserOutlined /> },
  { title: 'معلومات الخزانات', icon: <DatabaseOutlined /> },
  { title: 'العقود (الغاز والصيانة)', icon: <FileProtectOutlined /> },
  { title: 'العنوان والملاحظات', icon: <EnvironmentOutlined /> },
];
const RESTAURANT_STEPS = [
  { title: 'معلومات المطعم', icon: <ShopOutlined /> },
  { title: 'معلومات المالك', icon: <UserOutlined /> },
  { title: 'المخولون بالتوقيع', icon: <SafetyCertificateOutlined /> },
  { title: 'معلومات الخزانات', icon: <DatabaseOutlined /> },
  { title: 'العقود والملاحظات', icon: <FileProtectOutlined /> },
];

const inputStyle = { borderRadius: 8 };
const hint = (t: string) => <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 13 }}>{t}</Text>;
const ownerCard = { marginBottom: 16, borderRadius: 12, border: '1.5px solid #e3f0ff', background: '#fafcff' };
const tankCard = { marginBottom: 16, borderRadius: 12, border: '1.5px solid #e6f4ff', background: '#f0f7ff' };
const signCard = { marginBottom: 16, borderRadius: 12, border: '1.5px solid #f5e9c8', background: '#fffcf3' };
const contractCard = { marginBottom: 16, borderRadius: 12, border: '1.5px solid #c8e6c9', background: '#f6fbf6' };
const amcCard = { marginBottom: 16, borderRadius: 12, border: '1.5px solid #d6e4ff', background: '#f7f9ff' };
const starOn = { borderColor: '#faad14', boxShadow: '0 0 0 2px rgba(250,173,20,0.15)' };
/** non-empty values, the default one first (same rule as the building wizard) */
const defaultFirst = (list: unknown, idx: number) => {
  const arr = (Array.isArray(list) ? list : []).map(x => blank(x)).filter((x): x is string => !!x);
  if (idx > 0 && idx < arr.length) { const [d] = arr.splice(idx, 1); arr.unshift(d); }
  return arr;
};

export default function PremisesWizard({ type, open, buildingId, onClose, onSaved, onListChanged }: {
  type: PremisesType; open: boolean; buildingId?: number;
  onClose: () => void;
  /** «فتح الملف» on the success screen */
  onSaved: (id: number) => void;
  /** a record was created and the wizard was closed without opening it */
  onListChanged?: () => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { data: ref } = useReference(i18n.language);
  const [form] = Form.useForm();
  const isVilla = type === 'villa';
  const STEPS = isVilla ? VILLA_STEPS : RESTAURANT_STEPS;
  const noun = isVilla ? 'الفيلا' : 'المطعم';

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: number; code: string; warnings: string[]; contracts: string[] } | null>(null);
  const [anyCreated, setAnyCreated] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [defaultPhone, setDefaultPhone] = useState(0);
  const [defaultEmail, setDefaultEmail] = useState(0);
  const [amcTerms, setAmcTerms] = useState<ContractTermItem[] | undefined>(undefined);
  const [withGas, setWithGas] = useState(false);
  const [withAmc, setWithAmc] = useState(false);
  const [contractTab, setContractTab] = useState<'gas' | 'amc'>('gas');

  const ownerMode = Form.useWatch('ownerMode', { form, preserve: true }) ?? 'new';
  const ownerType = Form.useWatch(['owner', 'partyType'], { form, preserve: true });
  const signatories = Form.useWatch('signatories', { form, preserve: true }) as any[] | undefined;

  const reset = () => {
    setStep(0); setCreated(null); setDefaultPhone(0); setDefaultEmail(0); setAmcTerms(undefined); setWithGas(false); setWithAmc(false); setContractTab('gas');
    form.resetFields();
    form.setFieldsValue({
      buildingId, branchId: ref?.branches?.[0]?.id, ownerMode: 'new', owner: { partyType: isVilla ? 'individual' : 'company', phones: [''], emails: [''] },
      amc: amcDefaults(), tanks: [{ gasType: 'LPG' }], signatories: isVilla ? undefined : [{ canSignContracts: true }],
    });
  };
  useEffect(() => { if (open) { reset(); setAnyCreated(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || isVilla || buildingId) return;
    api<Paged<any>>('/buildings', { query: { pageSize: 0, kind: 'building' } }).then(r => setBuildings(r.items)).catch(() => setBuildings([]));
  }, [open, isVilla, buildingId]);

  const close = () => { if (anyCreated) onListChanged?.(); onClose(); };
  const confirmCancel = () => {
    if (saving) return;
    Modal.confirm({
      title: `إلغاء إضافة ${noun}؟`, content: 'سيتم فقدان جميع البيانات المدخلة. هل أنت متأكد؟',
      okText: 'نعم، إلغاء', cancelText: 'لا، متابعة', okType: 'danger', centered: true, onOk: close,
    });
  };

  /** a hidden contract tab with an error is brought to the front */
  const showErrorTab = (e: any) => {
    const f = e?.errorFields?.[0]?.name?.[0];
    if (f === 'contract') setContractTab('gas'); else if (f === 'amc') setContractTab('amc');
  };
  const next = () => form.validateFields().then(() => setStep(s => s + 1)).catch(showErrorTab);
  const prev = () => setStep(s => s - 1);

  const finish = async () => {
    try { await form.validateFields(); } catch (e) { showErrorTab(e); return; }
    const v = form.getFieldsValue(true);
    setSaving(true);
    try {
      const phones = defaultFirst(v.owner?.phones, defaultPhone);
      const emails = defaultFirst(v.owner?.emails, defaultEmail);
      const o = v.owner ?? {};
      const owner = v.ownerMode === 'existing' ? { partyId: v.ownerPartyId } : { party: {
        partyType: o.partyType, nameAr: blank(o.nameAr), nameEn: blank(o.nameEn), emiratesId: blank(o.emiratesId),
        tradeLicenseNo: o.partyType === 'company' ? blank(o.tradeLicenseNo) : null, taxNumber: blank(o.taxNumber),
        phone: phones[0] ?? null, email: emails[0] ?? null, phones, emails } };
      let r: { id: number; code: string; buildingId?: number; contractId?: number };
      if (isVilla) {
        r = await premisesApi.createVilla({
          branchId: v.branchId, nameAr: blank(v.nameAr), nameEn: blank(v.nameEn), owner, cityId: v.cityId ?? null, zone: blank(v.zone), street: blank(v.street),
          poBox: blank(v.poBox), address: blank(v.address), latitude: v.latitude ?? null, longitude: v.longitude ?? null,
          community: blank(v.community), plotNo: blank(v.plotNo), villaNo: blank(v.villaNo), makaniNo: blank(v.makaniNo), bedrooms: v.bedrooms ?? null, notes: blank(v.notes),
          tanks: tanksOf(v), contract: withGas ? contractOf(v.contract) : null,
        } as any);
      } else {
        r = await premisesApi.createRestaurant({
          buildingId: v.buildingId ?? buildingId, unitId: null, nameAr: blank(v.nameAr), nameEn: blank(v.nameEn), owner,
          tradeName: blank(v.tradeName), tradeLicenseNo: blank(v.tradeLicenseNo), tradeLicenseExpiry: iso(v.tradeLicenseExpiry),
          seatingCapacity: v.seatingCapacity ?? null, burnersCount: v.burnersCount ?? null, kitchenType: v.kitchenType ?? null,
          cuisine: blank(v.cuisine), operatingHours: blank(v.operatingHours), notes: blank(v.notes),
          signatories: (v.signatories ?? []).filter(Boolean).map(signatoryOf), tanks: tanksOf(v),
          contract: withGas ? contractOf(v.contract, { index: v.contract?.signatory }) : null,
        } as any);
      }
      setAnyCreated(true);
      // service & maintenance contract: villa → its own building; restaurant → linked to the restaurant (premisesId)
      const warnings: string[] = [];
      const contracts: string[] = [r.contractId ? 'عقد توريد الغاز ← «عقود توريد الغاز»' : ''].filter(Boolean);
      if (withAmc) {
        try {
          const a = await api<{ contractNo: string; invoiceWarning?: string }>('/amc-contracts', { body: {
            ...amcBody(v.amc, amcTerms), buildingId: isVilla ? r.buildingId : (v.buildingId ?? buildingId), premisesId: r.id } });
          contracts.push(`عقد الصيانة ${a.contractNo} ← «عقود الصيانة»`);
          if (a.invoiceWarning) warnings.push(`عقد الصيانة ${a.contractNo}: ${a.invoiceWarning}`);
        } catch (e) { warnings.push(`تم حفظ ${noun} لكن لم يُحفظ عقد الصيانة: ${errorMessage(e)} — أضفه من ملف ${noun} ← العقود.`); }
      }
      setCreated({ id: r.id, code: r.code, warnings, contracts });
    } catch (e) { message.error(errorMessage(e), 6); }
    finally { setSaving(false); }
  };

  const signerOptions = (signatories ?? []).map((s, i) => ({ s, i })).filter(x => x.s && x.s.canSignContracts && x.s.nameAr)
    .map(x => ({ value: x.i, label: `${x.s.nameAr}${x.s.position ? ` — ${x.s.position}` : ''}` }));
  const done = !!created;

  // ───────── steps ─────────
  const infoStep = isVilla ? (
    <div>
      {hint('أدخل المعلومات الأساسية للفيلا')}
      <Alert type="info" showIcon icon={<NumberOutlined />} style={{ marginBottom: 16, borderRadius: 8 }} message="رقم الفيلا في النظام يُولَّد تلقائياً عند الحفظ" />
      <Form.Item name="nameAr" label="اسم الفيلا (عربي)" rules={[{ required: true, message: 'الرجاء إدخال اسم الفيلا بالعربي' }]}>
        <Input prefix={<HomeOutlined style={{ color: '#bbb' }} />} placeholder="اسم الفيلا بالعربي" style={inputStyle} />
      </Form.Item>
      <Form.Item name="nameEn" label="Villa Name (English)">
        <Input prefix={<HomeOutlined style={{ color: '#bbb' }} />} placeholder="e.g. Al Barsha Villa 12" style={{ ...inputStyle, direction: 'ltr' }} />
      </Form.Item>
      <Form.Item name="branchId" label="الفرع" rules={[{ required: true, message: 'الرجاء اختيار الفرع' }]}>
        <Select placeholder="اختر الفرع" style={inputStyle} options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} md={12}><Form.Item name="community" label="المنطقة / المجمع"><Input style={inputStyle} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name="villaNo" label="رقم الفيلا"><Input style={inputStyle} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name="bedrooms" label="غرف النوم"><InputNumber min={0} style={{ ...inputStyle, width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={12}><Form.Item name="plotNo" label="رقم القطعة"><Input style={inputStyle} /></Form.Item></Col>
        <Col xs={12} md={12}><Form.Item name="makaniNo" label="رقم مكاني"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>
      </Row>
    </div>
  ) : (
    <div>
      {hint('أدخل المعلومات الأساسية للمطعم والمبنى الذي يقع فيه')}
      <Alert type="info" showIcon icon={<NumberOutlined />} style={{ marginBottom: 16, borderRadius: 8 }} message="رقم المطعم في النظام يُولَّد تلقائياً عند الحفظ" />
      <Row gutter={12}>
        {!buildingId && (
          <Col xs={24}><Form.Item name="buildingId" label="المبنى" rules={[{ required: true, message: 'الرجاء اختيار المبنى' }]}>
            <Select showSearch optionFilterProp="label" placeholder="المبنى الذي يقع فيه المطعم" style={inputStyle} suffixIcon={<BankOutlined />}
              options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? b.nameAr ?? ''}` }))} /></Form.Item></Col>
        )}
      </Row>
      <Form.Item name="nameAr" label="اسم المطعم (عربي)" rules={[{ required: true, message: 'الرجاء إدخال اسم المطعم بالعربي' }]}>
        <Input prefix={<ShopOutlined style={{ color: '#bbb' }} />} placeholder="اسم المطعم بالعربي" style={inputStyle} />
      </Form.Item>
      <Form.Item name="nameEn" label="Restaurant Name (English)">
        <Input prefix={<ShopOutlined style={{ color: '#bbb' }} />} placeholder="e.g. Al Sedra Grill" style={{ ...inputStyle, direction: 'ltr' }} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} md={8}><Form.Item name="tradeName" label="الاسم التجاري"><Input style={inputStyle} /></Form.Item></Col>
        <Col xs={12} md={8}><Form.Item name="tradeLicenseNo" label="رقم الرخصة التجارية"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>
        <Col xs={12} md={8}><Form.Item name="tradeLicenseExpiry" label="انتهاء الرخصة"><DatePicker style={{ ...inputStyle, width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name="kitchenType" label="نوع المطبخ"><Select allowClear style={inputStyle} options={(ref?.lookups?.KITCHEN_TYPE ?? []).map(k => ({ value: k.code, label: k.label }))} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name="cuisine" label="نوع الأكل"><Input placeholder="عربي، هندي…" style={inputStyle} /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item name="seatingCapacity" label="المقاعد"><InputNumber min={0} style={{ ...inputStyle, width: '100%' }} /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item name="burnersCount" label="عدد الشعلات"><InputNumber min={0} style={{ ...inputStyle, width: '100%' }} /></Form.Item></Col>
        <Col xs={8} md={4}><Form.Item name="operatingHours" label="ساعات العمل"><Input placeholder="10:00–24:00" style={inputStyle} /></Form.Item></Col>
      </Row>
    </div>
  );

  /** several phones / emails with a default one (star), like the building owner */
  const contactList = (name: 'phones' | 'emails', label: string, addLabel: string, icon: React.ReactNode, placeholder: string,
    def: number, setDef: (i: number) => void, isPhone: boolean) => (
    <Form.Item label={label} required={isPhone} style={{ marginBottom: 16 }}>
      <Form.List name={['owner', name]}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((f, i) => (
              <div key={f.key} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                {fields.length > 1 && (
                  <Tooltip title={def === i ? (isPhone ? 'الرقم الافتراضي' : 'البريد الافتراضي') : 'تعيين كافتراضي'}>
                    <Button type="text" size="small" icon={def === i ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined style={{ color: '#ccc' }} />} onClick={() => setDef(i)} />
                  </Tooltip>
                )}
                <Form.Item name={[f.name]} noStyle rules={isPhone
                  ? [{ required: i === 0, message: 'الرجاء إدخال رقم الهاتف' }]
                  : [{ type: 'email', message: 'الرجاء إدخال بريد إلكتروني صحيح' }]}>
                  <Input prefix={icon} placeholder={placeholder} style={{ ...inputStyle, direction: 'ltr', flex: 1, ...(def === i && fields.length > 1 ? starOn : {}) }} />
                </Form.Item>
                {fields.length > 1 && (
                  <Button icon={<DeleteOutlined />} danger type="text" onClick={() => { remove(f.name); if (def === i) setDef(0); else if (def > i) setDef(def - 1); }} />
                )}
              </div>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add('')} style={{ borderRadius: 8 }}>{addLabel}</Button>
          </>
        )}
      </Form.List>
    </Form.Item>
  );

  const ownerStep = (
    <div>
      {hint(isVilla ? 'مالك الفيلا هو العميل والموقّع على العقد (لا يوجد مستأجر).' : 'أدخل معلومات مالك المطعم (العميل في العقود والفواتير).')}
      <Card size="small" style={ownerCard} title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ color: '#1677ff' }}><UserOutlined style={{ marginInlineEnd: 6 }} />{isVilla ? 'مالك الفيلا' : 'مالك المطعم'}</Text>
          <Form.Item name="ownerMode" noStyle>
            <Segmented size="small" options={[{ value: 'new', label: 'مالك جديد' }, { value: 'existing', label: 'من الأطراف المسجلة' }]} />
          </Form.Item>
        </div>}>
        {ownerMode === 'existing' ? (
          <Form.Item name="ownerPartyId" label="المالك" rules={[{ required: true, message: 'الرجاء اختيار المالك' }]}><PartySelect /></Form.Item>
        ) : (
          <>
            <Form.Item name={['owner', 'partyType']} label="نوع المالك" rules={[{ required: true }]}>
              <Select style={inputStyle} options={[
                { value: 'individual', label: <span><UserOutlined style={{ marginInlineEnd: 6 }} />فرد (شخصي)</span> },
                { value: 'company', label: <span><BankOutlined style={{ marginInlineEnd: 6 }} />شركة</span> }]} />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name={['owner', 'nameAr']} label={ownerType === 'company' ? 'اسم الشركة (عربي)' : 'اسم المالك (عربي)'} rules={[{ required: true, message: 'الرجاء إدخال الاسم بالعربي' }]}>
                <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="الاسم الكامل بالعربي" style={inputStyle} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name={['owner', 'nameEn']} label="Name (English)">
                <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="Full name in English" style={{ ...inputStyle, direction: 'ltr' }} /></Form.Item></Col>
              <Col xs={24} md={12}>{contactList('phones', 'أرقام الهاتف', 'إضافة رقم هاتف', <PhoneOutlined style={{ color: '#bbb' }} />, '+971 50 000 0000', defaultPhone, setDefaultPhone, true)}</Col>
              <Col xs={24} md={12}>{contactList('emails', 'البريد الإلكتروني', 'إضافة بريد إلكتروني', <MailOutlined style={{ color: '#bbb' }} />, 'example@email.com', defaultEmail, setDefaultEmail, false)}</Col>
              <Col xs={24} md={12}><Form.Item name={['owner', 'emiratesId']} label="رقم الهوية الإماراتية">
                <Input prefix={<IdcardOutlined style={{ color: '#bbb' }} />} placeholder="784-XXXX-XXXXXXX-X" style={{ ...inputStyle, direction: 'ltr' }} /></Form.Item></Col>
              {ownerType === 'company' && <Col xs={24} md={12}><Form.Item name={['owner', 'tradeLicenseNo']} label="رقم الرخصة التجارية"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>}
              <Col xs={24} md={12}><Form.Item name={['owner', 'taxNumber']} label="الرقم الضريبي (TRN)"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>
            </Row>
          </>
        )}
      </Card>
    </div>
  );

  const signatoriesStep = (
    <div>
      {hint('أضف أشخاص طاقم المطعم المخولين بالتوقيع. عقد التوريد يجب أن يوقّعه أحدهم.')}
      <Form.List name="signatories">
        {(fields, { add, remove }) => (
          <>
            {fields.map((f, i) => (
              <Card key={f.key} size="small" style={signCard} title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ color: '#a07a17' }}><SafetyCertificateOutlined style={{ marginInlineEnd: 6 }} />{`الشخص المخول ${i + 1}`}</Text>
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(f.name)}>حذف</Button>
                </div>}>
                <Row gutter={12}>
                  <Col xs={24} md={12}><Form.Item name={[f.name, 'nameAr']} label="الاسم" rules={[{ required: true, message: 'الرجاء إدخال الاسم' }]}><Input prefix={<UserOutlined style={{ color: '#bbb' }} />} style={inputStyle} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name={[f.name, 'position']} label="المنصب"><Input placeholder="مدير المطعم" style={inputStyle} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name={[f.name, 'emiratesId']} label="رقم الهوية"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name={[f.name, 'phone']} label="الهاتف"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name={[f.name, 'canSignContracts']} label="مخول بتوقيع العقود" valuePropName="checked"><Switch /></Form.Item></Col>
                </Row>
              </Card>
            ))}
            <Button type="dashed" block size="large" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => add({ canSignContracts: true })}>إضافة شخص مخول</Button>
          </>
        )}
      </Form.List>
    </div>
  );

  const tanksStep = (
    <div>
      {hint(`أضف الخزانات المثبتة في ${noun}. يمكنك إضافة أكثر من خزان.`)}
      <Form.List name="tanks">
        {(fields, { add, remove }) => (
          <>
            {fields.map((f, i) => (
              <Card key={f.key} size="small" style={tankCard} title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ color: '#0958d9' }}><DatabaseOutlined style={{ marginInlineEnd: 6 }} />{`الخزان ${i + 1}`}</Text>
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(f.name)}>حذف</Button>
                </div>}>
                <Row gutter={12}>
                  <Col xs={24} md={8}><Form.Item name={[f.name, 'tankNo']} label="رقم الخزان">
                    <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder={`T${i + 1}`} style={{ ...inputStyle, direction: 'ltr' }} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name={[f.name, 'gasType']} label="نوع الغاز" rules={[{ required: true, message: 'الرجاء اختيار نوع الغاز' }]}>
                    <Select style={inputStyle} options={(ref?.gasTypes ?? []).map(g => ({ value: g.code, label: `${g.code} — ${locName(g, isAr)}` }))} /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name={[f.name, 'serialNo']} label="الرقم التسلسلي">
                    <Input prefix={<NumberOutlined style={{ color: '#bbb' }} />} placeholder="SN-XXXXXXXX" style={{ ...inputStyle, direction: 'ltr' }} /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name={[f.name, 'capacityLitres']} label="السعة (لتر)" rules={[{ required: true, message: 'الرجاء إدخال السعة' }]}>
                    <InputNumber min={1} placeholder="5000" style={{ ...inputStyle, width: '100%' }} addonAfter="لتر" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name={[f.name, 'currentLevelLitres']} label="المستوى الحالي (لتر)">
                    <InputNumber min={0} style={{ ...inputStyle, width: '100%' }} addonAfter="لتر" /></Form.Item></Col>
                </Row>
              </Card>
            ))}
            <Button type="dashed" block size="large" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => add({ gasType: 'LPG' })}>إضافة خزان</Button>
          </>
        )}
      </Form.List>
    </div>
  );

  // contracts are optional: gas, AMC, both or none — each on its own tab with an «add this contract» switch
  const contractSwitch = (on: boolean, set: (v: boolean) => void, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', marginBottom: 14,
      borderRadius: 10, background: on ? '#f6ffed' : '#fafafa', border: `1px solid ${on ? '#b7eb8f' : '#f0f0f0'}` }}>
      <span><Switch checked={on} onChange={set} style={{ marginInlineEnd: 10 }} /><Text strong>{label}</Text></span>
      {on ? <Tag color="green" style={{ margin: 0 }}><CheckCircleOutlined /> يُسجَّل كعقد جديد عند الحفظ</Tag>
        : <Text type="secondary" style={{ fontSize: 12 }}>اختياري — يمكن إضافته لاحقاً من ملف {noun}</Text>}
    </div>
  );
  const tabLabel = (icon: React.ReactNode, title: string, on: boolean) => (
    <span>{icon} {title} <Tag color={on ? 'green' : 'default'} style={{ marginInlineStart: 6, fontSize: 11 }}>{on ? 'سيُضاف' : 'بدون'}</Tag></span>
  );
  const contractStepBody = (
    <div>
      {hint(`العقود اختيارية: أضف عقد توريد الغاز أو عقد الخدمة والصيانة أو كليهما. كل عقد مُفعّل يُسجَّل مباشرةً في النظام عند حفظ ${noun}.`)}
      <Tabs activeKey={contractTab} onChange={k => setContractTab(k as 'gas' | 'amc')} type="card" items={[
        { key: 'gas', forceRender: true, label: tabLabel(<FileProtectOutlined />, 'عقد توريد الغاز', withGas), children: (
          <div style={contractCard}>
            <div style={{ padding: 14 }}>
              {contractSwitch(withGas, setWithGas, 'إضافة عقد توريد الغاز (سعر اللتر)')}
              {withGas
                ? <ContractFields prefix={['contract']} signers={isVilla ? undefined : signerOptions}
                    signerHint={isVilla ? undefined : 'يجب أن يكون الموقّع من طاقم المطعم المخولين بالتوقيع (الخطوة السابقة)'} />
                : <Text type="secondary">لن يُضاف عقد توريد غاز. يظهر العقد عند إضافته في «عقود توريد الغاز».</Text>}
            </div>
          </div>) },
        { key: 'amc', forceRender: true, label: tabLabel(<ToolOutlined />, 'عقد الصيانة (AMC)', withAmc), children: (
          <div style={amcCard}>
            <div style={{ padding: 14 }}>
              {contractSwitch(withAmc, setWithAmc, 'إضافة عقد الخدمة والصيانة (AMC)')}
              {withAmc
                ? <>
                    {!isVilla && <Alert type="info" showIcon style={{ marginBottom: 12, borderRadius: 8 }} message="عقد الصيانة خاص بهذا المطعم فقط — لا يُحسب كعقد للمبنى الذي يقع فيه." />}
                    <AmcFields prefix={['amc']} terms={amcTerms} onTermsChange={setAmcTerms} />
                  </>
                : <Text type="secondary">لن يُضاف عقد صيانة. بدون عقد صيانة ساري لا يمكن فتح طلبات الخدمة لـ{noun}.</Text>}
            </div>
          </div>) },
      ]} />
      {!isVilla && (
        <Form.Item name="notes" label="ملاحظات">
          <Input.TextArea rows={3} placeholder="أي معلومات إضافية عن المطعم" style={inputStyle} />
        </Form.Item>
      )}
    </div>
  );

  const addressStep = (
    <div>
      {hint('أدخل عنوان الفيلا وأي ملاحظات إضافية')}
      <Row gutter={12}>
        <Col xs={24} md={12}><Form.Item name="cityId" label="المدينة"><Select allowClear showSearch optionFilterProp="label" placeholder="اختر المدينة" style={inputStyle}
          options={(ref?.cities ?? []).map(c => ({ value: c.id, label: locName(c, isAr) }))} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="zone" label="المنطقة"><Input style={inputStyle} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="street" label="الشارع"><Input style={inputStyle} /></Form.Item></Col>
        <Col xs={24} md={12}><Form.Item name="poBox" label="صندوق البريد"><Input dir="ltr" style={inputStyle} /></Form.Item></Col>
        <Col xs={24}><Form.Item name="address" label="العنوان التفصيلي"><Input prefix={<EnvironmentOutlined style={{ color: '#bbb' }} />} style={inputStyle} /></Form.Item></Col>
        <Col xs={12}><Form.Item name="latitude" label="خط العرض"><InputNumber style={{ ...inputStyle, width: '100%' }} step={0.000001} /></Form.Item></Col>
        <Col xs={12}><Form.Item name="longitude" label="خط الطول"><InputNumber style={{ ...inputStyle, width: '100%' }} step={0.000001} /></Form.Item></Col>
      </Row>
      <Form.Item name="notes" label="ملاحظات">
        <Input.TextArea rows={3} placeholder="أي معلومات إضافية عن الفيلا" style={inputStyle} />
      </Form.Item>
    </div>
  );

  const bodies = isVilla
    ? [infoStep, ownerStep, tanksStep, contractStepBody, addressStep]
    : [infoStep, ownerStep, signatoriesStep, tanksStep, contractStepBody];

  return (
    <Modal open={open} onCancel={done ? close : confirmCancel} maskClosable={false} footer={null} width={1100} centered destroyOnHidden
      styles={{ body: { padding: 0 } }} style={{ borderRadius: 16, overflow: 'hidden' }}>
      {/* Header — same as «إضافة مبنى جديد» */}
      <div style={{ background: `linear-gradient(135deg, ${PRIMARY}, #0b2e18)`, padding: '20px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: done ? 0 : 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>
            {isVilla ? <HomeOutlined /> : <ShopOutlined />}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{isVilla ? 'إضافة فيلا جديدة' : 'إضافة مطعم جديد'}</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{done ? 'تم الحفظ بنجاح' : `الخطوة ${step + 1} من ${STEPS.length}`}</div>
          </div>
        </div>
        {!done && (
          <Steps current={step} size="small"
            items={STEPS.map(s => ({ title: <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{s.title}</span>, icon: s.icon }))}
            style={{ '--ant-steps-icon-size': '28px' } as any} />
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '28px 32px', maxHeight: '65vh', overflowY: 'auto' }}>
        {done ? (
          <Result status="success" icon={<CheckCircleOutlined style={{ color: PRIMARY, fontSize: 56 }} />}
            title={<span style={{ color: PRIMARY, fontWeight: 700 }}>{`تم إضافة ${noun} بنجاح! (${created!.code})`}</span>}
            subTitle={<>
              {created!.contracts.length > 0 && <div style={{ marginBottom: 8 }}>{created!.contracts.map(c => <Tag key={c} color="green" style={{ margin: 3 }}><CheckCircleOutlined /> {c}</Tag>)}</div>}
              {created!.warnings.length
              ? <Alert type="warning" showIcon style={{ textAlign: 'start', borderRadius: 8 }} message="ملاحظات" description={<ul style={{ margin: 0, paddingInlineStart: 18 }}>{created!.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>} />
              : `ستظهر ${isVilla ? 'الفيلا الجديدة في قائمة الفلل' : 'المطعم الجديد في قائمة المطاعم'}`}
            </>}
            extra={[
              <Button key="another" onClick={reset}>{isVilla ? 'إضافة فيلا أخرى' : 'إضافة مطعم آخر'}</Button>,
              <Button key="close" onClick={close}>إغلاق</Button>,
              <Button key="open" type="primary" style={{ background: PRIMARY, borderColor: PRIMARY }} onClick={() => onSaved(created!.id)}>
                {isVilla ? 'فتح ملف الفيلا' : 'فتح ملف المطعم'}</Button>,
            ]} />
        ) : (
          <Form form={form} layout="vertical" size="large">
            {bodies[step]}
          </Form>
        )}
      </div>

      {/* Footer */}
      {!done && (
        <div style={{ padding: '16px 32px 24px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0' }}>
          <Button size="large" style={{ borderRadius: 8, minWidth: 100 }} disabled={saving} onClick={step === 0 ? confirmCancel : prev}>
            {step === 0 ? 'إلغاء' : 'السابق'}
          </Button>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginInlineEnd: 16 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, background: i === step ? PRIMARY : i < step ? '#a5d6a7' : '#e0e0e0', transition: 'all 0.3s' }} />
              ))}
            </div>
            <Button type="primary" size="large" loading={saving}
              style={{ background: PRIMARY, borderColor: PRIMARY, borderRadius: 8, minWidth: 120, fontWeight: 600 }}
              onClick={step < STEPS.length - 1 ? next : finish}>
              {step < STEPS.length - 1 ? 'التالي ←' : isVilla ? 'حفظ الفيلا' : 'حفظ المطعم'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
