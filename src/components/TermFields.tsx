import React, { useRef } from 'react';
import { Input, Tooltip } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { TERM_FIELDS, termField, termParts, type TermContractKind } from '../utils/termFields';

const FIELD_CSS = `
  .tf-bar { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 2px; align-items: center; }
  .tf-bar .tf-hint { font-size: 11px; color: #8a8f8a; margin-inline-end: 4px; }
  .tf-chip { border: 1px dashed #9cc29f; background: #f3faf3; color: #1a5c2a; border-radius: 10px; padding: 0 8px; font-size: 11.5px; line-height: 20px; cursor: pointer; user-select: none; }
  .tf-chip:hover { background: #e2f2e3; border-style: solid; }
  .tf-field { display: inline-block; background: #e8f3e9; color: #1a5c2a; border: 1px solid #b7d3b9; border-radius: 6px; padding: 0 5px; margin: 0 2px; font-size: 0.92em; line-height: 1.5; white-space: nowrap; }
  .tf-field.unknown { background: #fff1f0; color: #c62828; border-color: #ffccc7; }
`;

/** A textarea for a contract term with buttons that insert {fields} at the cursor (value / onChange: works inside Form.Item). */
export const TermTextArea: React.FC<{
  value?: string; onChange?: (v: string) => void; contractType: TermContractKind; dir?: 'rtl' | 'ltr'; lang?: 'ar' | 'en';
  maxLength?: number; minRows?: number; maxRows?: number; placeholder?: string; autoFocus?: boolean; showCount?: boolean;
  onPressEnter?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}> = ({ value, onChange, contractType, dir = 'rtl', lang = 'ar', maxLength = 1000, minRows = 2, maxRows = 8, placeholder, autoFocus, showCount, onPressEnter }) => {
  const ref = useRef<TextAreaRef>(null);
  const insert = (key: string) => {
    const el = ref.current?.resizableTextArea?.textArea;
    const text = value ?? '';
    const token = `{${key}}`;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + token + text.slice(end);
    onChange?.(next);
    requestAnimationFrame(() => { if (el) { el.focus(); el.setSelectionRange(start + token.length, start + token.length); } });
  };
  return (
    <div>
      <style>{FIELD_CSS}</style>
      <Input.TextArea ref={ref} value={value} onChange={e => onChange?.(e.target.value)} autoSize={{ minRows, maxRows }} maxLength={maxLength}
        showCount={showCount} placeholder={placeholder} autoFocus={autoFocus} style={{ direction: dir }} onPressEnter={onPressEnter} />
      <div className="tf-bar">
        <span className="tf-hint">{lang === 'en' ? 'Insert field:' : 'إدراج حقل:'}</span>
        {TERM_FIELDS[contractType].map(f => (
          <Tooltip key={f.key} title={`{${f.key}} — ${lang === 'en' ? 'filled from the contract when printed' : 'يُستبدل بقيمة العقد عند الطباعة'}`}>
            <span className="tf-chip" onMouseDown={e => e.preventDefault()} onClick={() => insert(f.key)}>{lang === 'en' ? f.en : f.ar}</span>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

/** Shows a term with its {fields} highlighted; with `values` the field shows the contract's value instead. */
export const TermText: React.FC<{ text: string; lang?: 'ar' | 'en'; values?: Record<string, string | undefined> }> = ({ text, lang = 'ar', values }) => (
  <>
    <style>{FIELD_CSS}</style>
    {termParts(text).map((p, i) => {
      if (!p.field) return <React.Fragment key={i}>{p.text}</React.Fragment>;
      const f = termField(p.field);
      const v = values?.[p.field];
      return (
        <Tooltip key={i} title={f ? `{${p.field}} — ${lang === 'en' ? 'filled from the contract' : 'يُملأ من بيانات العقد'}` : 'حقل غير معروف'}>
          <span className={`tf-field${f ? '' : ' unknown'}`}>{v ?? (f ? (lang === 'en' ? f.en : f.ar) : p.text)}</span>
        </Tooltip>
      );
    })}
  </>
);
