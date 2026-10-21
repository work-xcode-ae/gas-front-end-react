import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Empty, Spin, Tag, Tooltip, message } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RollbackOutlined, SettingOutlined } from '@ant-design/icons';
import { errorMessage } from '../api/client';
import { termCategory, termsApi, type ContractTermItem, type TermContractType, type TermOption } from '../api/terms';
import { TermText, TermTextArea } from './TermFields';

const PRIMARY = '#1a5c2a';
let seq = 0;
const newKey = () => `c${Date.now()}_${++seq}`;

interface Props {
  contractType: TermContractType;
  /** chosen terms (controlled). Leave undefined on a new contract: the setup defaults are pre-selected. */
  value?: ContractTermItem[];
  onChange: (items: ContractTermItem[]) => void;
}

/**
 * Terms & conditions of ONE contract, taken from the Settings setup for this contract type.
 * Ticking a term copies it into the contract; its wording can be changed for this contract only,
 * and extra terms can be written. Nothing here changes the Settings list.
 */
const ContractTermsPicker: React.FC<Props> = ({ contractType, value, onChange }) => {
  const [options, setOptions] = useState<TermOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [newText, setNewText] = useState('');
  const items = value ?? [];

  useEffect(() => {
    let alive = true;
    setOptions(null); setError(null);
    termsApi.options(contractType)
      .then(r => {
        if (!alive) return;
        setOptions(r);
        if (value === undefined) onChange(r.filter(o => o.isDefault).map(o => ({ key: `t${o.id}`, templateId: o.id, category: o.category, text: o.text })));
      })
      .catch(e => { if (alive) { setOptions([]); setError(errorMessage(e)); } });
    return () => { alive = false; };
  }, [contractType]); // eslint-disable-line react-hooks/exhaustive-deps

  const byTemplate = useMemo(() => new Map(items.filter(i => i.templateId).map(i => [i.templateId!, i])), [items]);
  const custom = items.filter(i => !i.templateId);
  const modifiedCount = items.filter(i => i.templateId && options?.find(o => o.id === i.templateId)?.text.trim() !== i.text.trim()).length;

  const groups = useMemo(() => {
    const m = new Map<string, TermOption[]>();
    (options ?? []).forEach(o => m.set(o.category, [...(m.get(o.category) ?? []), o]));
    return [...m.entries()];
  }, [options]);

  /** keep setup terms in setup order, custom terms after them */
  const ordered = (list: ContractTermItem[]) => {
    const idx = (i: ContractTermItem) => (i.templateId ? (options ?? []).findIndex(o => o.id === i.templateId) : 10_000);
    return [...list].sort((a, b) => idx(a) - idx(b));
  };

  const toggle = (o: TermOption, on: boolean) => {
    if (on) onChange(ordered([...items, { key: `t${o.id}`, templateId: o.id, category: o.category, text: o.text }]));
    else { onChange(items.filter(i => i.templateId !== o.id)); if (editing === `t${o.id}`) setEditing(null); }
  };
  const startEdit = (it: ContractTermItem) => { setEditing(it.key); setDraft(it.text); };
  const saveEdit = () => {
    if (!draft.trim()) { message.warning('نص البند لا يمكن أن يكون فارغاً'); return; }
    onChange(items.map(i => (i.key === editing ? { ...i, text: draft.trim() } : i)));
    setEditing(null);
  };
  const addCustom = () => {
    if (!newText.trim()) return;
    onChange([...items, { key: newKey(), templateId: null, category: 'other', text: newText.trim() }]);
    setNewText('');
  };

  const editor = (
    <div className="tp-edit">
      <TermTextArea autoFocus minRows={2} maxRows={6} value={draft} onChange={setDraft} contractType={contractType} />
      <div className="tp-edit-actions">
        <Button size="small" onClick={() => setEditing(null)} icon={<CloseOutlined />}>إلغاء</Button>
        <Button size="small" type="primary" onClick={saveEdit} icon={<CheckOutlined />} style={{ background: PRIMARY, borderColor: PRIMARY }}>حفظ لهذا العقد</Button>
      </div>
    </div>
  );

  return (
    <div className="tp">
      <style>{`
        .tp-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; }
        .tp-note { font-size: 11.5px; color: #8a8f8a; margin-inline-start: auto; }
        .tp-group { margin-bottom: 12px; }
        .tp-group-head { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 12.5px; margin-bottom: 6px; }
        .tp-group-head i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .tp-item { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: 10px; border: 1px solid #edf0ed; background: #fff; margin-bottom: 6px; transition: all .15s; }
        .tp-item.on { border-color: #b7d3b9; background: #f6fbf6; }
        .tp-item .ant-checkbox-wrapper { margin-top: 2px; }
        .tp-text { flex: 1; font-size: 13px; line-height: 1.8; color: #333; white-space: pre-wrap; }
        .tp-item:not(.on) .tp-text { color: #8a8f8a; }
        .tp-orig { font-size: 11.5px; color: #9aa09a; text-decoration: line-through; margin-top: 2px; }
        .tp-actions { display: flex; gap: 2px; flex-shrink: 0; }
        .tp-edit { flex: 1; }
        .tp-edit-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px; }
        .tp-custom { border-top: 1px dashed #e3e7e3; padding-top: 10px; margin-top: 4px; }
        .tp-add { display: flex; gap: 8px; align-items: flex-start; }
      `}</style>

      <div className="tp-summary">
        <Tag color="green" style={{ margin: 0 }}>{items.length} بند في العقد</Tag>
        {modifiedCount > 0 && <Tag color="gold" style={{ margin: 0 }}>{modifiedCount} معدّل لهذا العقد</Tag>}
        {custom.length > 0 && <Tag color="blue" style={{ margin: 0 }}>{custom.length} بند إضافي</Tag>}
        {!!options?.length && (
          <>
            <Button size="small" type="link" onClick={() => onChange(ordered([...custom, ...options.map(o => byTemplate.get(o.id) ?? { key: `t${o.id}`, templateId: o.id, category: o.category, text: o.text })]))}>تحديد الكل</Button>
            <Button size="small" type="link" danger onClick={() => onChange(custom)}>إلغاء التحديد</Button>
          </>
        )}
        <span className="tp-note">التعديل هنا يخص هذا العقد فقط — لا يغيّر إعدادات الشروط</span>
      </div>

      {options === null ? <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
        : error ? <div style={{ color: '#c62828', fontSize: 12, marginBottom: 10 }}>تعذّر تحميل الشروط من الإعدادات: {error}</div>
        : options.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '6px 0 12px' }}
            description={<span>لا توجد شروط معرّفة لهذا النوع من العقود — أضفها من <b><SettingOutlined /> الإعدادات ← الشروط والأحكام</b> أو اكتب بنوداً لهذا العقد أدناه</span>} />
        ) : groups.map(([cat, list]) => {
          const meta = termCategory(cat);
          const chosen = list.filter(o => byTemplate.has(o.id)).length;
          return (
            <div key={cat} className="tp-group">
              <div className="tp-group-head" style={{ color: meta.color }}><i style={{ background: meta.color }} />{meta.label}
                <span style={{ fontWeight: 400, color: '#999', fontSize: 11.5 }}>({chosen}/{list.length})</span></div>
              {list.map(o => {
                const it = byTemplate.get(o.id);
                const on = !!it;
                const changed = on && it!.text.trim() !== o.text.trim();
                return (
                  <div key={o.id} className={`tp-item${on ? ' on' : ''}`}>
                    <Checkbox checked={on} onChange={e => toggle(o, e.target.checked)} />
                    {on && editing === it!.key ? editor : (
                      <>
                        <div style={{ flex: 1 }}>
                          <div className="tp-text"><TermText text={on ? it!.text : o.text} /></div>
                          {changed && <><Tag color="gold" style={{ fontSize: 10.5, marginTop: 4 }}>معدّل لهذا العقد</Tag><div className="tp-orig"><TermText text={o.text} /></div></>}
                        </div>
                        {on && (
                          <span className="tp-actions">
                            <Tooltip title="تعديل النص لهذا العقد"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => startEdit(it!)} /></Tooltip>
                            {changed && <Tooltip title="استرجاع النص الأصلي"><Button size="small" type="text" icon={<RollbackOutlined />}
                              onClick={() => onChange(items.map(i => (i.key === it!.key ? { ...i, text: o.text } : i)))} /></Tooltip>}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

      <div className="tp-custom">
        <div className="tp-group-head" style={{ color: '#1565c0' }}><i style={{ background: '#1565c0' }} />بنود إضافية لهذا العقد</div>
        {custom.map(it => (
          <div key={it.key} className="tp-item on">
            <PlusOutlined style={{ color: '#1565c0', marginTop: 6 }} />
            {editing === it.key ? editor : (
              <>
                <div className="tp-text"><TermText text={it.text} /></div>
                <span className="tp-actions">
                  <Tooltip title="تعديل"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => startEdit(it)} /></Tooltip>
                  <Tooltip title="حذف"><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => onChange(items.filter(i => i.key !== it.key))} /></Tooltip>
                </span>
              </>
            )}
          </div>
        ))}
        <div className="tp-add">
          <div style={{ flex: 1 }}><TermTextArea minRows={1} maxRows={4} value={newText} onChange={setNewText} contractType={contractType}
            placeholder="اكتب بنداً خاصاً بهذا المستأجر / العقد…" onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); addCustom(); } }} /></div>
          <Button icon={<PlusOutlined />} onClick={addCustom} disabled={!newText.trim()}>إضافة</Button>
        </div>
      </div>
    </div>
  );
};

export default ContractTermsPicker;
