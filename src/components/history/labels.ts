/** Arabic names of record types (CLR entity names) and common fields, for the history views. */
export const ENTITY_LABELS: Record<string, string> = {
  Building: 'مبنى', Unit: 'وحدة', Meter: 'عداد', MeterReading: 'قراءة عداد', MeterAssignment: 'تركيب عداد', MeterService: 'خدمة عداد', MeterTopup: 'شحن عداد',
  Tenant: 'عميل', SupplyContract: 'عقد غاز', ContractFee: 'رسوم عقد', ContractTerm: 'بند عقد', Party: 'مالك / طرف', PartyContact: 'جهة اتصال', BuildingOwner: 'مالك مبنى',
  Invoice: 'فاتورة', InvoiceItem: 'بند فاتورة', InvoiceInstallment: 'قسط فاتورة', Payment: 'سند قبض', PaymentAllocation: 'تخصيص دفعة',
  CreditNote: 'إشعار دائن', CreditNoteLine: 'بند إشعار دائن', CreditNoteAllocation: 'تطبيق إشعار دائن', CustomerRefund: 'استرداد عميل', CustomerRefundSource: 'مصدر استرداد',
  Vendor: 'مورد', VendorContact: 'جهة اتصال مورد', VendorBill: 'فاتورة مورد', VendorBillItem: 'بند فاتورة مورد', VendorPayment: 'سند صرف مورد', VendorPaymentAllocation: 'تخصيص سند صرف',
  Voucher: 'سند', JournalEntry: 'قيد', JournalLine: 'سطر قيد', JournalApproval: 'اعتماد قيد', Account: 'حساب', AccountMapping: 'ربط حساب', FiscalPeriod: 'فترة مالية',
  AccountingSetting: 'إعدادات المحاسبة', TaxRate: 'ضريبة', BankAccount: 'حساب بنكي', BankTransfer: 'تحويل بنكي', BankStatementLine: 'سطر كشف بنك', BankReconciliation: 'مطابقة بنكية',
  CashflowItem: 'بند تدفق نقدي', Tank: 'خزان', TankRefill: 'تعبئة خزان', TankLevelHistory: 'قراءة مستوى خزان', RefillRequest: 'طلب تعبئة', PurchaseOrder: 'أمر شراء',
  RefillPurchaseInvoice: 'فاتورة شراء تعبئة', AmcContract: 'عقد صيانة', AmcPaymentSchedule: 'دفعة عقد صيانة', AmcScopeItem: 'نطاق عقد صيانة', MaintenanceVisit: 'زيارة صيانة',
  VisitChecklistItem: 'بند فحص زيارة', ServiceRequest: 'طلب خدمة', CdCertificate: 'شهادة دفاع مدني', CdRenewal: 'تجديد دفاع مدني', Document: 'وثيقة', DocumentLink: 'ربط وثيقة',
  AppUser: 'مستخدم', Role: 'دور', UserRole: 'دور مستخدم', RolePermission: 'صلاحية دور', UserBranch: 'فرع مستخدم', Employee: 'موظف', Asset: 'أصل', Vehicle: 'مركبة',
  LookupValue: 'قيمة قائمة', Branch: 'فرع', Company: 'شركة', SystemSetting: 'إعداد نظام',
};
export const entityLabel = (t?: string | null) => (t ? ENTITY_LABELS[t] ?? t : '—');

const FIELD_LABELS: Record<string, string> = {
  StatusId: 'الحالة', Status: 'الحالة', Amount: 'المبلغ', TotalAmount: 'الإجمالي', Subtotal: 'قبل الضريبة', VatAmount: 'الضريبة', VatRate: 'نسبة الضريبة', TaxRateId: 'رمز الضريبة',
  Description: 'البيان', Notes: 'ملاحظات', Reason: 'السبب', NameAr: 'الاسم (عربي)', NameEn: 'الاسم (إنجليزي)', Code: 'الرمز', Phone: 'الهاتف', Email: 'البريد', Mobile: 'الجوال',
  BuildingId: 'المبنى', UnitId: 'الوحدة', TenantId: 'العميل', VendorId: 'المورد', MeterId: 'العداد', ContractId: 'العقد', InvoiceId: 'الفاتورة', AccountId: 'الحساب', BranchId: 'الفرع',
  IssueDate: 'تاريخ الإصدار', DueDate: 'تاريخ الاستحقاق', StartDate: 'تاريخ البداية', EndDate: 'تاريخ النهاية', PaymentDate: 'تاريخ الدفع', BillDate: 'تاريخ الفاتورة', EntryDate: 'تاريخ القيد',
  ValidFrom: 'ساري من', ValidTo: 'ساري إلى', IsActive: 'فعّال', IsDeleted: 'محذوف', IsDefault: 'افتراضي', Rate: 'النسبة', Quantity: 'الكمية', UnitPrice: 'سعر الوحدة',
  ReadingValue: 'القراءة', ReadingDate: 'تاريخ القراءة', Consumption: 'الاستهلاك', MeterNo: 'رقم العداد', SerialNo: 'الرقم التسلسلي', CalibrationDate: 'تاريخ المعايرة', InstallDate: 'تاريخ التركيب',
  FromDate: 'من تاريخ', ToDate: 'إلى تاريخ', UnitNo: 'رقم الوحدة', FloorNo: 'الطابق', InvoiceNo: 'رقم الفاتورة', ReceiptNo: 'رقم السند', ContractNo: 'رقم العقد', BillNo: 'رقم فاتورة المورد',
  VoucherNo: 'رقم السند', JournalNo: 'رقم القيد', PaymentMethodId: 'طريقة الدفع', ReferenceNo: 'المرجع', ChequeNo: 'رقم الشيك', BankName: 'البنك', Debit: 'مدين', Credit: 'دائن',
  CancelReason: 'سبب الإلغاء', CancelledAt: 'تاريخ الإلغاء', PostedAt: 'تاريخ الترحيل', ApprovedAt: 'تاريخ الاعتماد', JournalEntryId: 'القيد', DepositAmount: 'الوديعة', RentAmount: 'الإيجار',
  CapacityLitres: 'السعة (لتر)', CurrentLevelPct: 'المستوى %', DeliveredQtyLitres: 'الكمية المسلمة', ScheduledDate: 'الموعد', VisitDate: 'تاريخ الزيارة', AnnualValue: 'القيمة السنوية',
  CertificateNo: 'رقم الشهادة', ExpiryDate: 'تاريخ الانتهاء', title: 'الصفحة', path: 'المسار', details: 'التفاصيل', OwnerPartyId: 'المالك', MeterTypeId: 'نوع العداد', UnitTypeId: 'نوع الوحدة',
  InvoiceTypeId: 'نوع الفاتورة', ItemTypeId: 'نوع البند', ExpenseAccountId: 'حساب المصروف', Balance: 'الرصيد', CreditLimit: 'حد الائتمان', PasswordHash: 'كلمة المرور',
};
/** «StatusId» → «الحالة»; unknown fields are split into words: «DeliveryNoteNo» → «Delivery Note No». */
export const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f.replace(/Id$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

export const ACTION_STYLE: Record<string, { label: string; color: string }> = {
  insert: { label: 'إضافة', color: '#389e0d' }, update: { label: 'تعديل', color: '#1677ff' }, delete: { label: 'حذف', color: '#cf1322' }, hard_delete: { label: 'حذف نهائي', color: '#a8071a' },
  view: { label: 'فتح / عرض', color: '#8c8c8c' }, print: { label: 'طباعة', color: '#722ed1' }, export: { label: 'تصدير', color: '#13c2c2' }, download: { label: 'تحميل', color: '#13c2c2' },
  logout: { label: 'تسجيل خروج', color: '#8c8c8c' }, login: { label: 'تسجيل دخول', color: '#389e0d' }, login_failed: { label: 'محاولة دخول فاشلة', color: '#cf1322' },
  event: { label: 'حدث', color: '#d48806' },
  rejected: { label: 'عملية مرفوضة', color: '#ad2102' },
};
