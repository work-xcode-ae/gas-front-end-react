import React, { useState } from 'react';
import { Button, Card, Empty, Modal, Tag, Typography, message } from 'antd';
import { EditOutlined, FileProtectOutlined } from '@ant-design/icons';
import { api, errorMessage } from '../../api/client';
import ContractTermsPicker from '../../components/ContractTermsPicker';
import { termCategory, toTermInputs, type ContractTermItem } from '../../api/terms';

const { Text } = Typography;
const PRIMARY = '#1a5c2a';

/** Row of GET /supply-contracts/{id} → terms */
export interface ContractTermRow { id: number; templateId?: number | null; category: string; text: string; isCustom: boolean; isModified: boolean }

/** Terms & conditions of one tenant contract, with «edit for this contract only». */
const ContractTermsCard: React.FC<{ contractId: number; contractNo?: string; terms: ContractTermRow[]; canManage?: boolean; onSaved: () => void }> = ({
  contractId, contractNo, terms, canManage, onSaved,
}) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ContractTermItem[] | undefined>();
  const [saving, setSaving] = useState(false);
  const [all, setAll] = useState(false);
  const shown = all ? terms : terms.slice(0, 5);

  const startEdit = () => {
    setItems(terms.map(t => ({ key: t.templateId ? `t${t.templateId}` : `x${t.id}`, templateId: t.templateId ?? null, category: t.category, text: t.text })));
    setOpen(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      await api(`/supply-contracts/${contractId}/terms`, { method: 'PUT', body: { items: toTermInputs(items ?? []) } });
      message.success('تم حفظ شروط هذا العقد');
      setOpen(false); onSaved();
    } catch (e) { message.error(errorMessage(e), 6); } finally { setSaving(false); }
  };

  return (
    <Card size="small" style={{ borderRadius: 10 }}
      title={<span><FileProtectOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />الشروط والأحكام <Text type="secondary" style={{ fontSize: 11 }}>({terms.length} بند)</Text></span>}
      extra={canManage && <Button size="small" icon={<EditOutlined />} onClick={startEdit}>تعديل شروط هذا العقد</Button>}>
      {terms.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="لا توجد شروط مسجلة لهذا العقد" style={{ margin: 6 }} /> : (
        <ol style={{ margin: 0, paddingInlineStart: 20 }}>
          {shown.map(t => {
            const m = termCategory(t.category);
            return (
              <li key={t.id} style={{ fontSize: 12.5, lineHeight: 1.8, marginBottom: 6, color: '#333' }}>
                <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 4, background: m.color, marginInlineEnd: 6 }} title={m.label} />
                {t.text}
                {t.isModified && <Tag color="gold" style={{ fontSize: 10, marginInlineStart: 6 }}>معدّل لهذا العقد</Tag>}
                {t.isCustom && <Tag color="blue" style={{ fontSize: 10, marginInlineStart: 6 }}>بند خاص</Tag>}
              </li>
            );
          })}
        </ol>
      )}
      {terms.length > 5 && <Button type="link" size="small" onClick={() => setAll(v => !v)}>{all ? 'عرض أقل' : `عرض كل البنود (${terms.length})`}</Button>}

      <Modal open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} width={760} destroyOnHidden centered
        title={<span><FileProtectOutlined style={{ color: PRIMARY }} /> شروط العقد {contractNo ?? ''}</span>}
        okText="حفظ الشروط" cancelText="إلغاء" okButtonProps={{ style: { background: PRIMARY, borderColor: PRIMARY } }}
        styles={{ body: { maxHeight: '65vh', overflow: 'auto' } }}>
        <ContractTermsPicker contractType="supply" value={items} onChange={setItems} />
      </Modal>
    </Card>
  );
};

export default ContractTermsCard;
