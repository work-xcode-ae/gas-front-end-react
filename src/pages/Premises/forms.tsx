import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Switch, Row, Col, Segmented, Divider, Button, Space, Alert, Typography, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined, UserOutlined, ShopOutlined, HomeOutlined, FireOutlined, FileProtectOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { api, errorMessage, type Paged } from '../../api/client';
import { useReference, locName } from '../../api/reference';
import { premisesApi, type ContractInput, type PremisesType, type SignatoryInput } from '../../api/premises';
import { useTaxOptions } from '../Invoices/shared';
import ContractTermsPicker from '../../components/ContractTermsPicker';
import { toTermInputs, type ContractTermItem } from '../../api/terms';

const { Text } = Typography;
export const PRIMARY = '#1a5c2a';
export const GOLD = '#c9a84c';
export const money = (n?: number | null) => `${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.إ`;
export const litres = (n?: number | null) => `${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} لتر`;
export const d10 = (v?: string | null) => (v ? String(v).slice(0, 10) : '—');
export const iso = (d?: dayjs.Dayjs | null) => (d ? d.format('YYYY-MM-DD') : null);
export const blank = (s?: string | null) => (s && s.trim() ? s.trim() : null);

// ─────────────────────────── owner (existing party or a new one) ───────────────────────────

/** Party picker with server search (GET /parties). */
export function PartySelect({ value, onChange }: { value?: number; onChange?: (v?: number) => void }) {
  const [opts, setOpts] = useState<any[]>([]);
  const search = (s?: string) => api<Paged<any>>('/parties', { query: { search: s || undefined, pageSize: 30 } }).then(r => setOpts(r.items)).catch(() => setOpts([]));
  useEffect(() => { search(); }, []);
  useEffect(() => {
    if (value && !opts.some(o => o.id === value)) api<any>(`/parties/${value}`).then(p => setOpts(o => [p, ...o])).catch(() => undefined);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Select showSearch allowClear filterOption={false} onSearch={search} value={value} onChange={onChange} placeholder="ابحث بالاسم أو الهاتف أو الرمز"
      options={opts.map(o => ({ value: o.id, label: `${o.nameAr ?? o.nameEn ?? ''}${o.phone ? ` · ${o.phone}` : ''} (${o.partyCode ?? o.id})` }))} />
  );
}

/** Owner fields: form fields ownerMode, ownerPartyId, owner.{…}. */
export function OwnerFields({ title, company }: { title: string; company?: boolean }) {
  const form = Form.useFormInstance();
  const mode = Form.useWatch('ownerMode', form) ?? 'new';
  return (
    <>
      <Divider titlePlacement="start"><UserOutlined /> {title}</Divider>
      <Form.Item name="ownerMode" initialValue="new" style={{ marginBottom: 8 }}>
        <Segmented options={[{ value: 'new', label: 'جديد' }, { value: 'existing', label: 'من الأطراف المسجلة' }]} />
      </Form.Item>
      {mode === 'existing' ? (
        <Form.Item name="ownerPartyId" label="المالك" rules={[{ required: true, message: 'اختر المالك' }]}><PartySelect /></Form.Item>
      ) : (
        <Row gutter={12}>
          <Col xs={24} md={8}><Form.Item name={['owner', 'partyType']} label="النوع" initialValue={company ? 'company' : 'individual'}>
            <Select options={[{ value: 'individual', label: 'فرد' }, { value: 'company', label: 'شركة' }]} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name={['owner', 'nameAr']} label="الاسم (عربي)" rules={[{ required: true, message: 'اسم المالك مطلوب' }]}><Input /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name={['owner', 'nameEn']} label="الاسم (إنجليزي)"><Input dir="ltr" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name={['owner', 'phone']} label="الهاتف" rules={[{ required: true, message: 'الهاتف مطلوب' }]}><Input dir="ltr" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name={['owner', 'email']} label="البريد الإلكتروني" rules={[{ type: 'email', message: 'بريد غير صحيح' }]}><Input dir="ltr" /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name={['owner', 'emiratesId']} label="رقم الهوية"><Input dir="ltr" placeholder="784-XXXX-XXXXXXX-X" /></Form.Item></Col>
          {company && <Col xs={24} md={8}><Form.Item name={['owner', 'tradeLicenseNo']} label="الرخصة التجارية"><Input dir="ltr" /></Form.Item></Col>}
          <Col xs={24} md={8}><Form.Item name={['owner', 'taxNumber']} label="الرقم الضريبي (TRN)"><Input dir="ltr" /></Form.Item></Col>
        </Row>
      )}
    </>
  );
}

export const ownerRef = (v: any) => (v.ownerMode === 'existing'
  ? { partyId: v.ownerPartyId }
  : { party: { ...v.owner, nameAr: blank(v.owner?.nameAr), nameEn: blank(v.owner?.nameEn), phone: blank(v.owner?.phone), email: blank(v.owner?.email),
               emiratesId: blank(v.owner?.emiratesId), tradeLicenseNo: blank(v.owner?.tradeLicenseNo), taxNumber: blank(v.owner?.taxNumber) } });

// ─────────────────────────── tanks ───────────────────────────

export function TankListFields() {
  const { i18n } = useTranslation();
  const { data: ref } = useReference(i18n.language);
  return (
    <>
      <Divider titlePlacement="start"><FireOutlined /> الخزانات</Divider>
      <Form.List name="tanks">
        {(fields, { add, remove }) => (
          <>
            {fields.map(f => (
              <Row gutter={8} key={f.key} align="bottom">
                <Col xs={12} md={4}><Form.Item name={[f.name, 'tankNo']} label="رقم الخزان"><Input placeholder={`T${f.name + 1}`} /></Form.Item></Col>
                <Col xs={12} md={5}><Form.Item name={[f.name, 'gasType']} label="نوع الغاز" initialValue="LPG">
                  <Select options={(ref?.gasTypes ?? []).map(g => ({ value: g.code, label: locName(g, true) || g.code }))} /></Form.Item></Col>
                <Col xs={12} md={5}><Form.Item name={[f.name, 'capacityLitres']} label="السعة (لتر)" rules={[{ required: true, message: 'السعة' }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={12} md={5}><Form.Item name={[f.name, 'currentLevelLitres']} label="المستوى الحالي (لتر)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                <Col xs={20} md={4}><Form.Item name={[f.name, 'serialNo']} label="الرقم التسلسلي"><Input dir="ltr" /></Form.Item></Col>
                <Col xs={4} md={1}><Form.Item><MinusCircleOutlined style={{ color: '#ff4d4f' }} onClick={() => remove(f.name)} /></Form.Item></Col>
              </Row>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ gasType: 'LPG' })}>إضافة خزان</Button>
          </>
        )}
      </Form.List>
    </>
  );
}

export const tanksOf = (v: any) => (v.tanks ?? []).filter(Boolean).map((t: any) => ({
  tankNo: blank(t.tankNo) ?? undefined, gasType: t.gasType ?? 'LPG', capacityLitres: Number(t.capacityLitres),
  currentLevelLitres: t.currentLevelLitres ?? undefined, serialNo: blank(t.serialNo) ?? undefined,
}));

// ─────────────────────────── signatories (restaurant staff who may sign) ───────────────────────────

export function SignatoryListFields() {
  return (
    <>
      <Divider titlePlacement="start"><FileProtectOutlined /> المخولون بالتوقيع (من طاقم المطعم)</Divider>
      <Form.List name="signatories">
        {(fields, { add, remove }) => (
          <>
            {fields.map(f => (
              <Row gutter={8} key={f.key} align="bottom">
                <Col xs={12} md={5}><Form.Item name={[f.name, 'nameAr']} label="الاسم" rules={[{ required: true, message: 'الاسم' }]}><Input /></Form.Item></Col>
                <Col xs={12} md={4}><Form.Item name={[f.name, 'position']} label="المنصب"><Input placeholder="مدير المطعم" /></Form.Item></Col>
                <Col xs={12} md={4}><Form.Item name={[f.name, 'emiratesId']} label="رقم الهوية"><Input dir="ltr" /></Form.Item></Col>
                <Col xs={12} md={4}><Form.Item name={[f.name, 'phone']} label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
                <Col xs={16} md={5}><Form.Item name={[f.name, 'canSignContracts']} label="مخول بتوقيع العقود" valuePropName="checked" initialValue><Switch /></Form.Item></Col>
                <Col xs={4} md={2}><Form.Item><MinusCircleOutlined style={{ color: '#ff4d4f' }} onClick={() => remove(f.name)} /></Form.Item></Col>
              </Row>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ canSignContracts: true })}>إضافة شخص مخول</Button>
          </>
        )}
      </Form.List>
    </>
  );
}

export const signatoryOf = (s: any): SignatoryInput => ({
  nameAr: blank(s.nameAr), nameEn: blank(s.nameEn), position: blank(s.position), emiratesId: blank(s.emiratesId), phone: blank(s.phone),
  email: blank(s.email), canSignContracts: !!s.canSignContracts, notes: blank(s.notes), isActive: s.isActive ?? true,
});

// ─────────────────────────── delivery contract (price per litre) ───────────────────────────

/**
 * Contract fields under the form path `prefix` (e.g. ['contract']).
 * signers: restaurant → list of {value,label} of authorised signatories; villa → undefined (the owner signs).
 */
export function ContractFields({ prefix, signers, signerHint }: { prefix: (string | number)[]; signers?: { value: number; label: string }[]; signerHint?: string }) {
  const form = Form.useFormInstance();
  const start = Form.useWatch([...prefix, 'startDate'], form) as dayjs.Dayjs | undefined;
  const autoRenew = Form.useWatch([...prefix, 'autoRenew'], form);
  const price = Form.useWatch([...prefix, 'pricePerLitre'], form);
  const tax = useTaxOptions(start, 'sales');
  const p = (n: string) => [...prefix, n];
  return (
    <>
      <Row gutter={12}>
        <Col xs={12} md={6}><Form.Item name={p('startDate')} label="بداية العقد" initialValue={dayjs()} rules={[{ required: true, message: 'التاريخ' }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('durationMonths')} label="المدة (شهر)" initialValue={12}><InputNumber min={1} max={120} style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('endDate')} label="أو تاريخ النهاية"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('pricePerLitre')} label="سعر اللتر (قبل الضريبة)" rules={[{ required: true, message: 'السعر مطلوب' }]}>
          <InputNumber min={0.0001} step={0.01} style={{ width: '100%' }} addonAfter="د.إ" /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('taxRateId')} label="الضريبة" tooltip="فارغ = الضريبة الافتراضية للمبيعات في تاريخ الفاتورة">
          <Select allowClear placeholder={tax.defaultOption ? `افتراضي (${Number(tax.defaultOption.rate)}%)` : 'افتراضي'}
            options={tax.items.map(t => ({ value: t.id, label: `${t.code} — ${Number(t.rate)}%` }))} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('paymentTermsDays')} label="مدة السداد (يوم)"><InputNumber min={0} max={365} style={{ width: '100%' }} placeholder="الافتراضي" /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('signedDate')} label="تاريخ التوقيع" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
        <Col xs={12} md={6}><Form.Item name={p('autoRenew')} label="تجديد تلقائي" valuePropName="checked" initialValue={false}><Switch /></Form.Item></Col>
        {autoRenew && <Col xs={12} md={6}><Form.Item name={p('renewalPeriodMonths')} label="مدة التجديد (شهر)" initialValue={12} rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>}
        {signers ? (
          <Col xs={24} md={12}><Form.Item name={p('signatory')} label="الموقّع عن المطعم" rules={[{ required: true, message: 'اختر الشخص المخول بالتوقيع' }]}
            extra={signerHint}><Select placeholder="من المخولين بالتوقيع" options={signers} notFoundContent="أضف شخصاً مخولاً بالتوقيع أولاً" /></Form.Item></Col>
        ) : (
          <Col xs={24} md={12}><Form.Item name={p('signedByName')} label="الموقّع" extra="الفيلا: المالك يطلب الخدمة ويوقّع العقد (فارغ = اسم المالك)"><Input /></Form.Item></Col>
        )}
        <Col xs={24}><Form.Item name={p('notes')} label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
      </Row>
      {/* terms & conditions — the Settings «supply» terms, same as the building gas contract; editable for this contract only */}
      <Divider titlePlacement="start"><FileProtectOutlined /> الشروط والأحكام</Divider>
      <Form.Item name={p('termItems')} style={{ marginBottom: 12 }}>
        <TermsField />
      </Form.Item>
      {price > 0 && <Alert type="info" showIcon style={{ marginBottom: 8 }}
        message={`تُصدر فاتورة كل تعبئة بعد التوصيل: اللترات المورّدة × ${Number(price).toLocaleString()} د.إ + الضريبة (زر «إصدار فاتورة» في التعبئات الجاهزة).`} />}
    </>
  );
}

/** Form.Item adapter: ContractTermsPicker as a form field (value undefined → the Settings defaults are pre-selected). */
function TermsField({ value, onChange }: { value?: ContractTermItem[]; onChange?: (v: ContractTermItem[]) => void }) {
  return <ContractTermsPicker contractType="supply" value={value} onChange={v => onChange?.(v)} />;
}

/** GET contract terms → picker items (edit). */
export const termItemsOf = (terms?: any[] | null): ContractTermItem[] =>
  (terms ?? []).map((t: any) => ({ key: `e${t.id}`, templateId: t.templateId ?? null, category: t.category ?? 'general', text: t.text ?? '' }));

export const contractOf = (c: any, signatory?: { id?: number | null; index?: number | null }): ContractInput => ({
  startDate: iso(c.startDate)!, endDate: iso(c.endDate), durationMonths: c.endDate ? null : (c.durationMonths ?? 12),
  pricePerLitre: Number(c.pricePerLitre), taxRateId: c.taxRateId ?? null, paymentTermsDays: c.paymentTermsDays ?? null,
  signatoryId: signatory?.id ?? null, signatoryIndex: signatory?.index ?? null, signedByName: blank(c.signedByName), signedDate: iso(c.signedDate),
  autoRenew: !!c.autoRenew, renewalPeriodMonths: c.autoRenew ? c.renewalPeriodMonths ?? 12 : null, notes: blank(c.notes),
  termItems: c.termItems ? toTermInputs(c.termItems) : null,
});

// ─────────────────────────── create / edit a villa or a restaurant ───────────────────────────

/**
 * Create (editing = null) or edit (editing = GET /premises/{id}) a villa / restaurant.
 * Restaurant: buildingId fixed when opened from a building, else chosen here.
 */
export function PremisesFormModal({ type, open, editing, buildingId, onClose, onSaved }: {
  type: PremisesType; open: boolean; editing?: any | null; buildingId?: number; onClose: () => void; onSaved: (id: number) => void;
}) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const { data: ref } = useReference(i18n.language);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const withContract = Form.useWatch('withContract', form);
  const signatories = Form.useWatch('signatories', form) as any[] | undefined;
  const chosenBuilding = Form.useWatch('buildingId', form) as number | undefined;
  const isVilla = type === 'villa';
  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) {
      const e = editing;
      form.setFieldsValue({
        nameAr: e.nameAr, nameEn: e.nameEn, notes: e.notes, ownerMode: 'existing', ownerPartyId: e.owner?.id,
        branchId: e.branchId, buildingId: e.building?.id, unitId: e.unit?.id ?? undefined,
        cityId: e.building?.cityId, zone: e.building?.zone, street: e.building?.street, poBox: e.building?.poBox, address: e.building?.address,
        latitude: e.building?.latitude, longitude: e.building?.longitude,
        ...(e.villa ?? {}),
        ...(e.restaurant ? { ...e.restaurant, tradeLicenseExpiry: e.restaurant.tradeLicenseExpiry ? dayjs(e.restaurant.tradeLicenseExpiry) : undefined } : {}),
      });
    } else {
      form.setFieldsValue({ buildingId, branchId: ref?.branches?.[0]?.id, withContract: true, tanks: [{ gasType: 'LPG' }], signatories: isVilla ? undefined : [{ canSignContracts: true }] });
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || isVilla || buildingId) return;
    api<Paged<any>>('/buildings', { query: { pageSize: 0, kind: 'building' } }).then(r => setBuildings(r.items)).catch(() => setBuildings([]));
  }, [open, isVilla, buildingId]);
  useEffect(() => {
    const b = chosenBuilding ?? buildingId;
    if (!open || isVilla || !b) { setUnits([]); return; }
    api<Paged<any>>('/units', { query: { buildingId: b, pageSize: 0 } }).then(r => setUnits(r.items)).catch(() => setUnits([]));
  }, [open, isVilla, chosenBuilding, buildingId]);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const owner = ownerRef(v);
      if (isVilla) {
        const body = {
          branchId: v.branchId, nameAr: blank(v.nameAr), nameEn: blank(v.nameEn), owner, cityId: v.cityId ?? null, zone: blank(v.zone), street: blank(v.street),
          poBox: blank(v.poBox), address: blank(v.address), latitude: v.latitude ?? null, longitude: v.longitude ?? null,
          community: blank(v.community), plotNo: blank(v.plotNo), villaNo: blank(v.villaNo), makaniNo: blank(v.makaniNo), bedrooms: v.bedrooms ?? null, notes: blank(v.notes),
          tanks: isEdit ? undefined : tanksOf(v), contract: !isEdit && v.withContract ? contractOf(v.contract) : null,
        };
        if (isEdit) { await premisesApi.updateVilla(editing.id, body); onSaved(editing.id); }
        else { const r = await premisesApi.createVilla(body); message.success(`تم إنشاء الفيلا ${r.code}`); onSaved(r.id); }
      } else {
        const sigs = (v.signatories ?? []).filter(Boolean).map(signatoryOf);
        const body = {
          buildingId: v.buildingId ?? buildingId, unitId: v.unitId ?? null, nameAr: blank(v.nameAr), nameEn: blank(v.nameEn), owner,
          tradeName: blank(v.tradeName), tradeLicenseNo: blank(v.tradeLicenseNo), tradeLicenseExpiry: iso(v.tradeLicenseExpiry),
          seatingCapacity: v.seatingCapacity ?? null, burnersCount: v.burnersCount ?? null, kitchenType: v.kitchenType ?? null,
          cuisine: blank(v.cuisine), operatingHours: blank(v.operatingHours), notes: blank(v.notes),
          signatories: isEdit ? undefined : sigs, tanks: isEdit ? undefined : tanksOf(v),
          contract: !isEdit && v.withContract ? contractOf(v.contract, { index: v.contract?.signatory }) : null,
        };
        if (isEdit) { await premisesApi.updateRestaurant(editing.id, body); onSaved(editing.id); }
        else { const r = await premisesApi.createRestaurant(body); message.success(`تمت إضافة المطعم ${r.code}`); onSaved(r.id); }
      }
    } catch (e) { message.error(errorMessage(e), 6); }
    finally { setSaving(false); }
  };

  const signerOptions = (signatories ?? []).map((s, i) => ({ s, i })).filter(x => x.s && x.s.canSignContracts && x.s.nameAr)
    .map(x => ({ value: x.i, label: `${x.s.nameAr}${x.s.position ? ` — ${x.s.position}` : ''}` }));

  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} width={Math.min(window.innerWidth - 24, 980)} destroyOnHidden
      okText={isEdit ? 'حفظ' : 'إنشاء'} cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY } }}
      title={<Space>{isVilla ? <HomeOutlined /> : <ShopOutlined />}{isEdit ? `تعديل ${isVilla ? 'الفيلا' : 'المطعم'} ${editing?.code ?? ''}` : isVilla ? 'فيلا جديدة' : 'مطعم جديد'}</Space>}>
      <Form form={form} layout="vertical" size="middle" style={{ marginTop: 12 }}>
        {isVilla ? (
          <Row gutter={12}>
            <Col xs={24} md={8}><Form.Item name="nameAr" label="اسم الفيلا (عربي)" rules={[{ required: true, message: 'الاسم مطلوب' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nameEn" label="الاسم (إنجليزي)"><Input dir="ltr" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="branchId" label="الفرع" rules={[{ required: true }]}>
              <Select disabled={isEdit} options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="community" label="المنطقة / المجمع"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="villaNo" label="رقم الفيلا"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="plotNo" label="رقم القطعة"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="makaniNo" label="رقم مكاني"><Input dir="ltr" /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="cityId" label="المدينة"><Select allowClear showSearch optionFilterProp="label"
              options={(ref?.cities ?? []).map(c => ({ value: c.id, label: locName(c, isAr) }))} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="street" label="الشارع"><Input /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="bedrooms" label="غرف النوم"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="poBox" label="ص.ب"><Input /></Form.Item></Col>
            <Col xs={24}><Form.Item name="address" label="العنوان"><Input /></Form.Item></Col>
          </Row>
        ) : (
          <Row gutter={12}>
            {!buildingId && (
              <Col xs={24} md={12}><Form.Item name="buildingId" label="المبنى" rules={[{ required: true, message: 'اختر المبنى' }]}>
                <Select showSearch optionFilterProp="label" disabled={isEdit} placeholder="المبنى الذي يقع فيه المطعم"
                  options={buildings.map(b => ({ value: b.id, label: `${b.code} — ${b.name ?? b.nameAr ?? ''}` }))} /></Form.Item></Col>
            )}
            <Col xs={24} md={buildingId ? 8 : 12}><Form.Item name="unitId" label="الوحدة (اختياري)">
              <Select allowClear showSearch optionFilterProp="label" placeholder="المحل / الوحدة داخل المبنى"
                options={units.map(u => ({ value: u.id, label: `${u.no}${u.floor != null ? ` — طابق ${u.floor}` : ''}${u.typeLabel ? ` · ${u.typeLabel}` : ''}` }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nameAr" label="اسم المطعم (عربي)" rules={[{ required: true, message: 'الاسم مطلوب' }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="nameEn" label="الاسم (إنجليزي)"><Input dir="ltr" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="tradeName" label="الاسم التجاري"><Input /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="tradeLicenseNo" label="رقم الرخصة التجارية"><Input dir="ltr" /></Form.Item></Col>
            <Col xs={12} md={8}><Form.Item name="tradeLicenseExpiry" label="انتهاء الرخصة"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="kitchenType" label="نوع المطبخ"><Select allowClear options={(ref?.lookups?.KITCHEN_TYPE ?? []).map(k => ({ value: k.code, label: k.label }))} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="cuisine" label="نوع المطبخ / الأكل"><Input placeholder="عربي، هندي…" /></Form.Item></Col>
            <Col xs={12} md={4}><Form.Item name="seatingCapacity" label="المقاعد"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={12} md={4}><Form.Item name="burnersCount" label="عدد الشعلات"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="operatingHours" label="ساعات العمل"><Input placeholder="10:00–24:00" /></Form.Item></Col>
          </Row>
        )}

        <OwnerFields title={isVilla ? 'مالك الفيلا (هو العميل والموقّع — لا يوجد مستأجر)' : 'مالك المطعم'} company={!isVilla} />
        {isEdit && <Text type="secondary" style={{ fontSize: 12 }}>تغيير المالك يغيّر العميل في العقود والفواتير الجديدة فقط.</Text>}

        {!isVilla && !isEdit && <SignatoryListFields />}
        {!isEdit && <TankListFields />}
        {!isEdit && (
          <>
            <Divider titlePlacement="start"><FileProtectOutlined /> عقد التوريد (الدفع حسب التعبئة)</Divider>
            <Form.Item name="withContract" valuePropName="checked" label="إنشاء العقد الآن"><Switch /></Form.Item>
            {withContract && <ContractFields prefix={['contract']} signers={isVilla ? undefined : signerOptions}
              signerHint={isVilla ? undefined : 'يجب أن يكون الموقّع من طاقم المطعم المخولين بالتوقيع'} />}
          </>
        )}
        <Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  );
}

// ─────────────────────────── contract modal (add / edit) ───────────────────────────

export function ContractModal({ site, contract, open, onClose, onSaved }: { site: any; contract?: any | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const isRestaurant = site?.type === 'restaurant';
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (contract) form.setFieldsValue({ c: {
      startDate: dayjs(contract.startDate), endDate: contract.endDate ? dayjs(contract.endDate) : undefined, durationMonths: undefined,
      pricePerLitre: contract.pricePerLitre, taxRateId: contract.taxRateId ?? undefined, paymentTermsDays: contract.paymentTermsDays ?? undefined,
      signedDate: contract.signedDate ? dayjs(contract.signedDate) : undefined, autoRenew: contract.autoRenew, renewalPeriodMonths: contract.renewalPeriodMonths ?? undefined,
      signatory: contract.signatoryId ?? undefined, signedByName: contract.signedByName, notes: contract.notes, termItems: termItemsOf(contract.terms) } });
  }, [open, contract]); // eslint-disable-line react-hooks/exhaustive-deps
  const signers = isRestaurant
    ? (site?.signatories ?? []).filter((s: any) => s.isActive && s.canSignContracts).map((s: any) => ({ value: s.id, label: `${s.name}${s.position ? ` — ${s.position}` : ''}` }))
    : undefined;
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const body = contractOf(v.c, { id: isRestaurant ? v.c.signatory : null });
      if (contract) await premisesApi.updateContract(contract.id, body);
      else await premisesApi.addContract(site.id, body);
      message.success('تم حفظ العقد');
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} width={Math.min(window.innerWidth - 24, 860)} destroyOnHidden
      title={contract ? `تعديل العقد ${contract.contractNo}` : `عقد توريد جديد — ${site?.code ?? ''}`} okText="حفظ" cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY } }}>
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <ContractFields prefix={['c']} signers={signers} signerHint={isRestaurant ? 'من طاقم المطعم المخولين بالتوقيع (تبويب المخولون)' : undefined} />
      </Form>
    </Modal>
  );
}

// ─────────────────────────── signatory modal ───────────────────────────

export function SignatoryModal({ siteId, signatory, open, onClose, onSaved }: { siteId: number; signatory?: any | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue(signatory ?? { canSignContracts: true, isActive: true }); } }, [open, signatory]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      if (signatory) await premisesApi.updateSignatory(siteId, signatory.id, signatoryOf(v));
      else await premisesApi.addSignatory(siteId, signatoryOf(v));
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} destroyOnHidden title={signatory ? 'تعديل الشخص المخول' : 'إضافة شخص مخول بالتوقيع'}
      okText="حفظ" cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY } }}>
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="nameAr" label="الاسم (عربي)" rules={[{ required: true, message: 'الاسم مطلوب' }]}><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="nameEn" label="الاسم (إنجليزي)"><Input dir="ltr" /></Form.Item></Col>
          <Col span={12}><Form.Item name="position" label="المنصب"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="emiratesId" label="رقم الهوية"><Input dir="ltr" /></Form.Item></Col>
          <Col span={12}><Form.Item name="phone" label="الهاتف"><Input dir="ltr" /></Form.Item></Col>
          <Col span={12}><Form.Item name="email" label="البريد الإلكتروني" rules={[{ type: 'email' }]}><Input dir="ltr" /></Form.Item></Col>
          <Col span={12}><Form.Item name="canSignContracts" label="مخول بتوقيع العقود" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={12}><Form.Item name="isActive" label="نشط" valuePropName="checked"><Switch /></Form.Item></Col>
          <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea rows={2} /></Form.Item></Col>
        </Row>
      </Form>
    </Modal>
  );
}

// ─────────────────────────── issue the invoice of a delivered refill ───────────────────────────

export function InvoiceRefillModal({ row, open, onClose, onDone }: { row: any | null; open: boolean; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setDate(dayjs()); setNotes(''); } }, [open]);
  if (!row) return null;
  const submit = async () => {
    setSaving(true);
    try {
      const r = await premisesApi.invoiceRefill(row.refillRequestId, date.format('YYYY-MM-DD'), notes || undefined);
      message.success(`تم إصدار الفاتورة ${r.invoiceNo} — ${money(r.totalAmount)}`, 5);
      onDone();
    } catch (e) { message.error(errorMessage(e), 7); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onCancel={onClose} onOk={submit} confirmLoading={saving} okText="إصدار الفاتورة وترحيلها" cancelText="إلغاء"
      okButtonProps={{ style: { background: PRIMARY }, disabled: row.missingContract }} title={`فاتورة التعبئة ${row.requestNo} — ${row.premisesCode}`}>
      <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
        <Row gutter={12}>
          <Col span={8}><Text type="secondary">الكمية المورّدة</Text><div><Text strong>{litres(row.deliveredLitres)}</Text></div></Col>
          <Col span={8}><Text type="secondary">سعر اللتر (العقد)</Text><div><Text strong>{row.pricePerLitre != null ? Number(row.pricePerLitre).toLocaleString() : '—'}</Text></div></Col>
          <Col span={8}><Text type="secondary">المبلغ قبل الضريبة</Text><div><Text strong style={{ color: PRIMARY }}>{row.estimatedAmount != null ? money(row.estimatedAmount) : '—'}</Text></div></Col>
        </Row>
        {row.missingContract && <Alert type="warning" showIcon message="لا يوجد عقد توريد نشط في تاريخ التوصيل. أضف العقد (سعر اللتر) أولاً." />}
        <div><Text type="secondary">تاريخ الفاتورة</Text><DatePicker value={date} onChange={d => d && setDate(d)} style={{ width: '100%' }}
          disabledDate={d => d.isAfter(dayjs(), 'day') || (row.deliveredAt && d.isBefore(dayjs(row.deliveredAt), 'day'))} /></div>
        <div><Text type="secondary">ملاحظات (اختياري)</Text><Input.TextArea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <Text type="secondary" style={{ fontSize: 12 }}>تُرحّل الفاتورة إلى حساب العميل (المالك) وإيرادات الغاز 4101 وضريبة المخرجات تلقائياً.</Text>
      </Space>
    </Modal>
  );
}
