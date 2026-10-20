import React, { useEffect, useState } from 'react';
import { Alert, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Spin, message } from 'antd';
import { BankOutlined, EditOutlined, EnvironmentOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { buildingsApi, type BuildingInput } from '../../api/buildings';
import { useReference, locName } from '../../api/reference';
import { errorMessage } from '../../api/client';

const PRIMARY = '#1a5c2a';

/** Fields of GET /buildings/{id} used by the form. */
interface BuildingDetail {
  id: number; code: string; nameAr?: string | null; nameEn?: string | null; branchId?: number; cityId?: number | null;
  type?: string | null; status?: string | null; zone?: string | null; street?: string | null; poBox?: string | null; address?: string | null;
  latitude?: number | null; longitude?: number | null; totalFloors?: number | null; notes?: string | null;
}

/** Edit the building's own details (owners, tanks and units have their own screens). */
const EditBuildingModal: React.FC<{ buildingId: number | null; onClose: () => void; onSaved: () => void }> = ({ buildingId, onClose, onSaved }) => {
  const { i18n } = useTranslation();
  const isAr = i18n.language !== 'en';
  const { data: ref } = useReference(i18n.language);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const emirateId: number | undefined = Form.useWatch('emirateId', form);

  const lk = (t: string) => (ref?.lookups?.[t] ?? []).map(v => ({ value: v.code, label: v.label }));
  const cities = (ref?.cities ?? []).filter(c => !emirateId || c.emirateId === emirateId);

  useEffect(() => {
    if (!buildingId) return;
    setLoading(true); setError(null); form.resetFields();
    buildingsApi.get<BuildingDetail>(buildingId)
      .then(b => {
        setCode(b.code);
        const city = (ref?.cities ?? []).find(c => c.id === b.cityId);
        form.setFieldsValue({
          nameAr: b.nameAr, nameEn: b.nameEn, buildingType: b.type, status: b.status ?? 'active', branchId: b.branchId,
          emirateId: city?.emirateId, cityId: b.cityId ?? undefined, zone: b.zone, street: b.street, poBox: b.poBox, address: b.address,
          latitude: b.latitude, longitude: b.longitude, totalFloors: b.totalFloors, notes: b.notes,
        });
      })
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [buildingId, form, ref?.cities]);

  const save = async () => {
    let v: any;
    try { v = await form.validateFields(); } catch { return; }
    const body: BuildingInput = {
      branchId: v.branchId, nameAr: v.nameAr?.trim(), nameEn: v.nameEn?.trim() || undefined, buildingType: v.buildingType, status: v.status,
      cityId: v.cityId, zone: v.zone?.trim() || undefined, street: v.street?.trim() || undefined, poBox: v.poBox?.trim() || undefined,
      address: v.address?.trim() || undefined, latitude: v.latitude ?? undefined, longitude: v.longitude ?? undefined,
      totalFloors: v.totalFloors ?? undefined, notes: v.notes?.trim() || undefined,
    };
    setSaving(true);
    try {
      await buildingsApi.update(buildingId!, body);
      message.success(`تم حفظ بيانات المبنى ${code}`);
      onSaved();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Modal open={!!buildingId} onCancel={onClose} width={760} centered destroyOnHidden maskClosable={!saving}
      title={<span><BankOutlined style={{ color: PRIMARY }} /> تعديل بيانات المبنى {code}</span>}
      footer={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={saving}>إلغاء</Button>
        <Button type="primary" icon={<EditOutlined />} loading={saving} disabled={loading || !!error} onClick={save}
          style={{ background: PRIMARY, borderColor: PRIMARY, minWidth: 140, fontWeight: 600 }}>حفظ التعديلات</Button>
      </div>}>
      {error ? <Alert type="error" showIcon message={error} /> : (
        <Spin spinning={loading}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <div style={{ fontWeight: 700, color: PRIMARY, margin: '4px 0 10px' }}><InfoCircleOutlined /> البيانات الأساسية</div>
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name="nameAr" label="اسم المبنى (عربي)" rules={[{ required: true, whitespace: true, message: 'مطلوب' }]}><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="nameEn" label="اسم المبنى (إنجليزي)"><Input style={{ direction: 'ltr' }} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="buildingType" label="نوع المبنى"><Select allowClear options={lk('BUILDING_TYPE')} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="الحالة" extra="«غير نشط» يوقف المبنى دون حذفه"><Select options={lk('BUILDING_STATUS')} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="totalFloors" label="عدد الطوابق"><InputNumber min={0} max={200} style={{ width: '100%' }} /></Form.Item></Col>
              <Col xs={24} md={8}>
                <Form.Item name="branchId" label="الفرع" rules={[{ required: true, message: 'مطلوب' }]}>
                  <Select options={(ref?.branches ?? []).map(b => ({ value: b.id, label: locName(b, isAr) }))} />
                </Form.Item>
              </Col>
            </Row>
            <div style={{ fontWeight: 700, color: PRIMARY, margin: '4px 0 10px' }}><EnvironmentOutlined /> الموقع</div>
            <Row gutter={12}>
              <Col xs={24} md={8}>
                <Form.Item name="emirateId" label="الإمارة">
                  <Select allowClear options={(ref?.emirates ?? []).map(e => ({ value: e.id, label: locName(e, isAr) }))} onChange={() => form.setFieldsValue({ cityId: undefined })} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}><Form.Item name="cityId" label="المدينة"><Select allowClear showSearch optionFilterProp="label" options={cities.map(c => ({ value: c.id, label: locName(c, isAr) }))} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="zone" label="المنطقة"><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="street" label="الشارع"><Input /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="poBox" label="صندوق البريد"><Input style={{ direction: 'ltr' }} /></Form.Item></Col>
              <Col span={24}><Form.Item name="address" label="العنوان"><Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="latitude" label="خط العرض"><InputNumber style={{ width: '100%' }} step={0.000001} /></Form.Item></Col>
              <Col xs={24} md={12}><Form.Item name="longitude" label="خط الطول"><InputNumber style={{ width: '100%' }} step={0.000001} /></Form.Item></Col>
              <Col span={24}><Form.Item name="notes" label="ملاحظات"><Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} maxLength={1000} /></Form.Item></Col>
            </Row>
          </Form>
        </Spin>
      )}
    </Modal>
  );
};

export default EditBuildingModal;
