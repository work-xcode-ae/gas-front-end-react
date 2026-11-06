import { Modal } from 'antd';
import { api, ApiError } from './client';

/**
 * Save a customer receipt (POST /api/payments). When the API answers «possible_duplicate» (same customer, amount, date and
 * reference as a live receipt), the user is asked to confirm; «save anyway» re-sends it with allowDuplicate.
 * Use this instead of api('/payments', …) everywhere a receipt is created.
 */
export async function postReceipt<T = any>(opts: { method?: string; body: Record<string, unknown> }): Promise<T> {
  try {
    return await api<T>('/payments', { method: 'POST', body: opts.body });
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'possible_duplicate') throw e;
    const again = await new Promise<boolean>(resolve => Modal.confirm({
      title: 'سند قبض مكرر محتمل',
      content: `يوجد سند قبض لنفس العميل وبنفس المبلغ والتاريخ والمرجع. ${e.message} هل هذه دفعة ثانية منفصلة؟`,
      okText: 'نعم، احفظ كسند جديد', cancelText: 'لا، إلغاء', okButtonProps: { danger: true },
      onOk: () => resolve(true), onCancel: () => resolve(false),
    }));
    if (!again) throw new ApiError('لم يُحفظ السند — يبدو أنه مسجّل مسبقاً.', 409, 'duplicate_cancelled');
    return api<T>('/payments', { method: 'POST', body: { ...opts.body, allowDuplicate: true } });
  }
}
