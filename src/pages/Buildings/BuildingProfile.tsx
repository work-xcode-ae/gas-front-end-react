import React, { useEffect, useState } from 'react';
import {
  Row, Col, Card, Table, Button, Tag, Typography, Divider, Tabs,
  Descriptions, Timeline, Avatar, Space, Tooltip, Progress,
  Empty, List, Input, Steps, Modal, Dropdown, message, Form, Select, InputNumber, DatePicker} from 'antd';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined, BankOutlined, HomeOutlined, UserOutlined,
  PhoneOutlined, MailOutlined, StarFilled, EnvironmentOutlined,
  DatabaseOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  CalendarOutlined, FileTextOutlined, ToolOutlined, DollarOutlined,
  EditOutlined, PrinterOutlined, FilePdfOutlined, IdcardOutlined,
  BuildOutlined, SafetyCertificateOutlined, ClockCircleOutlined,
  FireOutlined, ApartmentOutlined, BarChartOutlined, WarningOutlined,
  TeamOutlined, GlobalOutlined, PlusOutlined, BellOutlined,
  CreditCardOutlined, ContainerOutlined, SearchOutlined, 
  AuditOutlined, SolutionOutlined, FileDoneOutlined, AlertOutlined,
  DisconnectOutlined, ThunderboltOutlined, SwapOutlined, PauseCircleOutlined, PlayCircleOutlined, DeleteOutlined} from '@ant-design/icons';
import ReactApexChart from 'react-apexcharts';
import AddUnitModal from './AddUnitModal';
import AddMeterModal from './AddMeterModal';
import MeterDetailDrawer from './MeterDetailDrawer';
import MeterReadingModal from './MeterReadingModal';
import MeterServiceModal from './MeterServiceModal';
import AddTenantModal from './AddTenantModal';
import AddGasContractModal from './AddGasContractModal';
import GasContractDrawer from './GasContractDrawer';
import { openPrintWindow, printSupplyContract, printAmcContract } from '../../utils/printDocs';
import TenantInvoicesDrawer from './TenantInvoicesDrawer';
import TenantProfileDrawer from './TenantProfileDrawer';
import AddAmcContractModal from './AddAmcContractModal';
import AmcInvoicesPanel from './AmcInvoicesPanel';
import BuildingTanksYard from './BuildingTanksYard';
import { BuildingVisitsTab, BuildingServiceRequestsTab } from './BuildingOpsTabs';
import CocRenewalModal from './CocRenewalModal';
import UnitProfileDrawer from './UnitProfileDrawer';
import { unitsApi, type UnitDto } from '../../api/units';
import { premisesApi } from '../../api/premises';
import VillaGasContracts from '../Premises/VillaGasContracts';
import VillaOverview from '../Premises/VillaOverview';
import { BuildingOverviewLive, BuildingOwnersLive, BuildingDocsLive, BuildingActivityLive, BuildingFinanceLive } from './BuildingLiveTabs';
import { CocCertificateDetails } from './CocStepPanels';
import { RecordVisitModal, UploadReportModal } from './AmcVisitModals';
import BuildingFloorPlan from './BuildingFloorPlan';
import { buildingsApi } from '../../api/buildings';
import EditBuildingModal from './EditBuildingModal';
import BuildingMetersTab from './BuildingMetersTab';
import BuildingTenantsTab from './BuildingTenantsTab';
import { api, errorMessage, type Paged } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { RefillRequestDrawer, NewRefillRequestModal, mapLiveRefill } from './RefillRequestDrawer';
import type { RefillRequestItem } from './RefillRequestDrawer';
import { ShopOutlined as RestaurantTabIcon } from '@ant-design/icons';
import BuildingRestaurantsTab from '../Premises/BuildingRestaurantsTab';
import VillaSiteTab from '../Premises/VillaSiteTab';
import VillaServiceTab from '../Premises/VillaServiceTab';
import SiteVisitsTab from '../Premises/SiteVisitsTab';
import type { SupplyContractRecord } from './GasContractDrawer';
import type { MeterServiceType } from './MeterServiceModal';
import type { MeterRecord } from './meterTypes';
import { HistoryButton, useTrackView } from '../../components/history/RecordHistory';

const { Title, Text, Paragraph } = Typography;

const PRIMARY = '#1a5c2a';

const building = {
  no: 'B-001', name: 'مجمع الرحاب', nameEn: 'Al Rahab Complex',
  branch: 'أبوظبي', type: 'residential', typeLabel: 'سكني',
  status: 'active', statusLabel: 'نشط', floors: 6, totalUnits: 24,
  occupied: 22, vacant: 2, createdAt: '2022-03-15', lastUpdated: '2024-11-10',
  address: {
    emirate: 'أبوظبي', city: 'مدينة محمد بن زايد', zone: 'المنطقة 4',
    street: 'شارع خليفة', poBox: '45231',
    fullAddress: 'شارع خليفة، المنطقة 4، مدينة محمد بن زايد، أبوظبي، الإمارات العربية المتحدة',
    coordinates: '24.4539° N, 54.3773° E',
  },
  owners: [
    {
      isPrimary: true, ownerType: 'individual',
      name: 'محمد سعيد الكندي', nameEn: 'Mohammed Saeed Al Kindi',
      emiratesId: '784-1975-1234567-1', nationality: 'إماراتي',
      phones: ['+971501234567', '+97126543210'], emails: ['m.alkindi@email.com'],
      defaultPhone: '+971501234567', defaultEmail: 'm.alkindi@email.com',
      bankName: 'بنك أبوظبي الأول', iban: 'AE070331234567890123456',
    },
    {
      isPrimary: false, ownerType: 'company',
      name: 'شركة الكندي للاستثمار العقاري', nameEn: 'Al Kindi Real Estate LLC',
      tradeLicenseNo: 'TL-2023-45678', emirate: 'أبوظبي', city: 'مدينة محمد بن زايد',
      poBox: '45231', address: 'برج الاتحاد، الطابق 12، أبوظبي',
      phones: ['+97124567890'], emails: ['info@alkindi-re.ae', 'contracts@alkindi-re.ae'],
      defaultPhone: null, defaultEmail: null,
      bankName: 'بنك الإمارات دبي الوطني', iban: 'AE280260001234567890123',
    },
  ],
  tanks: [
    { no: 'T-001', typeLabel: 'غاز البترول المسال', capacity: 5000, unit: 'لتر', serial: 'SN-LPG-2021-001', installDate: '2021-06-01', manufacturer: 'EMGAS', lastInspection: '2024-01-15', nextInspection: '2025-01-15', status: 'ok', currentLevel: 3750, lastFilled: '2026-08-20' },
    { no: 'T-002', typeLabel: 'غاز البترول المسال', capacity: 5000, unit: 'لتر', serial: 'SN-LPG-2021-002', installDate: '2021-06-01', manufacturer: 'EMGAS', lastInspection: '2024-01-15', nextInspection: '2025-01-15', status: 'ok', currentLevel: 1200, lastFilled: '2026-07-05' },
    { no: 'T-003', typeLabel: 'غاز طبيعي', capacity: 2000, unit: 'م³', serial: 'SN-NG-2023-001', installDate: '2023-03-10', manufacturer: 'ADNOC Gas', lastInspection: '2024-06-01', nextInspection: '2025-06-01', status: 'inspection_due', currentLevel: 480, lastFilled: '2026-06-15' },
  ],
  units: [
    { key: 1, no: '101', floor: 1, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'أحمد علي محمد', tenantId: 'T-001', meter: 'M-001', contract: 'GC-2024-001', contractEnd: '2024-12-31', rent: 65000, lastInspection: '2024-09-01', notes: '' },
    { key: 2, no: '102', floor: 1, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'فاطمة خالد النعيمي', tenantId: 'T-002', meter: 'M-002', contract: 'GC-2024-002', contractEnd: '2025-01-31', rent: 65000, lastInspection: '2024-09-15', notes: '' },
    { key: 3, no: '103', floor: 1, type: 'apartment', typeLabel: 'شقة', area: 95, bedrooms: 1, bathrooms: 1, status: 'vacant', tenant: null, tenantId: null, meter: 'M-003', contract: null, contractEnd: null, rent: 55000, lastInspection: '2024-08-01', notes: 'جاهزة للإيجار' },
    { key: 4, no: '201', floor: 2, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'سالم محمد الزعابي', tenantId: 'T-003', meter: 'M-004', contract: 'GC-2024-003', contractEnd: '2025-01-14', rent: 65000, lastInspection: '2024-10-01', notes: '' },
    { key: 5, no: '202', floor: 2, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'مريم راشد العامري', tenantId: 'T-004', meter: 'M-005', contract: 'GC-2024-004', contractEnd: '2025-02-28', rent: 60000, lastInspection: '2024-10-01', notes: '' },
    { key: 6, no: '203', floor: 2, type: 'apartment', typeLabel: 'شقة', area: 95, bedrooms: 1, bathrooms: 1, status: 'occupied', tenant: 'خالد سعيد البلوشي', tenantId: 'T-005', meter: 'M-006', contract: 'GC-2024-005', contractEnd: '2025-03-31', rent: 55000, lastInspection: '2024-10-01', notes: '' },
    { key: 7, no: '301', floor: 3, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'علي حسن المنصوري', tenantId: 'T-006', meter: 'M-007', contract: 'GC-2024-006', contractEnd: '2024-11-30', rent: 65000, lastInspection: '2024-07-01', notes: 'ينتهي العقد قريباً' },
    { key: 8, no: '302', floor: 3, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'نورة أحمد الشحي', tenantId: 'T-007', meter: 'M-008', contract: 'GC-2024-007', contractEnd: '2025-04-30', rent: 65000, lastInspection: '2024-10-15', notes: '' },
    { key: 9, no: '601', floor: 6, type: 'penthouse', typeLabel: 'بنتهاوس', area: 280, bedrooms: 4, bathrooms: 4, status: 'occupied', tenant: 'عبدالله ماجد القاسمي', tenantId: 'T-008', meter: 'M-024', contract: 'GC-2024-022', contractEnd: '2024-12-31', rent: 150000, lastInspection: '2024-09-01', notes: '' },
    { key: 10, no: '602', floor: 6, type: 'penthouse', typeLabel: 'بنتهاوس', area: 280, bedrooms: 4, bathrooms: 4, status: 'maintenance', tenant: null, tenantId: null, meter: 'M-025', contract: null, contractEnd: null, rent: 150000, lastInspection: '2024-06-01', notes: 'صيانة نظام التكييف' },
    { key: 11, no: '401', floor: 4, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'occupied', tenant: 'يوسف عمر الحمادي', tenantId: 'T-009', meter: null, contract: 'GC-2024-008', contractEnd: '2025-05-31', rent: 65000, lastInspection: null, notes: 'بانتظار تركيب العداد' },
    { key: 12, no: '402', floor: 4, type: 'apartment', typeLabel: 'شقة', area: 95, bedrooms: 1, bathrooms: 1, status: 'occupied', tenant: 'هند سعود المهيري', tenantId: 'T-010', meter: null, contract: 'GC-2024-009', contractEnd: '2025-06-30', rent: 55000, lastInspection: null, notes: 'بانتظار تركيب العداد' },
    { key: 13, no: '403', floor: 4, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'vacant', tenant: null, tenantId: null, meter: null, contract: null, contractEnd: null, rent: 65000, lastInspection: null, notes: 'شاغرة - جاهزة للتأجير' },
    { key: 14, no: '501', floor: 5, type: 'apartment', typeLabel: 'شقة', area: 120, bedrooms: 2, bathrooms: 2, status: 'vacant', tenant: null, tenantId: null, meter: null, contract: null, contractEnd: null, rent: 70000, lastInspection: null, notes: 'شاغرة - تجديد حديث' },
    { key: 15, no: '502', floor: 5, type: 'apartment', typeLabel: 'شقة', area: 95, bedrooms: 1, bathrooms: 1, status: 'occupied', tenant: 'بدر علي الكعبي', tenantId: 'T-011', meter: null, contract: 'GC-2024-010', contractEnd: '2025-08-31', rent: 55000, lastInspection: null, notes: 'بانتظار تركيب العداد' },
  ],
  meters: [
    { id: 'M-001', serial: 'SN-MTR-2021-001', unit: '101', floor: 1, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2021-06-15', lastRead: '2024-11-28', lastReadValue: 4521, monthlyAvg: 185, balance: 450, tenant: 'أحمد علي محمد', brand: 'Landis+Gyr', calibrationDate: '2026-06-15' },
    { id: 'M-002', serial: 'SN-MTR-2021-002', unit: '102', floor: 1, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2021-06-15', lastRead: '2024-11-28', lastReadValue: 3210, monthlyAvg: 142, balance: 210, tenant: 'فاطمة خالد النعيمي', brand: 'Landis+Gyr', calibrationDate: '2026-06-15' },
    { id: 'M-003', serial: 'SN-MTR-2021-003', unit: '103', floor: 1, type: 'standard', typeLabel: 'عادي', status: 'active', statusLabel: 'نشط', installDate: '2021-06-15', lastRead: '2024-09-01', lastReadValue: 1820, monthlyAvg: 0, balance: 0, tenant: null, brand: 'Elster', calibrationDate: '2025-06-15' },
    { id: 'M-004', serial: 'SN-MTR-2021-004', unit: '201', floor: 2, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2021-06-15', lastRead: '2024-11-28', lastReadValue: 5102, monthlyAvg: 201, balance: 0, tenant: 'سالم محمد الزعابي', brand: 'Landis+Gyr', calibrationDate: '2026-06-15' },
    { id: 'M-005', serial: 'SN-MTR-2021-005', unit: '202', floor: 2, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2021-06-15', lastRead: '2024-11-28', lastReadValue: 2890, monthlyAvg: 156, balance: 780, tenant: 'مريم راشد العامري', brand: 'Landis+Gyr', calibrationDate: '2026-06-15' },
    { id: 'M-006', serial: 'SN-MTR-2021-006', unit: '203', floor: 2, type: 'standard', typeLabel: 'عادي', status: 'fault', statusLabel: 'عطل', installDate: '2021-06-15', lastRead: '2024-11-10', lastReadValue: 1540, monthlyAvg: 98, balance: 125, tenant: 'خالد سعيد البلوشي', brand: 'Elster', calibrationDate: '2025-06-15' },
    { id: 'M-007', serial: 'SN-MTR-2022-007', unit: '301', floor: 3, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2022-01-10', lastRead: '2024-11-28', lastReadValue: 3876, monthlyAvg: 178, balance: 340, tenant: 'علي حسن المنصوري', brand: 'Itron', calibrationDate: '2027-01-10' },
    { id: 'M-008', serial: 'SN-MTR-2022-008', unit: '302', floor: 3, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2022-01-10', lastRead: '2024-11-28', lastReadValue: 2654, monthlyAvg: 163, balance: 620, tenant: 'نورة أحمد الشحي', brand: 'Itron', calibrationDate: '2027-01-10' },
    { id: 'M-024', serial: 'SN-MTR-2023-024', unit: '601', floor: 6, type: 'smart', typeLabel: 'ذكي', status: 'active', statusLabel: 'نشط', installDate: '2023-01-01', lastRead: '2024-11-28', lastReadValue: 8910, monthlyAvg: 445, balance: 1250, tenant: 'عبدالله ماجد القاسمي', brand: 'Landis+Gyr', calibrationDate: '2028-01-01' },
    { id: 'M-025', serial: 'SN-MTR-2023-025', unit: '602', floor: 6, type: 'smart', typeLabel: 'ذكي', status: 'disconnected', statusLabel: 'مفصول', installDate: '2023-01-01', lastRead: '2024-10-01', lastReadValue: 2100, monthlyAvg: 0, balance: 0, tenant: null, brand: 'Landis+Gyr', calibrationDate: '2028-01-01' },
  ],
  invoices: [
    { id: 'INV-2024-1123', date: '2024-11-01', amount: 48500, status: 'paid', type: 'gas' },
    { id: 'INV-2024-1050', date: '2024-10-01', amount: 51200, status: 'paid', type: 'gas' },
    { id: 'INV-2024-0981', date: '2024-09-01', amount: 44800, status: 'paid', type: 'gas' },
    { id: 'INV-2024-0899', date: '2024-08-01', amount: 56100, status: 'overdue', type: 'gas' },
    { id: 'INV-2024-1188', date: '2024-12-01', amount: 46000, status: 'pending', type: 'amc' },
  ],
  amcContracts: [
    {
      id: 'AMC-2025-001', contractNo: 'AMC-BLD-2025-001',
      vendor: 'شركة الغاز الوطنية EMGAS', vendorContact: '+971 2 555 0101', vendorEmail: 'contracts@emgas.ae',
      startDate: '2025-01-01', endDate: '2025-12-31',
      annualValue: 48000, currency: 'د.إ',
      status: 'active',
      scope: ['صيانة وفحص مواسير الغاز', 'فحص سلامة الخزانات', 'كشف التسريبات', 'فحص نقاط الاتصال بالعدادات', 'تقرير سلامة سنوي'],
      visitFrequency: 'ربع سنوي', visitsDone: 3, visitsTotal: 4,
      lastVisit: '2026-09-10', lastVisitReport: 'لا توجد تسريبات — حالة المواسير جيدة',
      nextVisit: '2026-12-10',
      notes: 'يشمل استجابة طوارئ خلال 4 ساعات من الإبلاغ',
    },
    {
      id: 'AMC-2023-001', contractNo: 'AMC-BLD-2023-001',
      vendor: 'شركة التقنية للأنظمة الذكية', vendorContact: '+971 50 234 5678', vendorEmail: 'info@techsys.ae',
      startDate: '2023-01-01', endDate: '2023-12-31',
      annualValue: 36000, currency: 'د.إ',
      status: 'expired',
      scope: ['صيانة العدادات الذكية', 'فحص أنظمة القياس'],
      visitFrequency: 'ربع سنوي', visitsDone: 4, visitsTotal: 4,
      lastVisit: '2023-11-15', lastVisitReport: 'اكتملت جميع زيارات الصيانة',
      nextVisit: null,
      notes: 'منتهي — تم إنجاز جميع الزيارات المقررة',
    },
  ],
  supplyContracts: [
    {
      id: 'GSC-2024-001', contractNo: 'GSC-BLD-2024-001',
      tenant: 'أحمد علي محمد', tenantId: 'T-001', unit: '101', meter: 'M-001',
      startDate: '2024-01-01', endDate: '2024-12-31', status: 'active',
      monthlyFee: 150, gasUnitPrice: 3.5, currency: 'د.إ',
      depositAmount: 500, depositPaid: true, depositDate: '2024-01-01',
      connectionFee: 200, connectionFeePaid: true,
      disconnectionFee: 150,
      lastReading: 1240, lastReadDate: '2026-09-01',
      balanceM3: 450, balanceAmount: 1575,
      overdueAmount: 0, paymentStatus: 'paid',
    },
    {
      id: 'GSC-2024-002', contractNo: 'GSC-BLD-2024-002',
      tenant: 'فاطمة خالد النعيمي', tenantId: 'T-002', unit: '102', meter: 'M-002',
      startDate: '2024-02-01', endDate: '2025-01-31', status: 'active',
      monthlyFee: 150, gasUnitPrice: 3.5, currency: 'د.إ',
      depositAmount: 500, depositPaid: true, depositDate: '2024-02-01',
      connectionFee: 200, connectionFeePaid: true,
      disconnectionFee: 150,
      lastReading: 870, lastReadDate: '2026-09-01',
      balanceM3: 210, balanceAmount: 735,
      overdueAmount: 0, paymentStatus: 'paid',
    },
    {
      id: 'GSC-2024-003', contractNo: 'GSC-BLD-2024-003',
      tenant: 'سالم محمد الزعابي', tenantId: 'T-003', unit: '201', meter: 'M-004',
      startDate: '2024-01-15', endDate: '2025-01-14', status: 'active',
      monthlyFee: 150, gasUnitPrice: 3.5, currency: 'د.إ',
      depositAmount: 500, depositPaid: true, depositDate: '2024-01-15',
      connectionFee: 200, connectionFeePaid: true,
      disconnectionFee: 150,
      lastReading: 560, lastReadDate: '2026-09-01',
      balanceM3: 0, balanceAmount: 0,
      overdueAmount: 450, paymentStatus: 'overdue',
    },
    {
      id: 'GSC-2024-004', contractNo: 'GSC-BLD-2024-004',
      tenant: 'خالد سعيد البلوشي', tenantId: 'T-005', unit: '203', meter: 'M-006',
      startDate: '2024-04-01', endDate: '2025-03-31', status: 'active',
      monthlyFee: 150, gasUnitPrice: 3.5, currency: 'د.إ',
      depositAmount: 500, depositPaid: false, depositDate: null,
      connectionFee: 200, connectionFeePaid: true,
      disconnectionFee: 150,
      lastReading: 310, lastReadDate: '2026-09-01',
      balanceM3: 125, balanceAmount: 437.5,
      overdueAmount: 500, paymentStatus: 'pending',
    },
    {
      id: 'GSC-2022-010', contractNo: 'GSC-BLD-2022-010',
      tenant: 'ناصر حمد الكتبي', tenantId: 'T-EX-001', unit: '302', meter: 'M-009',
      startDate: '2022-06-01', endDate: '2023-05-31', status: 'expired',
      monthlyFee: 130, gasUnitPrice: 3.2, currency: 'د.إ',
      depositAmount: 500, depositPaid: true, depositDate: '2022-06-01',
      connectionFee: 200, connectionFeePaid: true,
      disconnectionFee: 150,
      lastReading: 2100, lastReadDate: '2023-05-15',
      balanceM3: 0, balanceAmount: 0,
      overdueAmount: 0, paymentStatus: 'paid',
    },
  ],
  serviceRequests: [
    { id: 'SR-2024-0456', date: '2024-11-20', description: 'تسرب طفيف في خط الغاز - الطابق 3', priority: 'high', status: 'in_progress', assignee: 'فريق الصيانة أ' },
    { id: 'SR-2024-0412', date: '2024-11-05', description: 'فحص دوري للخزانات', priority: 'medium', status: 'completed', assignee: 'فريق التفتيش' },
    { id: 'SR-2024-0378', date: '2024-10-18', description: 'استبدال عداد الغاز - الوحدة 203', priority: 'low', status: 'completed', assignee: 'محمد الفني' },
  ],
  documents: [
    { name: 'عقد إدارة المبنى', type: 'contract', date: '2022-03-15', size: '2.4 MB' },
    { name: 'شهادة المطابقة الفنية', type: 'certificate', date: '2024-01-15', size: '1.1 MB' },
    { name: 'رخصة الغاز', type: 'license', date: '2024-06-01', size: '890 KB' },
    { name: 'مخطط المبنى', type: 'blueprint', date: '2022-03-15', size: '8.2 MB' },
    { name: 'تقرير التفتيش السنوي 2024', type: 'report', date: '2024-01-20', size: '3.6 MB' },
  ],
  scheduledVisits: [
    {
      id: 'VIS-2026-Q4-001', contractId: 'AMC-2025-001', contractNo: 'AMC-BLD-2025-001',
      vendor: 'شركة الغاز الوطنية EMGAS',
      type: 'quarterly', typeLabel: 'صيانة ربع سنوية',
      quarter: 'Q4 2026',
      scheduledDate: '2026-12-10', timeSlot: '09:00 - 12:00',
      technician: 'المهندس سالم الكعبي', technicianPhone: '+971501112233',
      status: 'scheduled',
      checklistItems: [
        { id: 1, item: 'فحص مواسير الغاز — الطابق 1-3',   done: false },
        { id: 2, item: 'فحص مواسير الغاز — الطابق 4-6',   done: false },
        { id: 3, item: 'كشف التسريبات بالأجهزة الإلكترونية', done: false },
        { id: 4, item: 'فحص سلامة الخزانات',               done: false },
        { id: 5, item: 'فحص نقاط الاتصال بالعدادات',       done: false },
        { id: 6, item: 'اختبار صمامات الأمان',             done: false },
        { id: 7, item: 'مراجعة ضغط الغاز على الخط الرئيسي', done: false },
        { id: 8, item: 'توثيق وتحرير تقرير الفحص',         done: false },
      ],
      findings: [],
      report: null,
      notes: 'الزيارة الرابعة والأخيرة لعام 2026',
    },
    {
      id: 'VIS-2026-Q3-001', contractId: 'AMC-2025-001', contractNo: 'AMC-BLD-2025-001',
      vendor: 'شركة الغاز الوطنية EMGAS',
      type: 'quarterly', typeLabel: 'صيانة ربع سنوية',
      quarter: 'Q3 2026',
      scheduledDate: '2026-09-10', timeSlot: '09:00 - 12:00',
      technician: 'المهندس سالم الكعبي', technicianPhone: '+971501112233',
      status: 'completed',
      checklistItems: [
        { id: 1, item: 'فحص مواسير الغاز — الطابق 1-3',   done: true },
        { id: 2, item: 'فحص مواسير الغاز — الطابق 4-6',   done: true },
        { id: 3, item: 'كشف التسريبات بالأجهزة الإلكترونية', done: true },
        { id: 4, item: 'فحص سلامة الخزانات',               done: true },
        { id: 5, item: 'فحص نقاط الاتصال بالعدادات',       done: true },
        { id: 6, item: 'اختبار صمامات الأمان',             done: true },
        { id: 7, item: 'مراجعة ضغط الغاز على الخط الرئيسي', done: true },
        { id: 8, item: 'توثيق وتحرير تقرير الفحص',         done: true },
      ],
      findings: [
        { severity: 'info',    description: 'تدني طفيف في ضغط الخط الرئيسي — ضمن النطاق المقبول' },
        { severity: 'warning', description: 'صمام أمان الخزان T-002 يحتاج لاستبدال خلال 6 أشهر' },
      ],
      report: 'VIS_Q3_2026_BLD001.pdf',
      completedDate: '2026-09-10',
      notes: 'لا توجد تسريبات — حالة المواسير جيدة',
      rating: 5,
    },
    {
      id: 'VIS-2026-Q2-001', contractId: 'AMC-2025-001', contractNo: 'AMC-BLD-2025-001',
      vendor: 'شركة الغاز الوطنية EMGAS',
      type: 'quarterly', typeLabel: 'صيانة ربع سنوية',
      quarter: 'Q2 2026',
      scheduledDate: '2026-06-15', timeSlot: '10:00 - 13:00',
      technician: 'المهندس محمد الزعابي', technicianPhone: '+971502223344',
      status: 'completed',
      checklistItems: [
        { id: 1, item: 'فحص مواسير الغاز — الطابق 1-3',   done: true },
        { id: 2, item: 'فحص مواسير الغاز — الطابق 4-6',   done: true },
        { id: 3, item: 'كشف التسريبات بالأجهزة الإلكترونية', done: true },
        { id: 4, item: 'فحص سلامة الخزانات',               done: true },
        { id: 5, item: 'فحص نقاط الاتصال بالعدادات',       done: true },
        { id: 6, item: 'اختبار صمامات الأمان',             done: true },
        { id: 7, item: 'مراجعة ضغط الغاز على الخط الرئيسي', done: true },
        { id: 8, item: 'توثيق وتحرير تقرير الفحص',         done: true },
      ],
      findings: [],
      report: 'VIS_Q2_2026_BLD001.pdf',
      completedDate: '2026-06-15',
      notes: 'جميع الأنظمة تعمل بكفاءة',
      rating: 5,
    },
    {
      id: 'VIS-2026-Q1-001', contractId: 'AMC-2025-001', contractNo: 'AMC-BLD-2025-001',
      vendor: 'شركة الغاز الوطنية EMGAS',
      type: 'quarterly', typeLabel: 'صيانة ربع سنوية',
      quarter: 'Q1 2026',
      scheduledDate: '2026-03-12', timeSlot: '09:00 - 12:00',
      technician: 'المهندس سالم الكعبي', technicianPhone: '+971501112233',
      status: 'completed',
      checklistItems: [
        { id: 1, item: 'فحص مواسير الغاز — الطابق 1-3',   done: true },
        { id: 2, item: 'فحص مواسير الغاز — الطابق 4-6',   done: true },
        { id: 3, item: 'كشف التسريبات بالأجهزة الإلكترونية', done: true },
        { id: 4, item: 'فحص سلامة الخزانات',               done: true },
        { id: 5, item: 'فحص نقاط الاتصال بالعدادات',       done: true },
        { id: 6, item: 'اختبار صمامات الأمان',             done: true },
        { id: 7, item: 'مراجعة ضغط الغاز على الخط الرئيسي', done: true },
        { id: 8, item: 'توثيق وتحرير تقرير الفحص',         done: true },
      ],
      findings: [
        { severity: 'warning', description: 'بعض المواسير في الطابق الثالث تحتاج طلاء عازل' },
      ],
      report: 'VIS_Q1_2026_BLD001.pdf',
      completedDate: '2026-03-12',
      notes: 'تم تقديم توصيات الطلاء العازل لإدارة المبنى',
      rating: 4,
    },
    {
      id: 'VIS-2026-EMG-001', contractId: 'AMC-2025-001', contractNo: 'AMC-BLD-2025-001',
      vendor: 'شركة الغاز الوطنية EMGAS',
      type: 'emergency', typeLabel: 'زيارة طارئة',
      quarter: null,
      scheduledDate: '2026-07-28', timeSlot: 'طارئ',
      technician: 'المهندس أحمد الفلاحي', technicianPhone: '+971503334455',
      status: 'completed',
      checklistItems: [
        { id: 1, item: 'تحديد موقع الإنذار / البلاغ',      done: true },
        { id: 2, item: 'فحص نقطة التسرب المشتبه بها',      done: true },
        { id: 3, item: 'عزل القسم المتأثر',                 done: true },
        { id: 4, item: 'إصلاح التسرب أو التوصية بالإيقاف', done: true },
        { id: 5, item: 'اختبار ما بعد الإصلاح',            done: true },
      ],
      findings: [
        { severity: 'error', description: 'تسرب طفيف في وصلة ماء بالقرب من العداد M-006 — تم إصلاحه' },
      ],
      report: 'EMG_VIS_2026_0728.pdf',
      completedDate: '2026-07-28',
      notes: 'استجابة في 2.5 ساعة — ضمن SLA',
      rating: 5,
    },
  ],
  civilDefense: {
    certificates: [
      {
        id: 'COC-2024-BLD-001',
        type: 'شهادة مطابقة الدفاع المدني',
        typeEn: 'Civil Defense Certificate of Compliance',
        issueDate: '2024-03-15',
        expiryDate: '2025-03-14',
        issuedBy: 'الدفاع المدني — أبوظبي',
        licenseNo: 'ADCD-2024-GAS-00124',
        scope: 'منظومة الغاز الكاملة — خزانات، أنابيب، عدادات',
        inspector: 'المفتش خالد الرميثي',
        inspectionDate: '2024-03-10',
        status: 'expired',
        notes: 'تجديد مطلوب — تم الإشعار في فبراير 2025',
        documents: ['COC_2024_BLD001.pdf'],
        renewalStarted: true,
        renewalStep: 3,
      },
      {
        id: 'COC-2025-BLD-001',
        type: 'شهادة مطابقة الدفاع المدني',
        typeEn: 'Civil Defense Certificate of Compliance',
        issueDate: '2025-04-01',
        expiryDate: '2026-03-31',
        issuedBy: 'الدفاع المدني — أبوظبي',
        licenseNo: 'ADCD-2025-GAS-00089',
        scope: 'منظومة الغاز الكاملة — خزانات، أنابيب، عدادات',
        inspector: 'المفتش خالد الرميثي',
        inspectionDate: '2025-03-28',
        status: 'active',
        notes: '',
        documents: ['COC_2025_BLD001.pdf'],
        renewalStarted: false,
        renewalStep: 0,
      },
      {
        id: 'COC-2026-BLD-001',
        type: 'شهادة مطابقة الدفاع المدني',
        typeEn: 'Civil Defense Certificate of Compliance',
        issueDate: null,
        expiryDate: '2027-03-31',
        issuedBy: 'الدفاع المدني — أبوظبي',
        licenseNo: null,
        scope: 'منظومة الغاز الكاملة — خزانات، أنابيب، عدادات',
        inspector: null,
        inspectionDate: null,
        status: 'renewal_in_progress',
        notes: 'طلب التجديد مقدَّم — بانتظار جدولة الفحص',
        documents: [],
        renewalStarted: true,
        renewalStep: 2,
      },
    ],
    lastInspection: '2025-03-28',
    nextRenewalDue: '2026-03-31',
    inspector: 'المفتش خالد الرميثي',
    inspectorPhone: '+971-2-xxx-xxxx',
    inspectorDept: 'إدارة الدفاع المدني — أبوظبي',
  },
  refillRequests: [
    // Stage 5 (scheduled) — has PO, payment, collection, invoice done; waiting for delivery day
    { id: 'RFR-2026-0089', stage: 5, status: 'scheduled', priority: 'medium', requestDate: '2026-09-10', requestedBy: 'مدير المبنى', tank: 'T-001', tankLabel: 'خزان LPG 1', currentLevel: 3750, capacity: 5000, levelPct: 75, requestedQty: 1000, quantityUnit: 'لتر', notes: 'تعبئة روتينية',
      stageData: {
        po:         { supplier: 'EMGAS', poNumber: 'PO-2026-0089', poDate: '2026-09-11', poQty: 1000, unitPrice: 8.5, totalAmount: 8500 },
        payment:    { amount: 8500, date: '2026-09-12', method: 'تحويل بنكي', reference: 'TXN-20260912-001' },
        collection: { tankerPlate: 'أ ب ج 4521 أبوظبي', driverName: 'محمد علي سالم', collectionDate: '2026-09-13', meterBefore: 2000, meterAfter: 3050 },
        invoice:    { invoiceNumber: 'INV-EMGAS-2026-445', invoiceDate: '2026-09-13', amount: 8500 },
        schedule:   { deliveryDate: '2026-09-20', deliveryTime: '09:00', civilDefenseConfirmed: true, civilDefenseRef: 'CD-2026-8821' },
      },
    },
    // Stage 1 (PO step) — new request just created, needs PO
    { id: 'RFR-2026-0101', stage: 1, status: 'requested', priority: 'high', requestDate: '2026-09-18', requestedBy: 'فريق التشغيل', tank: 'T-002', tankLabel: 'خزان LPG 2', currentLevel: 1200, capacity: 5000, levelPct: 24, requestedQty: 3500, quantityUnit: 'لتر', notes: 'بحاجة تعبئة عاجلة', stageData: {} },
    // Completed
    { id: 'RFR-2026-0074', stage: 9, status: 'completed', priority: 'high', requestDate: '2026-09-01', requestedBy: 'مدير المبنى', tank: 'T-002', tankLabel: 'خزان LPG 2', currentLevel: 1200, capacity: 5000, levelPct: 24, requestedQty: 3500, quantityUnit: 'لتر', notes: 'مستوى منخفض',
      completedDate: '2026-09-03', deliveredQty: 3500, newTankLevel: 4700, newLevelPct: 94,
      stageData: {
        po:         { supplier: 'EMGAS', poNumber: 'PO-2026-0074', poDate: '2026-09-01', poQty: 3500, unitPrice: 8.5, totalAmount: 29750 },
        payment:    { amount: 29750, date: '2026-09-02', method: 'تحويل بنكي', reference: 'TXN-20260902-002' },
        collection: { tankerPlate: 'د ه و 3312 أبوظبي', driverName: 'خالد راشد', collectionDate: '2026-09-02', meterBefore: 500, meterAfter: 4050 },
        invoice:    { invoiceNumber: 'INV-EMGAS-2026-389', invoiceDate: '2026-09-02', amount: 29750 },
        schedule:   { deliveryDate: '2026-09-03', deliveryTime: '08:00', civilDefenseConfirmed: true, civilDefenseRef: 'CD-2026-7740' },
        refill:     { refillDate: '2026-09-03', refillTime: '08:30', tankerPlate: 'د ه و 3312 أبوظبي', driverName: 'خالد راشد', tankMeterBefore: 1200, tankMeterAfter: 4700 },
        approval:   { approvedBy: 'م. سعيد العامري', approvalDate: '2026-09-03', notes: 'تمت التعبئة بنجاح' },
      },
    },
    { id: 'RFR-2026-0061', stage: 9, status: 'completed', priority: 'high', requestDate: '2026-08-18', requestedBy: 'فريق التشغيل', tank: 'T-003', tankLabel: 'خزان غاز طبيعي', currentLevel: 480, capacity: 2000, levelPct: 24, requestedQty: 1400, quantityUnit: 'م³', notes: '',
      completedDate: '2026-08-20', deliveredQty: 1350, newTankLevel: 1830, newLevelPct: 92,
      stageData: {
        po:         { supplier: 'ADNOC Gas', poNumber: 'PO-2026-0061', poDate: '2026-08-18', poQty: 1400, unitPrice: 4.2, totalAmount: 5880 },
        payment:    { amount: 5880, date: '2026-08-19', method: 'تحويل بنكي', reference: 'TXN-20260819-003' },
        collection: { tankerPlate: 'ز ح ط 7781 العين', driverName: 'يوسف ناصر', collectionDate: '2026-08-19', meterBefore: 1000, meterAfter: 2400 },
        invoice:    { invoiceNumber: 'INV-ADNOC-2026-211', invoiceDate: '2026-08-19', amount: 5670 },
        schedule:   { deliveryDate: '2026-08-20', deliveryTime: '10:00', civilDefenseConfirmed: true, civilDefenseRef: 'CD-2026-6612' },
        refill:     { refillDate: '2026-08-20', refillTime: '10:15', tankerPlate: 'ز ح ط 7781 العين', driverName: 'يوسف ناصر', tankMeterBefore: 480, tankMeterAfter: 1830 },
        approval:   { approvedBy: 'م. سعيد العامري', approvalDate: '2026-08-20' },
      },
    },
    { id: 'RFR-2026-0042', stage: 9, status: 'completed', priority: 'urgent', requestDate: '2026-08-01', requestedBy: 'مدير المبنى', tank: 'T-001', tankLabel: 'خزان LPG 1', currentLevel: 800, capacity: 5000, levelPct: 16, requestedQty: 4000, quantityUnit: 'لتر', notes: 'منخفض جداً',
      completedDate: '2026-08-05', deliveredQty: 4000, newTankLevel: 4800, newLevelPct: 96,
      stageData: {
        po:         { supplier: 'EMGAS', poNumber: 'PO-2026-0042', poDate: '2026-08-01', poQty: 4000, unitPrice: 8.5, totalAmount: 34000 },
        payment:    { amount: 34000, date: '2026-08-02', method: 'تحويل بنكي', reference: 'TXN-20260802-004' },
        collection: { tankerPlate: 'أ ب ج 4521 أبوظبي', driverName: 'محمد علي سالم', collectionDate: '2026-08-04', meterBefore: 100, meterAfter: 4150 },
        invoice:    { invoiceNumber: 'INV-EMGAS-2026-301', invoiceDate: '2026-08-04', amount: 34000 },
        schedule:   { deliveryDate: '2026-08-05', deliveryTime: '07:30', civilDefenseConfirmed: true, civilDefenseRef: 'CD-2026-5501' },
        refill:     { refillDate: '2026-08-05', refillTime: '08:00', tankerPlate: 'أ ب ج 4521 أبوظبي', driverName: 'محمد علي سالم', tankMeterBefore: 800, tankMeterAfter: 4800 },
        approval:   { approvedBy: 'م. سعيد العامري', approvalDate: '2026-08-05' },
      },
    },
    { id: 'RFR-2026-0028', stage: 9, status: 'completed', priority: 'high', requestDate: '2026-07-10', requestedBy: 'مدير المبنى', tank: 'T-002', tankLabel: 'خزان LPG 2', currentLevel: 950, capacity: 5000, levelPct: 19, requestedQty: 3800, quantityUnit: 'لتر', notes: '',
      completedDate: '2026-07-12', deliveredQty: 3800, newTankLevel: 4750, newLevelPct: 95,
      stageData: {
        po:         { supplier: 'EMGAS', poNumber: 'PO-2026-0028', poDate: '2026-07-10', poQty: 3800, unitPrice: 8.5, totalAmount: 32300 },
        payment:    { amount: 32300, date: '2026-07-11', method: 'شيك', reference: 'CHQ-441221' },
        collection: { tankerPlate: 'د ه و 3312 أبوظبي', driverName: 'خالد راشد', collectionDate: '2026-07-11', meterBefore: 200, meterAfter: 4050 },
        invoice:    { invoiceNumber: 'INV-EMGAS-2026-178', invoiceDate: '2026-07-11', amount: 32300 },
        schedule:   { deliveryDate: '2026-07-12', deliveryTime: '09:00', civilDefenseConfirmed: true, civilDefenseRef: 'CD-2026-4430' },
        refill:     { refillDate: '2026-07-12', refillTime: '09:20', tankerPlate: 'د ه و 3312 أبوظبي', driverName: 'خالد راشد', tankMeterBefore: 950, tankMeterAfter: 4750 },
        approval:   { approvedBy: 'م. سعيد العامري', approvalDate: '2026-07-12' },
      },
    },
  ] as RefillRequestItem[],
  activity: [
    { date: '2024-11-20', action: 'فتح طلب خدمة — تسرب في خط الغاز ط3', type: 'warning' },
    { date: '2024-11-01', action: 'إصدار فاتورة الغاز INV-2024-1123 بمبلغ 48,500 د.إ', type: 'info' },
    { date: '2024-10-15', action: 'تسديد فاتورة INV-2024-1050 — 51,200 د.إ', type: 'success' },
    { date: '2024-10-05', action: 'تجديد عقد المستأجر — فاطمة خالد، الوحدة 102', type: 'success' },
    { date: '2024-09-15', action: 'انتهاء عقد — الوحدة 103، إخلاء الشقة', type: 'warning' },
  ],
  tenants: [
    { id: 'T-001', name: 'أحمد علي محمد', nameEn: 'Ahmed Ali Mohammed', nationality: 'إماراتي', emiratesId: '784-1985-2345678-1', phone: '+971501234567', email: 'ahmed.ali@email.com', unit: '101', floor: 1, contractNo: 'GC-2024-001', contractStart: '2024-01-01', contractEnd: '2024-12-31', rent: 65000, paymentStatus: 'paid', meterNo: 'M-001', gasBalance: 450, depositPaid: true, avatar: 'أع' },
    { id: 'T-002', name: 'فاطمة خالد النعيمي', nameEn: 'Fatima Khalid Al Nuaimi', nationality: 'إماراتي', emiratesId: '784-1990-3456789-2', phone: '+971502345678', email: 'f.nuaimi@email.com', unit: '102', floor: 1, contractNo: 'GC-2024-002', contractStart: '2024-02-01', contractEnd: '2025-01-31', rent: 65000, paymentStatus: 'paid', meterNo: 'M-002', gasBalance: 210, depositPaid: true, avatar: 'فخ' },
    { id: 'T-003', name: 'سالم محمد الزعابي', nameEn: 'Salem Mohammed Al Zaabi', nationality: 'إماراتي', emiratesId: '784-1980-4567890-1', phone: '+971503456789', email: 's.zaabi@email.com', unit: '201', floor: 2, contractNo: 'GC-2024-003', contractStart: '2024-01-15', contractEnd: '2025-01-14', rent: 65000, paymentStatus: 'overdue', meterNo: 'M-004', gasBalance: 0, depositPaid: true, avatar: 'سم' },
    { id: 'T-004', name: 'مريم راشد العامري', nameEn: 'Mariam Rashid Al Ameri', nationality: 'إماراتي', emiratesId: '784-1992-5678901-2', phone: '+971504567890', email: 'm.ameri@email.com', unit: '202', floor: 2, contractNo: 'GC-2024-004', contractStart: '2024-03-01', contractEnd: '2025-02-28', rent: 60000, paymentStatus: 'paid', meterNo: 'M-005', gasBalance: 780, depositPaid: true, avatar: 'مر' },
    { id: 'T-005', name: 'خالد سعيد البلوشي', nameEn: 'Khalid Saeed Al Balushi', nationality: 'عماني', emiratesId: '784-1988-6789012-1', phone: '+971505678901', email: 'k.balushi@email.com', unit: '203', floor: 2, contractNo: 'GC-2024-005', contractStart: '2024-04-01', contractEnd: '2025-03-31', rent: 55000, paymentStatus: 'pending', meterNo: 'M-006', gasBalance: 125, depositPaid: false, avatar: 'خس' },
    { id: 'T-006', name: 'علي حسن المنصوري', nameEn: 'Ali Hassan Al Mansouri', nationality: 'إماراتي', emiratesId: '784-1975-7890123-1', phone: '+971506789012', email: 'ali.mansouri@email.com', unit: '301', floor: 3, contractNo: 'GC-2024-006', contractStart: '2023-12-01', contractEnd: '2024-11-30', rent: 65000, paymentStatus: 'paid', meterNo: 'M-007', gasBalance: 340, depositPaid: true, avatar: 'عح' },
    { id: 'T-007', name: 'نورة أحمد الشحي', nameEn: 'Noura Ahmed Al Shahi', nationality: 'إماراتي', emiratesId: '784-1995-8901234-2', phone: '+971507890123', email: 'n.shahi@email.com', unit: '302', floor: 3, contractNo: 'GC-2024-007', contractStart: '2024-05-01', contractEnd: '2025-04-30', rent: 65000, paymentStatus: 'paid', meterNo: 'M-008', gasBalance: 620, depositPaid: true, avatar: 'نأ' },
    { id: 'T-008', name: 'عبدالله ماجد القاسمي', nameEn: 'Abdullah Majed Al Qasimi', nationality: 'إماراتي', emiratesId: '784-1970-9012345-1', phone: '+971508901234', email: 'a.qasimi@email.com', unit: '601', floor: 6, contractNo: 'GC-2024-022', contractStart: '2024-01-01', contractEnd: '2024-12-31', rent: 150000, paymentStatus: 'paid', meterNo: 'M-024', gasBalance: 1250, depositPaid: true, avatar: 'عم' },
    { id: 'T-009', name: 'يوسف عمر الحمادي', nameEn: 'Yousef Omar Al Hamadi', nationality: 'إماراتي', emiratesId: '784-1993-1234567-1', phone: '+971509012345', email: 'y.hamadi@email.com', unit: '401', floor: 4, contractNo: 'GC-2024-008', contractStart: '2024-06-01', contractEnd: '2025-05-31', rent: 65000, paymentStatus: 'paid', meterNo: null, gasBalance: 0, depositPaid: true, avatar: 'يع' },
    { id: 'T-010', name: 'هند سعود المهيري', nameEn: 'Hind Saud Al Muhairi', nationality: 'إماراتي', emiratesId: '784-1997-2345678-2', phone: '+971500123456', email: 'h.muhairi@email.com', unit: '402', floor: 4, contractNo: 'GC-2024-009', contractStart: '2024-07-01', contractEnd: '2025-06-30', rent: 55000, paymentStatus: 'pending', meterNo: null, gasBalance: 0, depositPaid: false, avatar: 'هس' },
    { id: 'T-011', name: 'بدر علي الكعبي', nameEn: 'Badr Ali Al Kaabi', nationality: 'إماراتي', emiratesId: '784-1989-3456789-1', phone: '+971501112233', email: 'b.kaabi@email.com', unit: '502', floor: 5, contractNo: 'GC-2024-010', contractStart: '2024-09-01', contractEnd: '2025-08-31', rent: 55000, paymentStatus: 'paid', meterNo: null, gasBalance: 0, depositPaid: true, avatar: 'بع' },
  ],
};

const meterStatusMap: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: 'نشط' },
  fault: { color: 'red', label: 'عطل' },
  disconnected: { color: 'default', label: 'مفصول' },
  maintenance: { color: 'orange', label: 'صيانة' },
};

const paymentStatusMap: Record<string, { color: string; label: string }> = {
  paid: { color: 'green', label: 'مسدد' },
  pending: { color: 'orange', label: 'معلق' },
  overdue: { color: 'red', label: 'متأخر' },
};

const unitStatusMap: Record<string, { color: string; label: string }> = {
  occupied: { color: 'green', label: 'مشغول' },
  vacant: { color: 'red', label: 'شاغر' },
  maintenance: { color: 'orange', label: 'صيانة' },
  reserved: { color: 'blue', label: 'محجوز' },
};
const invoiceStatusMap: Record<string, { color: string; label: string }> = {
  paid: { color: 'green', label: 'مسدد' },
  pending: { color: 'blue', label: 'معلق' },
  overdue: { color: 'red', label: 'متأخر' },
};
const srStatusMap: Record<string, { color: string; label: string }> = {
  in_progress: { color: 'orange', label: 'جاري التنفيذ' },
  completed: { color: 'green', label: 'منجز' },
  pending: { color: 'blue', label: 'في الانتظار' },
};
const srPriorityMap: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: 'عالية' },
  medium: { color: 'orange', label: 'متوسطة' },
  low: { color: 'default', label: 'منخفضة' },
};
const docTypeIcon: Record<string, React.ReactNode> = {
  contract: <FileTextOutlined style={{ color: '#1677ff' }} />,
  certificate: <SafetyCertificateOutlined style={{ color: '#52c41a' }} />,
  license: <IdcardOutlined style={{ color: '#fa8c16' }} />,
  blueprint: <BuildOutlined style={{ color: '#722ed1' }} />,
  report: <BarChartOutlined style={{ color: '#13c2c2' }} />,
};

const consumptionOptions: any = {
  chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit' },
  colors: [PRIMARY],
  stroke: { curve: 'smooth', width: 2 },
  fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
  dataLabels: { enabled: false },
  xaxis: { categories: ['يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'], labels: { style: { fontSize: '11px' } } },
  yaxis: { labels: { style: { fontSize: '11px' } } },
  grid: { borderColor: '#f0f0f0', strokeDashArray: 3 },
  tooltip: { y: { formatter: (v: number) => `${v} م³` } },
};
const consumptionSeries = [{ name: 'استهلاك الغاز', data: [1820, 2100, 1950, 1780, 2250, 2050] }];
const unitPieOptions: any = {
  chart: { type: 'donut', fontFamily: 'inherit' },
  colors: ['#52c41a', '#ff4d4f', '#fa8c16', '#1677ff'],
  labels: ['مشغول', 'شاغر', 'صيانة', 'محجوز'],
  legend: { position: 'bottom', fontSize: '12px' },
  plotOptions: { pie: { donut: { size: '70%' } } },
  dataLabels: { enabled: true, formatter: (v: number) => `${Math.round(v)}%` },
};

interface BuildingProfileProps { onBack: () => void; buildingId?: number; initialTab?: string;
  /** Restaurants & Villas: villa mode (the building is a villa's own host building). Not passed = normal building. */
  villaId?: number; }

/** Live header data from GET /buildings/{id} (the other tabs are still mock data). */
interface LiveBuilding {
  id: number; code: string; name?: string; nameEn?: string; branch?: string; city?: string;
  typeLabel?: string; status?: string; statusLabel?: string; totalFloors?: number | null;
  owners: unknown[]; tanks: unknown[];
  stats: { units: number; occupied: number; vacant: number; meters?: number; tenants?: number; activeContracts?: number };
}

const BuildingProfile: React.FC<BuildingProfileProps> = ({ onBack, buildingId, initialTab, villaId }) => {
  const [activeTab, setActiveTab] = useState(initialTab ?? (villaId ? 'villaoverview' : buildingId ? 'units' : 'overview'));
  const [live, setLive] = useState<LiveBuilding | null>(null);
  const [liveKey, setLiveKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const { can } = useAuth();
  const canManageBuilding = can('buildings.manage') && !!buildingId;
  const setBuildingStatus = (status: 'active' | 'inactive') => Modal.confirm({
    title: status === 'inactive' ? 'إيقاف المبنى؟' : 'تفعيل المبنى؟',
    content: status === 'inactive' ? 'يبقى المبنى ووحداته وسجلاته محفوظة ويظهر كـ«غير نشط». يمكن تفعيله لاحقاً.' : 'سيعود المبنى إلى الحالة «نشط».',
    okText: status === 'inactive' ? 'إيقاف' : 'تفعيل', cancelText: 'إلغاء', centered: true,
    onOk: async () => {
      try { await buildingsApi.setStatus(buildingId!, status); message.success(status === 'inactive' ? 'تم إيقاف المبنى' : 'تم تفعيل المبنى'); setLiveKey(k => k + 1); }
      catch (e) { message.error(errorMessage(e), 6); }
    },
  });
  const deleteBuilding = () => Modal.confirm({
    title: 'حذف المبنى؟', content: 'حذف آمن: يختفي المبنى من القوائم مع الاحتفاظ بسجلاته في قاعدة البيانات. لا يمكن حذف مبنى عليه عقود توريد نشطة.',
    okText: 'حذف', okType: 'danger', cancelText: 'إلغاء', centered: true,
    onOk: async () => {
      try { await buildingsApi.remove(buildingId!); message.success('تم حذف المبنى'); onBack(); }
      catch (e) { message.error(errorMessage(e), 6); }
    },
  });
  useEffect(() => {
    if (!buildingId) return;
    buildingsApi.get<LiveBuilding>(buildingId).then(setLive).catch(() => setLive(null));
  }, [buildingId, liveKey]);
  // header values: live building when opened from the list, otherwise the mock
  const hd = live ? {
    name: live.name ?? '', nameEn: live.nameEn ?? '', no: live.code, branch: live.branch ?? '', city: live.city ?? '',
    statusLabel: live.statusLabel ?? live.status ?? '', typeLabel: live.typeLabel ?? '',
    floors: live.totalFloors ?? '—', totalUnits: live.stats.units, occupied: live.stats.occupied, vacant: live.stats.vacant,
    tanks: live.tanks.length, owners: live.owners.length,
  } : {
    name: building.name, nameEn: building.nameEn, no: building.no, branch: building.branch, city: building.address.city,
    statusLabel: building.statusLabel, typeLabel: building.typeLabel,
    floors: building.floors, totalUnits: building.totalUnits, occupied: building.occupied, vacant: building.vacant,
    tanks: building.tanks.length, owners: building.owners.length,
  };
  const [tenantSearch, setTenantSearch] = useState('');
  const [unitSearch, setUnitSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [unitView, setUnitView] = useState<'grid' | 'table'>('table');
  const [meterSearch, setMeterSearch] = useState('');
  const [meterFilter, setMeterFilter] = useState('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [addMeterOpen, setAddMeterOpen] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<MeterRecord | null>(null);
  const [readingMeter, setReadingMeter] = useState<MeterRecord | null>(null);
  const [serviceMeter, setServiceMeter]      = useState<MeterRecord | null>(null);
  const [serviceType, setServiceType]        = useState<MeterServiceType | null>(null);
  const [addTenantOpen, setAddTenantOpen]     = useState(false);
  const [contractTenant, setContractTenant]   = useState<string | undefined>(undefined);
  const [addContractOpen, setAddContractOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<SupplyContractRecord | null>(null);
  const [contractDrawerOpen, setContractDrawerOpen] = useState(false);
  const [invoiceTenant, setInvoiceTenant] = useState<any>(null);
  const [invoiceDrawerOpen, setInvoiceDrawerOpen] = useState(false);
  const [profileTenant, setProfileTenant] = useState<any>(null);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [amcModalOpen, setAmcModalOpen] = useState(false);
  const [amcContracts, setAmcContracts] = useState<any[]>(building.amcContracts ?? []);
  // ── live contracts of this building (the sample lists are used only when no building is open) ──
  const [liveAmc, setLiveAmc] = useState<any[] | null>(null);
  const [visitFor, setVisitFor] = useState<any>(null);
  // supply contracts of a real building go through the unit (UnitProfileDrawer), renewals through the API
  const [contractUnit, setContractUnit] = useState<UnitDto | null>(null);
  const [contractUnitAction, setContractUnitAction] = useState<{ action: any; nonce: number } | null>(null);
  const [pickUnitOpen, setPickUnitOpen] = useState(false);
  const [pickUnits, setPickUnits] = useState<UnitDto[]>([]);
  const [pickUnitId, setPickUnitId] = useState<number | null>(null);
  const [renewTarget, setRenewTarget] = useState<{ kind: 'supply' | 'amc'; c: any } | null>(null);
  const [renewBusy, setRenewBusy] = useState(false);
  const [renewForm] = Form.useForm();
  const [docCount, setDocCount] = useState<number | null>(null);
  const openUnitFor = async (unitId: number, action?: 'tenant') => {
    try {
      const u = await unitsApi.get(unitId);
      setContractUnit(u);
      setContractUnitAction(action ? { action, nonce: Date.now() } : null);
    } catch (e) { message.error(errorMessage(e)); }
  };
  const newSupplyContract = () => {
    if (!buildingId) { setAddContractOpen(true); return; }
    setPickUnitId(null);
    unitsApi.byBuilding(buildingId).then(r => setPickUnits(r.items)).catch(() => setPickUnits([]));
    setPickUnitOpen(true);
  };
  const openRenew = (kind: 'supply' | 'amc', c: any) => {
    if (!buildingId) { message.info('متاح عند فتح مبنى حقيقي'); return; }
    renewForm.resetFields();
    if (kind === 'supply') renewForm.setFieldsValue({ months: c.renewalPeriod ?? 12 });
    else {
      const start = c.endDate ? dayjs(c.endDate).add(1, 'day') : dayjs();
      renewForm.setFieldsValue({ startDate: start, endDate: start.add(1, 'year').subtract(1, 'day'), annualValue: c.annualValue });
    }
    setRenewTarget({ kind, c });
  };
  const submitRenew = async () => {
    if (!renewTarget) return;
    const v = await renewForm.validateFields();
    setRenewBusy(true);
    try {
      if (renewTarget.kind === 'supply') {
        await api(`/supply-contracts/${renewTarget.c.id}/renew`, { method: 'POST', body: { months: v.months, newEndDate: v.newEndDate?.format('YYYY-MM-DD') ?? null } });
        message.success('تم تجديد عقد التوريد');
      } else {
        const r = await api<any>(`/amc-contracts/${renewTarget.c.id}/renew`, { method: 'POST', body: {
          startDate: v.startDate.format('YYYY-MM-DD'), endDate: v.endDate.format('YYYY-MM-DD'), annualValue: v.annualValue ?? null } });
        message.success(`تم إنشاء عقد الصيانة المجدد ${r?.contractNo ?? ''}`);
      }
      setRenewTarget(null);
      setLiveKey(k => k + 1);
    } catch (e) { message.error(errorMessage(e), 6); } finally { setRenewBusy(false); }
  };
  const [reportFor, setReportFor] = useState<any>(null);
  const [liveSupply, setLiveSupply] = useState<any[] | null>(null);
  useEffect(() => {
    if (!buildingId) return;
    const VISIT_LABEL: Record<string, string> = { monthly: 'شهري', bimonthly: 'كل شهرين', quarterly: 'ربع سنوي', semi_annual: 'نصف سنوي', annual: 'سنوي' };
    api<Paged<any>>('/amc-contracts', { query: { buildingId, pageSize: 0 } })
      .then(r => setLiveAmc(r.items.map(c => ({
        ...c, id: String(c.id), annualValue: Number(c.annualValue ?? 0), visitsTotal: Number(c.visitsTotal ?? 0), visitsDone: Number(c.visitsDone ?? 0),
        visitFrequency: VISIT_LABEL[c.visitFrequency] ?? c.visitFrequency ?? '—', status: c.status === 'terminated' ? 'expired' : (c.status ?? 'active'),
        lastVisitReport: c.lastVisitReport ?? '', notes: c.notes ?? '', scope: c.scope ?? [],
      }))))
      .catch(() => setLiveAmc([]));
    api<Paged<any>>('/supply-contracts', { query: { buildingId, pageSize: 0 } })
      .then(r => setLiveSupply(r.items.map(c => ({
        ...c, id: String(c.id), status: c.isActive ? 'active' : c.status === 'draft' || c.status === 'pending' ? 'pending' : 'expired',
        currency: 'د.إ', monthlyFee: Number(c.monthlyFee ?? 0), balanceAmount: Number(c.balanceAmount ?? 0), overdueAmount: Number(c.overdueAmount ?? 0),
        depositAmount: Number(c.depositAmount ?? 0), balanceM3: Number(c.balanceM3 ?? 0), connectionFeePaid: false,
      }))))
      .catch(() => setLiveSupply([]));
  }, [buildingId, liveKey]);
  const amcList: any[] = buildingId ? (liveAmc ?? []) : amcContracts;
  // villa mode: no units → the villa's own gas contracts (price per litre) replace the unit supply contracts
  const [villaGas, setVillaGas] = useState<any[]>([]);
  useEffect(() => {
    if (!villaId) return;
    premisesApi.get(villaId).then(d => setVillaGas(d.contracts ?? [])).catch(() => setVillaGas([]));
  }, [villaId, liveKey]);
  const supplyList: any[] = villaId ? villaGas : buildingId ? (liveSupply ?? []) : building.supplyContracts;
  const [refillRequests, setRefillRequests] = useState<RefillRequestItem[]>(buildingId ? [] : (building.refillRequests ?? []) as RefillRequestItem[]);
  // live operations data of the building: refill requests + tab counts
  const [opsCounts, setOpsCounts] = useState<{ visits: number; service: number; coc: number } | null>(null);
  useEffect(() => {
    if (!buildingId) return;
    api<Paged<any>>('/refill-requests', { query: { buildingId, pageSize: 0 } })
      .then(r => setRefillRequests(r.items.map(mapLiveRefill)))
      .catch(() => setRefillRequests([]));
    const total = (path: string) => api<Paged<any>>(path, { query: { buildingId, pageSize: 1 } }).then(r => r.total).catch(() => 0);
    Promise.all([total('/maintenance-visits'), total('/service-requests'), total('/cd-certificates')])
      .then(([visits, service, coc]) => setOpsCounts({ visits, service, coc }));
  }, [buildingId, liveKey]);
  const [refillDrawerOpen, setRefillDrawerOpen] = useState(false);
  const [selectedRefill, setSelectedRefill] = useState<RefillRequestItem | null>(null);
  const [newRefillOpen, setNewRefillOpen] = useState(false);
  const occupancyRate = Math.round((building.occupied / building.totalUnits) * 100);

  const header = (
    <Card bordered={false}
      style={{ marginBottom: 12, background: `linear-gradient(135deg, ${PRIMARY} 0%, #2e7d32 100%)`, borderRadius: 12 }}
      bodyStyle={{ padding: '12px 20px' }}>
      <Row align="middle" gutter={[12, 8]}>
        <Col>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}
            style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff', borderRadius: 8 }}>
            رجوع
          </Button>
        </Col>
        <Col flex="auto">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Avatar size={40} icon={villaId ? <HomeOutlined /> : <BankOutlined />} style={{ background: 'rgba(255,255,255,0.2)', fontSize: 18, flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Title level={5} style={{ margin: 0, color: '#fff', fontSize: 17 }}>{hd.name}</Title>
                {hd.statusLabel && <Tag color={live?.status === 'inactive' ? 'default' : 'success'} style={{ borderRadius: 8, fontWeight: 600 }}>{hd.statusLabel}</Tag>}
                {hd.typeLabel && <Tag style={{ borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff' }}>{hd.typeLabel}</Tag>}
              </div>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                {[hd.nameEn, hd.no].filter(Boolean).join(' · ')}
                {(hd.city || hd.branch) && <> · <EnvironmentOutlined style={{ marginInlineEnd: 4 }} />{[hd.city, hd.branch].filter(Boolean).join('، ')}</>}
              </Text>
            </div>
          </div>
        </Col>
        <Col>
          <Space>
            {canManageBuilding && !villaId && <Tooltip title="تعديل بيانات المبنى"><Button icon={<EditOutlined />} onClick={() => setEditOpen(true)} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }} /></Tooltip>}
            {canManageBuilding && !villaId && (live?.status === 'inactive'
              ? <Tooltip title="تفعيل المبنى"><Button icon={<PlayCircleOutlined />} onClick={() => setBuildingStatus('active')} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#b7eb8f' }} /></Tooltip>
              : <Tooltip title="إيقاف المبنى (دون حذف)"><Button icon={<PauseCircleOutlined />} onClick={() => setBuildingStatus('inactive')} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#ffd591' }} /></Tooltip>)}
            {canManageBuilding && !villaId && <Tooltip title="حذف المبنى"><Button icon={<DeleteOutlined />} onClick={deleteBuilding} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#ffa39e' }} /></Tooltip>}
            {buildingId && <HistoryButton entityType="Building" id={buildingId} title={`${hd.no} — ${hd.name}`} size="middle" label={null} type="default" />}
            <Tooltip title="طباعة"><Button icon={<PrinterOutlined />} onClick={() => window.print()} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }} /></Tooltip>
            <Tooltip title="حفظ PDF (اختر «حفظ كملف PDF» في نافذة الطباعة)"><Button icon={<FilePdfOutlined />} onClick={() => { const t = document.title; document.title = `${hd.no} - ${hd.name}`; window.print(); setTimeout(() => { document.title = t; }, 500); }} style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'transparent', color: '#fff' }} /></Tooltip>
          </Space>
        </Col>
      </Row>
      <Row style={{ marginTop: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 16px' }}>
        {(villaId ? [
          { label: 'الخزانات', value: hd.tanks, icon: <DatabaseOutlined /> },
          { label: 'طلبات التعبئة', value: refillRequests.length, icon: <FireOutlined /> },
          { label: 'زيارات الصيانة', value: opsCounts?.visits ?? 0, icon: <CalendarOutlined /> },
          { label: 'طلبات الخدمة', value: opsCounts?.service ?? 0, icon: <ToolOutlined /> },
          { label: 'الطوابق', value: hd.floors, icon: <ApartmentOutlined /> },
          { label: 'الملاك', value: hd.owners, icon: <TeamOutlined /> },
        ] : [
          { label: 'الطوابق', value: hd.floors, icon: <ApartmentOutlined /> },
          { label: 'إجمالي الوحدات', value: hd.totalUnits, icon: <HomeOutlined /> },
          { label: 'مشغول', value: hd.occupied, icon: <CheckCircleOutlined /> },
          { label: 'شاغر', value: hd.vacant, icon: <ExclamationCircleOutlined /> },
          { label: 'الخزانات', value: hd.tanks, icon: <DatabaseOutlined /> },
          { label: 'الملاك', value: hd.owners, icon: <TeamOutlined /> },
        ]).map((k, i) => (
          <Col key={i} flex="1" style={{ textAlign: 'center', borderRight: i < 5 ? '1px solid rgba(255,255,255,0.15)' : undefined, padding: '2px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{k.icon} {k.label}</span>
            <span style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{k.value}</span>
          </Col>
        ))}
      </Row>
    </Card>
  );

  const overviewTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={9}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
              title={<Text strong><HomeOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />نسبة الإشغال</Text>}>
              <ReactApexChart type="donut" height={170} options={unitPieOptions} series={[22, 2, 0, 0]} />
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <Text style={{ fontSize: 22, fontWeight: 700, color: PRIMARY }}>{occupancyRate}%</Text><br />
                <Text type="secondary" style={{ fontSize: 12 }}>نسبة الإشغال الكلية</Text>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={15}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
              title={<Text strong><FireOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />استهلاك الغاز (آخر 6 أشهر)</Text>}>
              <ReactApexChart type="area" height={210} options={consumptionOptions} series={consumptionSeries} />
            </Card>
          </Col>
        </Row>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><ApartmentOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />الوحدات ({building.totalUnits})</Text>}
          extra={<Button size="small" type="primary" ghost icon={<PlusOutlined />} onClick={() => setAddUnitOpen(true)}>إضافة وحدة</Button>}>
          <Table size="small" dataSource={building.units} pagination={{ pageSize: 6, size: 'small' }} rowKey="key"
            columns={[
              { title: 'رقم الوحدة', dataIndex: 'no', width: 90, render: (v: string) => <Text strong style={{ color: PRIMARY }}>{v}</Text> },
              { title: 'الطابق', dataIndex: 'floor', width: 70, align: 'center' as const },
              { title: 'النوع', dataIndex: 'typeLabel', width: 90 },
              { title: 'المساحة م²', dataIndex: 'area', width: 90, render: (v: number) => `${v} م²` },
              { title: 'الحالة', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={unitStatusMap[v]?.color}>{unitStatusMap[v]?.label}</Tag> },
              { title: 'المستأجر', dataIndex: 'tenant', render: (v: string | null) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 12 }}>—</Text> },
              { title: 'العداد', dataIndex: 'meter', width: 80, render: (v: string) => <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag> },
              { title: 'العقد', dataIndex: 'contract', width: 120, render: (v: string | null) => v ? <a style={{ fontSize: 12 }}>{v}</a> : <Text type="secondary" style={{ fontSize: 12 }}>—</Text> },
            ]} />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { label: 'إيرادات الشهر', value: '48,500', unit: 'د.إ', color: PRIMARY, icon: <DollarOutlined /> },
            { label: 'طلبات خدمة مفتوحة', value: '1', unit: 'طلب', color: '#fa8c16', icon: <ToolOutlined /> },
          ].map((s, i) => (
            <Col span={12} key={i}>
              <Card size="small" bordered={false} style={{ borderRadius: 10, textAlign: 'center', background: '#fafafa' }}>
                <div style={{ color: s.color, fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{s.unit}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
              </Card>
            </Col>
          ))}
        </Row>
        <Card size="small" bordered={false} style={{ borderRadius: 10, marginBottom: 16 }}
          title={<Text strong><BarChartOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />تفاصيل الإشغال</Text>}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12 }}>مشغولة</Text>
              <Text strong style={{ fontSize: 12, color: PRIMARY }}>{building.occupied} / {building.totalUnits}</Text>
            </div>
            <Progress percent={occupancyRate} strokeColor={PRIMARY} trailColor="#f0f0f0" size="small" />
          </div>
          {[{ label: 'شقة', count: 22, pct: 92, color: '#52c41a' }, { label: 'بنتهاوس', count: 2, pct: 50, color: '#1677ff' }].map((t, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontSize: 11, color: '#666' }}>{t.label}</Text>
                <Text style={{ fontSize: 11 }}>{t.count} وحدة</Text>
              </div>
              <Progress percent={t.pct} size="small" strokeColor={t.color} showInfo={false} />
            </div>
          ))}
        </Card>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><BellOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />آخر النشاطات</Text>}>
          <Timeline style={{ marginTop: 8 }} items={building.activity.slice(0, 5).map(a => ({
            color: a.type === 'warning' ? 'orange' : a.type === 'success' ? 'green' : 'blue',
            children: (<div><Text style={{ fontSize: 12 }}>{a.action}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{a.date}</Text></div>),
          }))} />
        </Card>
      </Col>
    </Row>
  );

  // معلومات المبنى: live building (GET /buildings/{id}) when opened from the list, otherwise the sample
  const lv: any = live;
  const info = lv ? {
    no: lv.code, name: lv.nameAr ?? lv.name ?? '—', nameEn: lv.nameEn ?? '—', branch: lv.branch ?? '—', typeLabel: lv.typeLabel ?? '—',
    floors: lv.totalFloors ?? '—', totalUnits: lv.stats?.units ?? 0, statusLabel: lv.statusLabel ?? (lv.isActive ? 'نشط' : 'غير نشط'),
    statusColor: lv.status === 'active' || (lv.isActive && !lv.status) ? 'success' : 'default',
    createdAt: lv.createdAt ? String(lv.createdAt).slice(0, 10) : '—', lastUpdated: lv.updatedAt ? String(lv.updatedAt).slice(0, 10) : '—',
    emirate: lv.emirate ?? '—', city: lv.city ?? '—', zone: lv.zone ?? '—', street: lv.street ?? '—', poBox: lv.poBox ?? '—',
    fullAddress: lv.address || [lv.street, lv.zone, lv.city, lv.emirate].filter(Boolean).join('، ') || '—',
    lat: lv.latitude as number | null, lng: lv.longitude as number | null,
  } : {
    no: building.no, name: building.name, nameEn: building.nameEn, branch: building.branch, typeLabel: building.typeLabel,
    floors: building.floors, totalUnits: building.totalUnits, statusLabel: building.statusLabel, statusColor: 'success',
    createdAt: building.createdAt, lastUpdated: building.lastUpdated,
    emirate: building.address.emirate, city: building.address.city, zone: building.address.zone, street: building.address.street, poBox: building.address.poBox,
    fullAddress: building.address.fullAddress, lat: null as number | null, lng: null as number | null,
  };
  const coords = info.lat != null && info.lng != null ? `${Number(info.lat).toFixed(4)}° N, ${Number(info.lng).toFixed(4)}° E` : (lv ? '—' : building.address.coordinates);
  const infoTab = (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card size="small" bordered={false} style={{ borderRadius: 10, height: '100%' }}
          title={<Text strong><BankOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />معلومات المبنى الأساسية</Text>}>
          <Descriptions column={1} size="small" bordered labelStyle={{ background: '#fafafa', width: 155, fontSize: 13 }} contentStyle={{ fontSize: 13 }}>
            <Descriptions.Item label="رقم المبنى">{info.no}</Descriptions.Item>
            <Descriptions.Item label="اسم المبنى (عربي)">{info.name}</Descriptions.Item>
            <Descriptions.Item label="اسم المبنى (إنجليزي)">{info.nameEn}</Descriptions.Item>
            <Descriptions.Item label="الفرع">{info.branch}</Descriptions.Item>
            <Descriptions.Item label="النوع">{info.typeLabel}</Descriptions.Item>
            <Descriptions.Item label="عدد الطوابق">{info.floors}</Descriptions.Item>
            <Descriptions.Item label="إجمالي الوحدات">{info.totalUnits}</Descriptions.Item>
            <Descriptions.Item label="الحالة"><Tag color={info.statusColor}>{info.statusLabel}</Tag></Descriptions.Item>
            <Descriptions.Item label="تاريخ الإضافة">{info.createdAt}</Descriptions.Item>
            <Descriptions.Item label="آخر تحديث">{info.lastUpdated}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}
          title={<Text strong><EnvironmentOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />العنوان والموقع</Text>}>
          <Descriptions column={1} size="small" bordered labelStyle={{ background: '#fafafa', width: 155, fontSize: 13 }} contentStyle={{ fontSize: 13 }}>
            <Descriptions.Item label="الإمارة">{info.emirate}</Descriptions.Item>
            <Descriptions.Item label="المدينة / المنطقة">{info.city}</Descriptions.Item>
            <Descriptions.Item label="الحي / المنطقة">{info.zone}</Descriptions.Item>
            <Descriptions.Item label="الشارع">{info.street}</Descriptions.Item>
            <Descriptions.Item label="صندوق البريد">{info.poBox}</Descriptions.Item>
            <Descriptions.Item label="العنوان الكامل"><Paragraph style={{ margin: 0, fontSize: 13 }}>{info.fullAddress}</Paragraph></Descriptions.Item>
            <Descriptions.Item label="الإحداثيات"><Text style={{ fontFamily: 'monospace', fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{coords}</Text></Descriptions.Item>
          </Descriptions>
          {info.lat != null && info.lng != null ? (
            <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #eee' }}>
              <iframe title="map" width="100%" height="220" style={{ border: 0, display: 'block' }} loading="lazy"
                src={`https://maps.google.com/maps?q=${info.lat},${info.lng}&z=16&output=embed`} />
            </div>
          ) : (
            <div style={{ marginTop: 12, borderRadius: 8, background: '#f5f5f5', height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #eee' }}>
              <div style={{ textAlign: 'center', color: '#bbb' }}>
                <GlobalOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <div style={{ fontSize: 12 }}>خريطة الموقع<br /><Text type="secondary" style={{ fontSize: 11 }}>{lv ? 'أضف الإحداثيات من «تعديل المبنى» لعرض الخريطة' : 'سيتم دمج Google Maps'}</Text></div>
              </div>
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );

  const ownersTab = (
    <Row gutter={[16, 16]}>
      {building.owners.map((owner, idx) => (
        <Col xs={24} lg={12} key={idx}>
          <Card size="small" bordered={false}
            style={{ borderRadius: 10, border: owner.isPrimary ? '2px solid #faad14' : '1px solid #f0f0f0', height: '100%' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={owner.ownerType === 'company' ? <BuildOutlined /> : <UserOutlined />}
                  style={{ background: owner.isPrimary ? '#faad14' : PRIMARY, flexShrink: 0 }} />
                <div>
                  <Text strong style={{ fontSize: 13 }}>{owner.name}</Text>
                  {owner.isPrimary && <Tag icon={<StarFilled />} color="gold" style={{ marginInlineStart: 8, borderRadius: 8, fontSize: 11 }}>المالك المسؤول</Tag>}
                  <br /><Text type="secondary" style={{ fontSize: 12 }}>{owner.ownerType === 'company' ? 'شركة' : 'فرد'}</Text>
                </div>
              </div>
            }>
            {owner.ownerType === 'individual' && (
              <Descriptions column={1} size="small" labelStyle={{ width: 130, fontSize: 12, color: '#666' }} contentStyle={{ fontSize: 12 }}>
                <Descriptions.Item label="الاسم (إنجليزي)">{(owner as any).nameEn}</Descriptions.Item>
                <Descriptions.Item label="الهوية الإماراتية"><Text style={{ fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>{(owner as any).emiratesId}</Text></Descriptions.Item>
                <Descriptions.Item label="الجنسية">{(owner as any).nationality}</Descriptions.Item>
              </Descriptions>
            )}
            {owner.ownerType === 'company' && (
              <Descriptions column={1} size="small" labelStyle={{ width: 130, fontSize: 12, color: '#666' }} contentStyle={{ fontSize: 12 }}>
                <Descriptions.Item label="الاسم (إنجليزي)">{(owner as any).nameEn}</Descriptions.Item>
                <Descriptions.Item label="رقم الرخصة">{(owner as any).tradeLicenseNo}</Descriptions.Item>
                <Descriptions.Item label="الإمارة">{(owner as any).emirate}</Descriptions.Item>
                <Descriptions.Item label="العنوان">{(owner as any).address}</Descriptions.Item>
              </Descriptions>
            )}
            <Divider style={{ margin: '10px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {owner.phones.map((ph, pi) => (
                <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined style={{ color: PRIMARY, fontSize: 12 }} />
                  <Text style={{ fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{ph}</Text>
                  {owner.isPrimary && ph === (owner as any).defaultPhone && <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>افتراضي</Tag>}
                </div>
              ))}
              {owner.emails.map((em, ei) => (
                <div key={ei} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MailOutlined style={{ color: PRIMARY, fontSize: 12 }} />
                  <Text style={{ fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{em}</Text>
                  {owner.isPrimary && em === (owner as any).defaultEmail && <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>افتراضي</Tag>}
                </div>
              ))}
            </div>
            <Divider style={{ margin: '10px 0' }} />
            <div style={{ background: '#fafafa', borderRadius: 8, padding: '8px 12px' }}>
              <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>الحساب البنكي</Text>
              <Text style={{ fontSize: 12 }}>{owner.bankName}</Text><br />
              <Text style={{ fontSize: 12, fontFamily: 'monospace', direction: 'ltr', display: 'inline-block', color: '#555' }}>{owner.iban}</Text>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const tanksTab = (
    <Row gutter={[16, 16]}>
      {building.tanks.map((tank: any, idx: number) => {
        const pct = Math.round((tank.currentLevel / tank.capacity) * 100);
        const levelColor = pct >= 60 ? '#52c41a' : pct >= 30 ? '#fa8c16' : '#ff4d4f';
        const levelLabel = pct >= 60 ? 'مستوى جيد' : pct >= 30 ? 'مستوى منخفض' : 'يحتاج تعبئة';
        return (
          <Col xs={24} md={12} xl={8} key={idx}>
            <Card size="small" bordered={false}
              style={{ borderRadius: 12, border: tank.status === 'inspection_due' ? '2px solid #fa8c16' : '1px solid #f0f0f0', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar icon={<DatabaseOutlined />} style={{ background: PRIMARY }} />
                  <div><Text strong>{tank.no}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{tank.typeLabel}</Text></div>
                </div>
                {tank.status === 'inspection_due'
                  ? <Tag icon={<WarningOutlined />} color="warning">يستوجب فحصاً</Tag>
                  : <Tag icon={<CheckCircleOutlined />} color="success">جيد</Tag>}
              </div>

              {/* Tank Level Visual */}
              <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12, color: '#666' }}>مستوى الخزان</Text>
                  <Tag color={pct >= 60 ? 'success' : pct >= 30 ? 'warning' : 'error'} style={{ margin: 0 }}>{levelLabel}</Tag>
                </div>
                {/* Vertical tank gauge */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
                  {/* Gauge cylinder */}
                  <div style={{ position: 'relative', width: 44, height: 100, flexShrink: 0 }}>
                    {/* Tank shell */}
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '8px 8px 6px 6px',
                      border: `2px solid ${levelColor}`, background: '#fff', overflow: 'hidden',
                    }}>
                      {/* Fill level */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        height: `${pct}%`,
                        background: `linear-gradient(180deg, ${levelColor}88 0%, ${levelColor} 100%)`,
                        transition: 'height 0.6s ease',
                      }} />
                      {/* Wave effect at top of fill */}
                      <div style={{
                        position: 'absolute', bottom: `${pct}%`, left: 0, right: 0, height: 4,
                        background: `${levelColor}cc`,
                        borderRadius: '50% 50% 0 0 / 3px 3px 0 0',
                      }} />
                      {/* Percentage label inside */}
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 2,
                      }}>
                        <Text strong style={{ fontSize: 13, color: pct > 45 ? '#fff' : levelColor }}>{pct}%</Text>
                      </div>
                    </div>
                    {/* Cap on top */}
                    <div style={{
                      position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
                      width: 20, height: 6, borderRadius: '4px 4px 0 0',
                      background: levelColor, border: `2px solid ${levelColor}`,
                    }} />
                  </div>
                  {/* Level info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>المستوى الحالي</Text>
                      <div style={{ fontSize: 18, fontWeight: 700, color: levelColor, lineHeight: 1.2 }}>
                        {tank.currentLevel.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 400 }}>{tank.unit}</span>
                      </div>
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary" style={{ fontSize: 11 }}>السعة الكاملة</Text>
                      <div style={{ fontSize: 13, color: '#444' }}>{tank.capacity.toLocaleString()} {tank.unit}</div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>آخر تعبئة</Text>
                      <div style={{ fontSize: 12, color: '#666' }}>{tank.lastFilled}</div>
                    </div>
                  </div>
                </div>
                {/* Progress bar below */}
                <Progress percent={pct} strokeColor={levelColor} trailColor="#e8e8e8" showInfo={false} size="small" style={{ marginTop: 10 }} />
              </div>

              {/* Details */}
              <Descriptions column={1} size="small" labelStyle={{ width: 120, fontSize: 12, color: '#666' }} contentStyle={{ fontSize: 12 }}>
                <Descriptions.Item label="الرقم التسلسلي"><Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{tank.serial}</Text></Descriptions.Item>
                <Descriptions.Item label="المصنّع">{tank.manufacturer}</Descriptions.Item>
                <Descriptions.Item label="تاريخ التركيب">{tank.installDate}</Descriptions.Item>
                <Descriptions.Item label="آخر فحص">{tank.lastInspection}</Descriptions.Item>
                <Descriptions.Item label="الفحص القادم">
                  <Text style={{ color: tank.status === 'inspection_due' ? '#fa8c16' : undefined, fontWeight: tank.status === 'inspection_due' ? 600 : undefined }}>{tank.nextInspection}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        );
      })}
      <Col xs={24}><Button type="dashed" block icon={<PlusOutlined />}>إضافة خزان جديد</Button></Col>
    </Row>
  );

  // ── Financials Tab — two sections: AMC invoices + Gas Supply invoices ─
  const amcInvoices = building.invoices.filter((inv: any) => inv.type === 'amc');
  const amcTotal   = amcInvoices.reduce((s: number, i: any) => s + i.amount, 0);

  // Supply invoices derived from supplyContracts
  const supplyInvoices = building.supplyContracts.map((c: any, idx: number) => ({
    id: `SINV-${String(idx + 1).padStart(3, '0')}`,
    contractNo: c.contractNo,
    tenant: c.tenant,
    unit: c.unit,
    meter: c.meter,
    period: c.lastReadDate ? c.lastReadDate.substring(0, 7) : '—',
    monthlyFee: c.monthlyFee,
    gasAmount: Math.round(c.balanceM3 * c.gasUnitPrice),
    overdueAmount: c.overdueAmount,
    totalDue: c.monthlyFee + Math.round(c.balanceM3 * c.gasUnitPrice) + c.overdueAmount,
    paymentStatus: c.paymentStatus,
    status: c.status,
  }));

  const financialsTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Section 1: AMC Gas Contract Invoices ───────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 4, height: 22, background: PRIMARY, borderRadius: 2 }} />
          <Text strong style={{ fontSize: 15 }}>
            <ToolOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />فواتير عقد صيانة الغاز (AMC)
          </Text>
          <Tag color="green" style={{ marginInlineStart: 4 }}>عقد المبنى</Tag>
        </div>
        <Row gutter={[12, 12]}>
          {[
            { label: 'إجمالي فواتير الصيانة', value: amcTotal, color: PRIMARY, bg: '#e8f5e9', icon: <ToolOutlined /> },
            { label: 'فواتير معلقة', value: amcInvoices.filter((i: any) => i.status === 'pending').length + ' فاتورة', color: '#fa8c16', bg: '#fff7e6', icon: <ExclamationCircleOutlined />, raw: true },
            { label: 'آخر دفعة', value: amcInvoices.find((i: any) => i.status === 'paid')?.date || '—', color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined />, raw: true },
          ].map((s: any, i) => (
            <Col xs={24} sm={8} key={i}>
              <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 20, color: s.color }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>
                      {s.raw ? s.value : `${s.value.toLocaleString()} د.إ`}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        <Card size="small" bordered={false} style={{ borderRadius: 10, marginTop: 12 }}>
          <Table size="small" dataSource={amcInvoices} rowKey="id" pagination={false}
            locale={{ emptyText: 'لا توجد فواتير صيانة' }}
            columns={[
              { title: 'رقم الفاتورة', dataIndex: 'id', render: (v: string) => <a style={{ fontSize: 12, color: PRIMARY }}>{v}</a> },
              { title: 'التاريخ', dataIndex: 'date', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
              { title: 'المبلغ', dataIndex: 'amount', render: (v: number) => <Text strong style={{ fontSize: 12, color: PRIMARY }}>{v.toLocaleString()} د.إ</Text> },
              { title: 'الحالة', dataIndex: 'status', render: (v: string) => <Tag color={invoiceStatusMap[v]?.color} style={{ fontSize: 11 }}>{invoiceStatusMap[v]?.label}</Tag> },
              { title: '', render: () => <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }}>عرض</Button> },
            ]} />
        </Card>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* ── Section 2: Gas Supply Tenant Invoices ───────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 4, height: 22, background: '#fa8c16', borderRadius: 2 }} />
          <Text strong style={{ fontSize: 15 }}>
            <FireOutlined style={{ marginInlineEnd: 6, color: '#fa8c16' }} />فواتير توريد الغاز الشهرية (المستأجرون)
          </Text>
          <Tag color="orange" style={{ marginInlineStart: 4 }}>لكل مستأجر</Tag>
        </div>
        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
          {[
            { label: 'إجمالي المستحقات', value: supplyInvoices.reduce((s: number, i: any) => s + i.totalDue, 0), color: '#fa8c16', bg: '#fff7e6', icon: <DollarOutlined />, aed: true },
            { label: 'مدفوعة', value: supplyInvoices.filter((i: any) => i.paymentStatus === 'paid').length, suffix: ' عقد', color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
            { label: 'متأخرة', value: supplyInvoices.filter((i: any) => i.paymentStatus === 'overdue').length, suffix: ' عقد', color: '#ff4d4f', bg: '#fff1f0', icon: <ExclamationCircleOutlined /> },
            { label: 'إجمالي المتأخرات', value: supplyInvoices.reduce((s: number, i: any) => s + i.overdueAmount, 0), color: '#ff4d4f', bg: '#fff1f0', icon: <ExclamationCircleOutlined />, aed: true },
          ].map((s: any, i) => (
            <Col xs={12} sm={6} key={i}>
              <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 18, color: s.color }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>
                      {s.aed ? `${s.value.toLocaleString()} د.إ` : `${s.value}${s.suffix || ''}`}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        <Card size="small" bordered={false} style={{ borderRadius: 10 }}>
          <Table size="small" dataSource={supplyInvoices} rowKey="id" pagination={{ pageSize: 8, size: 'small' }}
            scroll={{ x: 700 }}
            columns={[
              { title: 'المستأجر', dataIndex: 'tenant', fixed: 'right' as const, width: 150, render: (v: string, r: any) => (
                <div>
                  <Text strong style={{ fontSize: 12 }}>{v}</Text>
                  <div style={{ fontSize: 11, color: '#888' }}>وحدة {r.unit} · {r.meter}</div>
                </div>
              )},
              { title: 'الفترة', dataIndex: 'period', width: 90, render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
              { title: 'الرسوم الشهرية', dataIndex: 'monthlyFee', width: 110, render: (v: number) => <Text style={{ fontSize: 12 }}>{v} د.إ</Text> },
              { title: 'استهلاك الغاز', dataIndex: 'gasAmount', width: 110, render: (v: number, r: any) => (
                <div>
                  <Text style={{ fontSize: 12 }}>{v} د.إ</Text>
                  <div style={{ fontSize: 11, color: '#888' }}>{r.meter && `${(v / 3.5).toFixed(0)} م³`}</div>
                </div>
              )},
              { title: 'متأخرات', dataIndex: 'overdueAmount', width: 100, render: (v: number) => (
                <Text style={{ fontSize: 12, color: v > 0 ? '#ff4d4f' : '#52c41a', fontWeight: v > 0 ? 600 : 400 }}>
                  {v > 0 ? `${v} د.إ` : '—'}
                </Text>
              )},
              { title: 'الإجمالي', dataIndex: 'totalDue', width: 110, render: (v: number) => (
                <Text strong style={{ fontSize: 12, color: '#fa8c16' }}>{v.toLocaleString()} د.إ</Text>
              )},
              { title: 'الحالة', dataIndex: 'paymentStatus', width: 90, render: (v: string) => (
                <Tag color={paymentStatusMap[v]?.color} style={{ fontSize: 11 }}>{paymentStatusMap[v]?.label || v}</Tag>
              )},
              { title: 'حالة العقد', dataIndex: 'status', width: 90, render: (v: string) => (
                <Tag color={v === 'active' ? 'success' : 'default'} style={{ fontSize: 11 }}>{v === 'active' ? 'نشط' : 'منتهي'}</Tag>
              )},
              { title: '', width: 60, render: () => <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }}>عرض</Button> },
            ]} />
        </Card>
      </div>
    </div>
  );

  const serviceTab = (
    <Row gutter={[16, 16]}>
      {building.serviceRequests.map((sr, idx) => (
        <Col xs={24} key={idx}>
          <Card size="small" bordered={false}
            style={{ borderRadius: 10, border: sr.status === 'in_progress' ? '2px solid #fa8c16' : '1px solid #f0f0f0' }}>
            <Row align="middle" gutter={[12, 8]}>
              <Col flex="auto">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 13 }}>{sr.id}</Text>
                  <Tag color={srStatusMap[sr.status]?.color}>{srStatusMap[sr.status]?.label}</Tag>
                  <Tag color={srPriorityMap[sr.priority]?.color}>{srPriorityMap[sr.priority]?.label}</Tag>
                </div>
                <Text style={{ fontSize: 13 }}>{sr.description}</Text>
                <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}><CalendarOutlined style={{ marginInlineEnd: 4 }} />{sr.date}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}><TeamOutlined style={{ marginInlineEnd: 4 }} />{sr.assignee}</Text>
                </div>
              </Col>
              <Col><Button size="small" type="link">عرض التفاصيل</Button></Col>
            </Row>
          </Card>
        </Col>
      ))}
      <Col xs={24}><Button type="dashed" block icon={<PlusOutlined />}>طلب خدمة جديد</Button></Col>
    </Row>
  );

  const docsTab = (
    <Card bordered={false} style={{ borderRadius: 10 }}>
      <List dataSource={building.documents} renderItem={(doc) => (
        <List.Item actions={[
          <Button size="small" type="link" key="v">عرض</Button>,
          <Button size="small" type="link" key="d">تحميل</Button>,
        ]}>
          <List.Item.Meta
            avatar={<Avatar icon={docTypeIcon[doc.type]} style={{ background: '#f0f0f0' }} />}
            title={<Text style={{ fontSize: 13 }}>{doc.name}</Text>}
            description={<Text type="secondary" style={{ fontSize: 11 }}>{doc.date} · {doc.size}</Text>}
          />
        </List.Item>
      )} />
      <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 12 }}>رفع وثيقة جديدة</Button>
    </Card>
  );

  // ── Gas Contracts Tab ─────────────────────────────────────────────
  const cStatusMap: Record<string, { color: string; label: string }> = {
    active:  { color: 'success', label: 'نشط'   },
    expired: { color: 'error',   label: 'منتهي'  },
    pending: { color: 'warning', label: 'قيد الاعتماد' },
  };
  const payStatusMap: Record<string, { color: string; label: string }> = {
    paid:    { color: 'success', label: 'مسدد'  },
    overdue: { color: 'error',   label: 'متأخر'  },
    pending: { color: 'warning', label: 'معلق'  },
  };
  const [contractTab, setContractTab] = React.useState<'amc'|'supply'>('amc');

  const contractsTab = (
    <div>
      {/* Top switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div
          onClick={() => setContractTab('amc')}
          style={{
            flex: 1, padding: '14px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
            border: contractTab === 'amc' ? `2px solid ${PRIMARY}` : '2px solid #e0e0e0',
            background: contractTab === 'amc' ? '#e8f5e9' : '#fafafa',
            transition: 'all 0.2s',
          }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}><ToolOutlined style={{ color: contractTab === 'amc' ? PRIMARY : '#bbb' }} /></div>
          <Text strong style={{ color: contractTab === 'amc' ? PRIMARY : '#666', display: 'block' }}>عقد الصيانة السنوي</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>AMC Gas Contract — صيانة مواسير الغاز وفحص السلامة</Text>
          <div style={{ marginTop: 8 }}>
            {amcList.filter((c: any) => c.status === 'active').length > 0
              ? <Tag color="success">نشط</Tag> : <Tag color="error">منتهي</Tag>}
            <Tag color="default">{amcList.length} عقود</Tag>
          </div>
        </div>
        <div
          onClick={() => setContractTab('supply')}
          style={{
            flex: 1, padding: '14px 20px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
            border: contractTab === 'supply' ? '2px solid #fa8c16' : '2px solid #e0e0e0',
            background: contractTab === 'supply' ? '#fff7e6' : '#fafafa',
            transition: 'all 0.2s',
          }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}><FireOutlined style={{ color: contractTab === 'supply' ? '#fa8c16' : '#bbb' }} /></div>
          <Text strong style={{ color: contractTab === 'supply' ? '#fa8c16' : '#666', display: 'block' }}>عقود توريد الغاز</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{villaId ? 'Gas Supply Contract — سعر اللتر وفاتورة لكل تعبئة' : 'Gas Supply Contract — رسوم شهرية ومتابعة العدادات'}</Text>
          <div style={{ marginTop: 8 }}>
            <Tag color="success">{supplyList.filter((c: any) => c.status === 'active').length} نشط</Tag>
            <Tag color="error">{supplyList.filter((c: any) => c.status === 'expired' || (villaId && c.status === 'terminated')).length} منتهي</Tag>
          </div>
        </div>
      </div>

      {/* ═══════════ AMC SECTION ═══════════ */}
      {contractTab === 'amc' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong style={{ fontSize: 14 }}>
              <ToolOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />سجل عقود الصيانة السنوية
            </Text>
            <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setAmcModalOpen(true)}>عقد AMC جديد</Button>
          </div>

          {buildingId && liveAmc !== null && amcList.length === 0 && (
            <Empty style={{ padding: '24px 0' }} description="لا توجد عقود صيانة سنوية لهذا المبنى — أنشئ عقداً جديداً" />
          )}
          {(buildingId ? amcList : [...amcList].reverse()).map((c: any) => {
            const isExpired = c.status === 'expired';
            const daysLeft = c.endDate ? Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000) : null;
            const expiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 60;
            const visitPct = c.visitsTotal ? Math.round((c.visitsDone / c.visitsTotal) * 100) : 0;
            return (
              <Card key={c.id} bordered={false} style={{
                borderRadius: 12, marginBottom: 16,
                border: isExpired ? '2px solid #ff4d4f' : expiringSoon ? '2px solid #fa8c16' : `2px solid ${PRIMARY}33`,
                background: isExpired ? '#fff8f8' : '#f6ffed',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>{c.vendor}</Text>
                    <div style={{ fontSize: 12, color: '#888' }}>رقم العقد: <Text style={{ fontFamily: 'monospace' }}>{c.contractNo}</Text></div>
                    <div style={{ fontSize: 12, color: '#888' }}>الفترة: {c.startDate} — {c.endDate}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Tag color={cStatusMap[c.status]?.color} style={{ fontWeight: 600 }}>{cStatusMap[c.status]?.label}</Tag>
                    {expiringSoon && <Tag color="warning" icon={<ExclamationCircleOutlined />}>ينتهي خلال {daysLeft} يوم</Tag>}
                    {isExpired && <Tag color="error" icon={<WarningOutlined />}>منتهي</Tag>}
                    <Tag color="blue">{c.annualValue.toLocaleString()} د.إ / سنة</Tag>
                  </div>
                </div>

                <Row gutter={[16, 12]}>
                  {/* Scope */}
                  <Col xs={24} md={10}>
                    <Text strong style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 8 }}>
                      <SafetyCertificateOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />نطاق الصيانة
                    </Text>
                    {c.scope.map((s: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11, flexShrink: 0 }} />
                        <Text style={{ fontSize: 12 }}>{s}</Text>
                      </div>
                    ))}
                    {c.notes && (
                      <div style={{ marginTop: 8, padding: '5px 8px', background: '#fff', borderRadius: 6, border: '1px dashed #d9d9d9' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>{c.notes}</Text>
                      </div>
                    )}
                  </Col>

                  {/* Visits + Last report */}
                  <Col xs={24} md={8}>
                    <Text strong style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 8 }}>
                      <CalendarOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />الزيارات ({c.visitFrequency})
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>{c.visitsDone} من {c.visitsTotal} زيارة</Text>
                      <Text strong style={{ fontSize: 12, color: visitPct === 100 ? '#52c41a' : PRIMARY }}>{visitPct}%</Text>
                    </div>
                    <Progress percent={visitPct} strokeColor={visitPct === 100 ? '#52c41a' : PRIMARY} showInfo={false} size="small" style={{ marginBottom: 10 }} />
                    {c.lastVisit && (
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888' }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="آخر زيارة">{c.lastVisit}</Descriptions.Item>
                        {c.nextVisit && <Descriptions.Item label="الزيارة القادمة">{c.nextVisit}</Descriptions.Item>}
                        <Descriptions.Item label="تقرير آخر زيارة">{c.lastVisitReport}</Descriptions.Item>
                      </Descriptions>
                    )}
                  </Col>

                  {/* CTA */}
                  <Col xs={24} md={6}>
                    <Card size="small" bordered={false} style={{ borderRadius: 8, background: '#fff', height: '100%' }}>
                      <Text strong style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>
                        <UserOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />العميل (المالك)
                      </Text>
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888' }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="الاسم">{c.ownerName || building.owners?.[0]?.name || '—'}</Descriptions.Item>
                        <Descriptions.Item label="الهاتف">{c.ownerPhone || building.owners?.[0]?.defaultPhone || '—'}</Descriptions.Item>
                        <Descriptions.Item label="البريد">{c.ownerEmail || '—'}</Descriptions.Item>
                      </Descriptions>
                      {(c.vendorContact || c.vendorEmail) && (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                          مقدم الخدمة: {c.vendor}{c.vendorContact ? ` · ${c.vendorContact}` : ''}{c.vendorEmail ? ` · ${c.vendorEmail}` : ''}
                        </div>
                      )}
                      <Button size="small" block icon={<PrinterOutlined />} style={{ borderRadius: 6, fontSize: 11, marginTop: 8 }}
                        onClick={() => printAmcContract(openPrintWindow(), Number(c.id))}>طباعة العقد</Button>
                      <Divider style={{ margin: '8px 0' }} />
                      {isExpired ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginInlineEnd: 4 }} />انتهى العقد — اختر:
                          </Text>
                          <Button type="primary" icon={<PlusOutlined />} size="small" block style={{ borderRadius: 6, fontSize: 11 }} onClick={() => setAmcModalOpen(true)}>إنشاء عقد جديد</Button>
                          <Button icon={<EditOutlined />} size="small" block style={{ borderRadius: 6, fontSize: 11, borderColor: PRIMARY, color: PRIMARY }} onClick={() => openRenew('amc', c)}>تجديد العقد</Button>
                        </div>
                      ) : expiringSoon ? (
                        <Button icon={<BellOutlined />} size="small" block style={{ borderRadius: 6, fontSize: 11, borderColor: '#fa8c16', color: '#fa8c16' }} onClick={() => openRenew('amc', c)}>تجديد مبكر</Button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <Button size="small" block style={{ borderRadius: 6, fontSize: 11 }} disabled={!buildingId} onClick={() => setVisitFor(c)}>تسجيل زيارة</Button>
                          <Button size="small" block style={{ borderRadius: 6, fontSize: 11 }} disabled={!buildingId} onClick={() => setReportFor(c)}>رفع تقرير</Button>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
                {buildingId && (
                  <div style={{ marginTop: 14, background: '#fff', borderRadius: 10, padding: 12, border: '1px solid #f0f0f0' }}>
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                      <FileTextOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />فواتير العقد والأقساط
                    </Text>
                    <AmcInvoicesPanel contractId={c.id} schedule={c.paymentSchedule ?? []} onChanged={() => setLiveKey(k => k + 1)} />
                  </div>
                )}
              </Card>
            );
          })}
          <RecordVisitModal open={!!visitFor} contract={visitFor} onClose={() => setVisitFor(null)} onDone={() => setLiveKey(k => k + 1)} />
          <UploadReportModal open={!!reportFor} contract={reportFor} onClose={() => setReportFor(null)} onDone={() => setLiveKey(k => k + 1)} />
        </div>
      )}

      {/* ═══════════ SUPPLY CONTRACTS SECTION ═══════════ */}
      {contractTab === 'supply' && villaId && (
        <VillaGasContracts villaId={villaId} reloadKey={liveKey} onChanged={() => setLiveKey(k => k + 1)} />
      )}
      {contractTab === 'supply' && !villaId && (
        <div>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'إجمالي العقود', value: supplyList.length, color: '#fa8c16', bg: '#fff7e6' },
              { label: 'نشطة', value: supplyList.filter((c: any) => c.status === 'active').length, color: '#52c41a', bg: '#f6ffed' },
              { label: 'منتهية', value: supplyList.filter((c: any) => c.status === 'expired').length, color: '#ff4d4f', bg: '#fff1f0' },
              { label: 'متأخرة', value: supplyList.filter((c: any) => c.paymentStatus === 'overdue').length, color: '#ff4d4f', bg: '#fff1f0' },
              { label: 'إجمالي الودائع', value: `${supplyList.reduce((s: number, c: any) => s + (c.depositPaid ? c.depositAmount : 0), 0).toLocaleString()} د.إ`, color: '#1677ff', bg: '#e6f4ff' },
              { label: 'الرصيد الكلي', value: `${supplyList.reduce((s: number, c: any) => s + c.balanceAmount, 0).toLocaleString()} د.إ`, color: PRIMARY, bg: '#e8f5e9' },
            ].map((s, i) => (
              <Card key={i} size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, minWidth: 100, textAlign: 'center', flex: '1 1 90px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
              </Card>
            ))}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8, background: '#fa8c16', borderColor: '#fa8c16' }} onClick={newSupplyContract}>عقد توريد جديد</Button>
            </div>
          </div>

          {/* Table of supply contracts */}
          <Table
            size="small"
            dataSource={supplyList}
            rowKey="id"
            pagination={{ pageSize: 10, size: 'small' }}
            expandable={{
              expandedRowRender: (c: any) => (
                <div style={{ padding: '12px 16px', background: '#fffbe6', borderRadius: 8 }}>
                  <Row gutter={[24, 8]}>
                    <Col xs={24} sm={12} md={6}>
                      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6, color: '#fa8c16' }}>الرسوم والأسعار</Text>
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888', width: 130 }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="الرسوم الشهرية">{c.monthlyFee} {c.currency}</Descriptions.Item>
                        <Descriptions.Item label="سعر م³ الغاز">{c.gasUnitPrice} {c.currency}</Descriptions.Item>
                        <Descriptions.Item label="رسوم الاتصال">{c.connectionFee} {c.currency} {c.connectionFeePaid ? <Tag color="success" style={{ fontSize: 10 }}>مسددة</Tag> : <Tag color="error" style={{ fontSize: 10 }}>غير مسددة</Tag>}</Descriptions.Item>
                        <Descriptions.Item label="رسوم القطع">{c.disconnectionFee} {c.currency}</Descriptions.Item>
                      </Descriptions>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6, color: '#fa8c16' }}>الوديعة</Text>
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888', width: 130 }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="مبلغ الوديعة">{c.depositAmount} {c.currency}</Descriptions.Item>
                        <Descriptions.Item label="حالة الوديعة">
                          {c.depositPaid
                            ? <Tag color="success" style={{ fontSize: 10 }}>مسددة — {c.depositDate}</Tag>
                            : <Tag color="error" style={{ fontSize: 10 }}>غير مسددة</Tag>}
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6, color: '#fa8c16' }}>قراءة العداد والرصيد</Text>
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888', width: 130 }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="آخر قراءة">{c.lastReading} م³ ({c.lastReadDate})</Descriptions.Item>
                        <Descriptions.Item label="الرصيد م³">
                          <Text style={{ color: c.balanceM3 === 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{c.balanceM3} م³</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="الرصيد المالي">
                          <Text style={{ color: c.balanceAmount === 0 ? '#ff4d4f' : PRIMARY, fontWeight: 600 }}>{c.balanceAmount.toLocaleString()} {c.currency}</Text>
                        </Descriptions.Item>
                      </Descriptions>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6, color: '#fa8c16' }}>الدفعات</Text>
                      <Descriptions column={1} size="small" labelStyle={{ fontSize: 11, color: '#888', width: 130 }} contentStyle={{ fontSize: 11 }}>
                        <Descriptions.Item label="المتأخرات">
                          {c.overdueAmount > 0
                            ? <Text strong style={{ color: '#ff4d4f' }}>{c.overdueAmount.toLocaleString()} {c.currency}</Text>
                            : <Text style={{ color: '#52c41a' }}>لا يوجد</Text>}
                        </Descriptions.Item>
                      </Descriptions>
                      {c.status === 'expired' && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                          <Button size="small" type="primary" icon={<PlusOutlined />} style={{ fontSize: 11, borderRadius: 6, background: '#fa8c16', borderColor: '#fa8c16' }}
                            onClick={() => buildingId && c.unitId ? openUnitFor(c.unitId, 'tenant') : setAddContractOpen(true)}>عقد جديد</Button>
                          <Button size="small" icon={<EditOutlined />} style={{ fontSize: 11, borderRadius: 6 }} onClick={() => openRenew('supply', c)}>تجديد</Button>
                        </div>
                      )}
                    </Col>
                  </Row>
                </div>
              ),
            }}
            columns={[
              { title: 'رقم العقد', dataIndex: 'contractNo', width: 160, render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Text> },
              { title: 'المستأجر', dataIndex: 'tenant', render: (v: string, r: any) => (
                <div><Text style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>وحدة {r.unit} | {r.meter}</Text></div>
              )},
              { title: 'الفترة', width: 180, render: (_: any, r: any) => <Text style={{ fontSize: 11 }}>{r.startDate} → {r.endDate}</Text> },
              { title: 'الحالة', dataIndex: 'status', width: 80, render: (v: string) => <Tag color={cStatusMap[v]?.color}>{cStatusMap[v]?.label}</Tag> },
              { title: 'الرسوم الشهرية', dataIndex: 'monthlyFee', width: 110, render: (v: number, r: any) => <Text style={{ fontSize: 12 }}>{v} {r.currency}</Text> },
              { title: 'الرصيد', dataIndex: 'balanceAmount', width: 110, render: (v: number, r: any) => (
                <Text strong style={{ fontSize: 12, color: v === 0 ? '#ff4d4f' : PRIMARY }}>{v.toLocaleString()} {r.currency}</Text>
              )},
              { title: 'الوديعة', dataIndex: 'depositPaid', width: 80, render: (v: boolean) => v ? <Tag color="success" style={{ fontSize: 10 }}>مسددة</Tag> : <Tag color="error" style={{ fontSize: 10 }}>معلقة</Tag> },
              { title: 'الدفع', dataIndex: 'paymentStatus', width: 80, render: (v: string) => <Tag color={payStatusMap[v]?.color} style={{ fontSize: 10 }}>{payStatusMap[v]?.label}</Tag> },
              { title: '', width: 120, render: (_: any, r: any) => (<Space size={6}>
                <Tooltip title="طباعة العقد"><Button size="small" type="text" icon={<PrinterOutlined />} onClick={() => printSupplyContract(openPrintWindow(), Number(r.id))} /></Tooltip>
                {r.status === 'expired'
                  ? <Space size={4}>
                      <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }} icon={<PlusOutlined />}
                        onClick={() => buildingId && r.unitId ? openUnitFor(r.unitId, 'tenant') : setAddContractOpen(true)}>جديد</Button>
                      <Button size="small" type="link" style={{ padding: 0, fontSize: 11, color: '#fa8c16' }} icon={<EditOutlined />} onClick={() => openRenew('supply', r)}>تجديد</Button>
                    </Space>
                  : <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }} onClick={() => { if (buildingId && r.unitId) openUnitFor(r.unitId); else { setSelectedContract(r as SupplyContractRecord); setContractDrawerOpen(true); } }}>تفاصيل</Button>}
              </Space>)},
            ]}
          />
        </div>
      )}
    </div>
  );


  // ── Units Tab ─────────────────────────────────────────────────────
  const unitStatusColors: Record<string, string> = {
    occupied: '#52c41a', vacant: '#ff4d4f', maintenance: '#fa8c16', reserved: '#1677ff',
  };
  const filteredUnits = building.units.filter(u => {
    const matchSearch = unitSearch === '' || u.no.includes(unitSearch) || (u.tenant || '').includes(unitSearch);
    const matchFilter = unitFilter === 'all' || u.status === unitFilter;
    return matchSearch && matchFilter;
  });

  const unitsTab = (
    <div>
      {/* Floor summary strip */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'إجمالي الوحدات', value: building.totalUnits, color: PRIMARY, bg: '#e8f5e9' },
          { label: 'مشغول', value: building.occupied, color: '#52c41a', bg: '#f6ffed' },
          { label: 'شاغر', value: building.vacant, color: '#ff4d4f', bg: '#fff1f0' },
          { label: 'صيانة', value: building.units.filter(u => u.status === 'maintenance').length, color: '#fa8c16', bg: '#fff7e6' },
          { label: 'محجوز', value: building.units.filter(u => u.status === 'reserved').length, color: '#1677ff', bg: '#e6f4ff' },
        ].map((s, i) => (
          <Card key={i} size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, minWidth: 110, textAlign: 'center', flex: '1 1 100px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Floor occupancy visual */}
      <Card size="small" bordered={false} style={{ borderRadius: 10, marginBottom: 16 }}>
        <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
          <ApartmentOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />مخطط الطوابق
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 6 }}>
          {Array.from({ length: building.floors }, (_, fi) => {
            const floorNo = fi + 1;
            const floorUnits = building.units.filter(u => u.floor === floorNo);
            return (
              <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, color: '#888', width: 52, textAlign: 'left', flexShrink: 0 }}>ط {floorNo}</Text>
                <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
                  {floorUnits.map(u => (
                    <Tooltip key={u.no} title={`${u.no} — ${u.typeLabel} — ${unitStatusMap[u.status]?.label}${u.tenant ? ' — ' + u.tenant : ''}`}>
                      <div style={{
                        width: 36, height: 28, borderRadius: 5, background: unitStatusColors[u.status] || '#ddd',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 10, color: '#fff', fontWeight: 600,
                      }}>{u.no}</div>
                    </Tooltip>
                  ))}
                  {floorUnits.length === 0 && <Text type="secondary" style={{ fontSize: 11 }}>لا توجد وحدات مسجلة</Text>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          {[{ color: '#52c41a', label: 'مشغول' }, { color: '#ff4d4f', label: 'شاغر' }, { color: '#fa8c16', label: 'صيانة' }, { color: '#1677ff', label: 'محجوز' }].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
              <Text style={{ fontSize: 11 }}>{l.label}</Text>
            </div>
          ))}
        </div>
      </Card>

      {/* Search + filter + view toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#ccc' }} />}
          placeholder="بحث برقم الوحدة أو اسم المستأجر..."
          value={unitSearch}
          onChange={e => setUnitSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
          allowClear
        />
        {[{ key: 'all', label: 'الكل' }, { key: 'occupied', label: 'مشغول' }, { key: 'vacant', label: 'شاغر' }, { key: 'maintenance', label: 'صيانة' }].map(f => (
          <Button key={f.key} type={unitFilter === f.key ? 'primary' : 'default'} size="middle" onClick={() => setUnitFilter(f.key)} style={{ borderRadius: 8 }}>{f.label}</Button>
        ))}
        <Button icon={unitView === 'grid' ? <DatabaseOutlined /> : <ApartmentOutlined />} onClick={() => setUnitView(v => v === 'grid' ? 'table' : 'grid')} style={{ borderRadius: 8 }}>
          {unitView === 'grid' ? 'جدول' : 'بطاقات'}
        </Button>
        <Button icon={<UserOutlined />} style={{ borderRadius: 8 }} onClick={() => setAddTenantOpen(true)}>إضافة مستأجر</Button>
        <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setAddUnitOpen(true)}>إضافة وحدة</Button>
      </div>

      {/* Units Grid */}
      {unitView === 'grid' ? (
        <Row gutter={[12, 12]}>
          {filteredUnits.map(u => (
            <Col xs={24} sm={12} md={8} lg={6} key={u.key}>
              <Card size="small" bordered={false} style={{ borderRadius: 10, border: `2px solid ${unitStatusColors[u.status]}22`, textAlign: 'center', cursor: 'pointer' }}
                hoverable bodyStyle={{ padding: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 10, background: `${unitStatusColors[u.status]}22`, border: `2px solid ${unitStatusColors[u.status]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 14, fontWeight: 700, color: unitStatusColors[u.status] }}>{u.no}</div>
                <Tag color={unitStatusMap[u.status]?.color} style={{ marginBottom: 6 }}>{unitStatusMap[u.status]?.label}</Tag>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{u.typeLabel} · ط{u.floor}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{u.area} م²</div>
                {u.tenant ? <Text style={{ fontSize: 11, color: PRIMARY }}>{u.tenant}</Text> : <Text type="secondary" style={{ fontSize: 11 }}>شاغرة</Text>}
              </Card>
            </Col>
          ))}
          {filteredUnits.length === 0 && <Col span={24}><Empty description="لا توجد نتائج" style={{ padding: '40px 0' }} /></Col>}
        </Row>
      ) : (
        /* Units Table */
        <Table size="small" dataSource={filteredUnits} rowKey="key" pagination={{ pageSize: 10, size: 'small' }}
          columns={[
            { title: 'رقم الوحدة', dataIndex: 'no', width: 90, render: (v: string) => <Text strong style={{ color: PRIMARY }}>{v}</Text> },
            { title: 'الطابق', dataIndex: 'floor', width: 70, align: 'center' as const },
            { title: 'النوع', dataIndex: 'typeLabel', width: 90 },
            { title: 'المساحة', dataIndex: 'area', width: 90, render: (v: number) => `${v} م²` },
            { title: 'الحالة', dataIndex: 'status', width: 90, render: (v: string) => <Tag color={unitStatusMap[v]?.color}>{unitStatusMap[v]?.label}</Tag> },
            { title: 'المستأجر', dataIndex: 'tenant', render: (v: string | null) => v ? <Text style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 12 }}>—</Text> },
            { title: 'العداد', dataIndex: 'meter', width: 85, render: (v: string) => <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag> },
            { title: 'نهاية العقد', dataIndex: 'contractEnd', width: 110, render: (v: string | null) => v ? <Text style={{ fontSize: 12, color: new Date(v) < new Date() ? '#ff4d4f' : undefined }}>{v}</Text> : <Text type="secondary" style={{ fontSize: 12 }}>—</Text> },
            { title: 'الإيجار', dataIndex: 'rent', width: 110, render: (v: number) => <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>{v.toLocaleString()} د.إ</Text> },
            { title: 'ملاحظات', dataIndex: 'notes', render: (v: string) => v ? <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text> : null },
            { title: '', width: 80, render: () => <Button size="small" type="link">تفاصيل</Button> },
          ]}
        />
      )}
    </div>
  );

  // ── Meters Tab ─────────────────────────────────────────────────────
  const filteredMeters = building.meters.filter(m => {
    const matchSearch = meterSearch === '' || m.id.includes(meterSearch) || m.serial.includes(meterSearch) || (m.tenant || '').includes(meterSearch) || m.unit.includes(meterSearch);
    const matchFilter = meterFilter === 'all' || m.status === meterFilter;
    return matchSearch && matchFilter;
  });

  const metersTab = (
    <div>
      {/* Meter stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'إجمالي العدادات', value: building.meters.length, color: PRIMARY, bg: '#e8f5e9' },
          { label: 'نشط', value: building.meters.filter(m => m.status === 'active').length, color: '#52c41a', bg: '#f6ffed' },
          { label: 'عطل', value: building.meters.filter(m => m.status === 'fault').length, color: '#ff4d4f', bg: '#fff1f0' },
          { label: 'مفصول', value: building.meters.filter(m => m.status === 'disconnected').length, color: '#8c8c8c', bg: '#f5f5f5' },
          { label: 'عداد ذكي', value: building.meters.filter(m => m.type === 'smart').length, color: '#1677ff', bg: '#e6f4ff' },
          { label: 'متوسط الاستهلاك', value: `${Math.round(building.meters.reduce((acc, m) => acc + m.monthlyAvg, 0) / building.meters.length)} م³`, color: '#fa8c16', bg: '#fff7e6' },
        ].map((s, i) => (
          <Card key={i} size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, minWidth: 100, textAlign: 'center', flex: '1 1 90px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: s.color, opacity: 0.85 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#ccc' }} />}
          placeholder="بحث برقم العداد، الوحدة، المستأجر..."
          value={meterSearch}
          onChange={e => setMeterSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
          allowClear
        />
        {[{ key: 'all', label: 'الكل' }, { key: 'active', label: 'نشط' }, { key: 'fault', label: 'عطل' }, { key: 'disconnected', label: 'مفصول' }].map(f => (
          <Button key={f.key} type={meterFilter === f.key ? 'primary' : 'default'} size="middle" onClick={() => setMeterFilter(f.key)} style={{ borderRadius: 8 }}>{f.label}</Button>
        ))}
        <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setAddMeterOpen(true)}>إضافة عداد</Button>
      </div>

      {/* Meter cards grid */}
      <Row gutter={[12, 12]}>
        {filteredMeters.map(m => {
          const isFault = m.status === 'fault';
          const isDisconnected = m.status === 'disconnected';
          const borderColor = isFault ? '#ff4d4f' : isDisconnected ? '#d9d9d9' : '#52c41a';
          const bgColor = isFault ? '#fff1f0' : isDisconnected ? '#fafafa' : '#f6ffed';
          return (
            <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
              <Card size="small" bordered hoverable
                style={{ borderRadius: 10, border: `2px solid ${borderColor}`, background: bgColor, height: '100%' }}
                bodyStyle={{ padding: 12 }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <Text strong style={{ color: PRIMARY, fontSize: 13 }}>{m.id}</Text>
                    <div style={{ fontSize: 10, color: '#999', fontFamily: 'monospace' }}>{m.serial}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Tag color={meterStatusMap[m.status]?.color} style={{ margin: 0, fontSize: 10 }}>{meterStatusMap[m.status]?.label}</Tag>
                    <Tag color={m.type === 'smart' ? 'blue' : 'default'} style={{ margin: 0, fontSize: 10 }}>{m.typeLabel}</Tag>
                  </div>
                </div>

                {/* Reading */}
                <div style={{ background: isFault ? '#ffebeb' : '#fff', borderRadius: 6, padding: '6px 8px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>آخر قراءة</Text>
                    <Text strong style={{ fontSize: 14, color: isFault ? '#ff4d4f' : '#1a1a1a' }}>{m.lastReadValue} <span style={{ fontSize: 11, fontWeight: 400 }}>م³</span></Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>متوسط شهري</Text>
                    <Text style={{ fontSize: 11, color: '#666' }}>{m.monthlyAvg} م³</Text>
                  </div>
                </div>

                {/* Balance */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>الرصيد</Text>
                  {m.balance === 0
                    ? <Text strong style={{ fontSize: 12, color: '#ff4d4f' }}>نفد الرصيد</Text>
                    : <Text strong style={{ fontSize: 12, color: PRIMARY }}>{m.balance.toLocaleString()} م³</Text>
                  }
                </div>

                {/* Unit + Tenant */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 6, marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                    <HomeOutlined style={{ fontSize: 11, color: '#aaa' }} />
                    <Text style={{ fontSize: 11 }}>{m.unit} — ط{m.floor}</Text>
                  </div>
                  {m.tenant && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                      <UserOutlined style={{ fontSize: 11, color: '#aaa' }} />
                      <Text style={{ fontSize: 11 }}>{m.tenant}</Text>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <CalendarOutlined style={{ fontSize: 11, color: '#aaa' }} />
                    <Text type="secondary" style={{ fontSize: 10 }}>آخر قراءة: {m.lastRead}</Text>
                  </div>
                  {isFault && (
                    <div style={{ marginTop: 6 }}>
                      <Tag color="error" icon={<WarningOutlined />} style={{ fontSize: 10 }}>يحتاج إلى صيانة</Tag>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ marginTop: 8, display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <Button size="small" style={{ fontSize: 11, borderRadius: 6 }} onClick={() => setReadingMeter(m)}>قراءة</Button>
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'disconnect', icon: <DisconnectOutlined />, label: 'طلب قطع الغاز',        danger: true },
                        { key: 'connect',    icon: <ThunderboltOutlined style={{ color: PRIMARY }} />, label: 'طلب وصل الغاز' },
                        { type: 'divider' },
                        { key: 'report_issue', icon: <WarningOutlined style={{ color: '#fa8c16' }} />, label: 'الإبلاغ عن عطل' },
                        { key: 'replace',    icon: <SwapOutlined style={{ color: '#722ed1' }} />, label: 'طلب استبدال العداد' },
                      ],
                      onClick: ({ key }) => { setServiceMeter(m); setServiceType(key as MeterServiceType); },
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button size="small" style={{ fontSize: 11, borderRadius: 6 }}>إجراءات ▾</Button>
                  </Dropdown>
                  <Button size="small" type="primary" style={{ fontSize: 11, borderRadius: 6, background: PRIMARY, borderColor: PRIMARY }} onClick={() => setSelectedMeter(m)}>تفاصيل</Button>
                </div>
              </Card>
            </Col>
          );
        })}
        {filteredMeters.length === 0 && <Col span={24}><Empty description="لا توجد نتائج" style={{ padding: '40px 0' }} /></Col>}
      </Row>
    </div>
  );

  const filteredTenants = building.tenants.filter(t => {
    const matchSearch = tenantSearch === '' || t.name.includes(tenantSearch) || t.unit.includes(tenantSearch) || t.phone.includes(tenantSearch);
    const matchFilter = tenantFilter === 'all' || t.paymentStatus === tenantFilter;
    return matchSearch && matchFilter;
  });

  const tenantsTab = (
    <div>
      {/* Summary row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {[
          { label: 'إجمالي المستأجرين', value: building.tenants.length, color: PRIMARY, bg: '#e8f5e9' },
          { label: 'عقود سارية', value: building.tenants.filter(t => t.paymentStatus !== 'overdue').length, color: '#1677ff', bg: '#e3f2fd' },
          { label: 'دفعات متأخرة', value: building.tenants.filter(t => t.paymentStatus === 'overdue').length, color: '#ff4d4f', bg: '#ffebee' },
          { label: 'بدون وديعة', value: building.tenants.filter(t => !t.depositPaid).length, color: '#fa8c16', bg: '#fff7e6' },
        ].map((s, i) => (
          <Col xs={12} md={6} key={i}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: s.color, opacity: 0.8 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#ccc' }} />}
          placeholder="بحث باسم المستأجر أو رقم الوحدة أو الهاتف..."
          value={tenantSearch}
          onChange={e => setTenantSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
          allowClear
        />
        {[
          { key: 'all', label: 'الكل' },
          { key: 'paid', label: 'مسدد' },
          { key: 'pending', label: 'معلق' },
          { key: 'overdue', label: 'متأخر' },
        ].map(f => (
          <Button key={f.key} size="middle"
            type={tenantFilter === f.key ? 'primary' : 'default'}
            onClick={() => setTenantFilter(f.key)}
            style={{ borderRadius: 8 }}>
            {f.label}
          </Button>
        ))}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddTenantOpen(true)}
          style={{ marginInlineStart: 'auto', background: PRIMARY, borderColor: PRIMARY, borderRadius: 8 }}>
          إضافة مستأجر
        </Button>
      </div>

      {/* Tenant cards grid */}
      <Row gutter={[16, 16]}>
        {filteredTenants.map((tenant, idx) => (
          <Col xs={24} md={12} xl={8} key={idx}>
            <Card
              size="small"
              bordered={false}
              style={{
                borderRadius: 10,
                border: tenant.paymentStatus === 'overdue'
                  ? '2px solid #ff4d4f'
                  : tenant.paymentStatus === 'pending'
                  ? '2px solid #fa8c16'
                  : '1px solid #f0f0f0',
              }}
              actions={[
                <Button key="profile" size="small" type="link" icon={<UserOutlined />} onClick={() => { setProfileTenant(tenant); setProfileDrawerOpen(true); }}>الملف الشخصي</Button>,
                <Button key="contract" size="small" type="link" icon={<ContainerOutlined />} onClick={() => { setContractTenant(tenant.id); setAddContractOpen(true); }}>العقد</Button>,
                <Button key="invoice" size="small" type="link" icon={<CreditCardOutlined />} onClick={() => { setInvoiceTenant(tenant); setInvoiceDrawerOpen(true); }}>الفواتير</Button>,
              ]}
            >
              {/* Tenant header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <Avatar
                  size={44}
                  style={{
                    background: tenant.paymentStatus === 'paid' ? PRIMARY
                      : tenant.paymentStatus === 'overdue' ? '#ff4d4f' : '#fa8c16',
                    fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                  {tenant.avatar}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text strong style={{ fontSize: 13 }}>{tenant.name}</Text>
                    <Tag color={paymentStatusMap[tenant.paymentStatus]?.color} style={{ fontSize: 11, margin: 0 }}>
                      {paymentStatusMap[tenant.paymentStatus]?.label}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{tenant.nameEn}</Text>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <Tag color="blue" style={{ fontSize: 11, margin: 0 }}>وحدة {tenant.unit}</Tag>
                    <Tag style={{ fontSize: 11, margin: 0 }}>ط {tenant.floor}</Tag>
                    <Tag color="geekblue" style={{ fontSize: 11, margin: 0, fontFamily: 'monospace' }}>{tenant.meterNo}</Tag>
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined style={{ color: PRIMARY, fontSize: 12, flexShrink: 0 }} />
                  <Text style={{ fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{tenant.phone}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MailOutlined style={{ color: PRIMARY, fontSize: 12, flexShrink: 0 }} />
                  <Text style={{ fontSize: 12, direction: 'ltr', display: 'inline-block' }}>{tenant.email}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IdcardOutlined style={{ color: PRIMARY, fontSize: 12, flexShrink: 0 }} />
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', direction: 'ltr', display: 'inline-block' }}>{tenant.emiratesId}</Text>
                </div>
              </div>

              <Divider style={{ margin: '8px 0' }} />

              {/* Contract & financial */}
              <Row gutter={[8, 6]}>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>رقم العقد</Text>
                    <a style={{ fontSize: 12 }}>{tenant.contractNo}</a>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: '5px 8px' }}>
                    <div style={{ fontSize: 10, color: '#999' }}>بداية العقد</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{tenant.contractStart}</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: '5px 8px' }}>
                    <div style={{ fontSize: 10, color: '#999' }}>نهاية العقد</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{tenant.contractEnd}</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: '5px 8px' }}>
                    <div style={{ fontSize: 10, color: '#999' }}>الإيجار السنوي</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>{tenant.rent.toLocaleString()} د.إ</div>
                  </div>
                </Col>
                <Col span={12}>
                  <div style={{ background: '#fafafa', borderRadius: 6, padding: '5px 8px' }}>
                    <div style={{ fontSize: 10, color: '#999' }}>رصيد الغاز</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tenant.gasBalance > 0 ? '#1677ff' : '#ff4d4f' }}>
                      {tenant.gasBalance > 0 ? `${tenant.gasBalance} م³` : 'نفد الرصيد'}
                    </div>
                  </div>
                </Col>
                <Col span={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>وديعة الضمان</Text>
                    {tenant.depositPaid
                      ? <Tag color="green" style={{ fontSize: 11, margin: 0 }}>مدفوعة</Tag>
                      : <Tag color="red" style={{ fontSize: 11, margin: 0 }}>غير مدفوعة</Tag>
                    }
                  </div>
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
        {filteredTenants.length === 0 && (
          <Col span={24}>
            <Empty description="لا توجد نتائج مطابقة" style={{ padding: '40px 0' }} />
          </Col>
        )}
      </Row>
    </div>
  );

  // ── Activity Tab ──────────────────────────────────────────────────
  // ── AMC Scheduled Visits Tab ─────────────────────────────────────
  const [visitModalOpen, setVisitModalOpen]         = React.useState(false);
  const [selectedVisit, setSelectedVisit]           = React.useState<any>(null);
  const [scheduleModalOpen, setScheduleModalOpen]   = React.useState(false);

  const visitStatusMap: Record<string, { color: string; label: string; bg: string }> = {
    scheduled:   { color: '#1677ff', label: 'مجدولة',   bg: '#e6f4ff' },
    in_progress: { color: '#fa8c16', label: 'جارية',    bg: '#fff7e6' },
    completed:   { color: '#52c41a', label: 'مكتملة',   bg: '#f6ffed' },
    cancelled:   { color: '#ff4d4f', label: 'ملغاة',    bg: '#fff1f0' },
    rescheduled: { color: '#722ed1', label: 'مُعاد جدولتها', bg: '#f9f0ff' },
  };

  const visitTypeMap: Record<string, { color: string; icon: React.ReactNode }> = {
    quarterly:  { color: PRIMARY,   icon: <CalendarOutlined style={{ color: PRIMARY }} /> },
    emergency:  { color: '#ff4d4f', icon: <AlertOutlined style={{ color: '#ff4d4f' }} /> },
    annual:     { color: '#722ed1', icon: <AuditOutlined style={{ color: '#722ed1' }} /> },
    additional: { color: '#fa8c16', icon: <ToolOutlined style={{ color: '#fa8c16' }} /> },
  };

  const findingColors: Record<string, string> = { info: '#1677ff', warning: '#fa8c16', error: '#ff4d4f' };

  const completedVisits = building.scheduledVisits.filter((v: any) => v.status === 'completed');
  const upcomingVisits  = building.scheduledVisits.filter((v: any) => v.status === 'scheduled' || v.status === 'in_progress');
  const activeContract  = building.amcContracts.find((c: any) => c.status === 'active');

  const scheduledVisitsTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── AMC Contract Header ── */}
      {activeContract && (
        <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, #e8f5e9 0%, #f0f9f0 100%)', border: `1px solid ${PRIMARY}30` }}>
          <Row align="middle" gutter={[16, 8]}>
            <Col xs={24} md={16}>
              <Space size={14} align="start">
                <div style={{ fontSize: 36, color: PRIMARY }}><SafetyCertificateOutlined /></div>
                <div>
                  <Text strong style={{ fontSize: 15, display: 'block' }}>{activeContract.contractNo}</Text>
                  <Text style={{ fontSize: 12 }}>{activeContract.vendor}</Text>
                  <div style={{ marginTop: 6 }}>
                    <Tag color="success">نشط</Tag>
                    <Tag color="blue">{activeContract.visitFrequency}</Tag>
                    <Tag>{activeContract.visitsDone} / {activeContract.visitsTotal} زيارة منجزة</Tag>
                  </div>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Row gutter={[8, 6]}>
                {[
                  { l: 'بداية العقد', v: activeContract.startDate },
                  { l: 'نهاية العقد', v: activeContract.endDate },
                  { l: 'آخر زيارة',   v: activeContract.lastVisit },
                  { l: 'الزيارة التالية', v: activeContract.nextVisit || '—' },
                ].map((f, i) => (
                  <Col span={12} key={i}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{f.l}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{f.v}</Text>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
          {/* Visit progress bar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <Text strong>تقدم الزيارات — {activeContract.visitFrequency}</Text>
              <Text strong style={{ color: PRIMARY }}>{activeContract.visitsDone} من {activeContract.visitsTotal}</Text>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: activeContract.visitsTotal }).map((_: any, i: number) => (
                <div key={i} style={{ flex: 1, height: 10, borderRadius: 5,
                  background: i < activeContract.visitsDone ? PRIMARY : '#ddd' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginTop: 3 }}>
              {Array.from({ length: activeContract.visitsTotal }).map((_: any, i: number) => (
                <span key={i}>Q{i + 1}</span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── KPI Row ── */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'إجمالي الزيارات', value: building.scheduledVisits.length, color: PRIMARY, bg: '#e8f5e9', icon: <CalendarOutlined /> },
          { label: 'مجدولة / قادمة',  value: upcomingVisits.length, color: '#1677ff', bg: '#e6f4ff', icon: <ClockCircleOutlined /> },
          { label: 'مكتملة',          value: completedVisits.length, color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
          { label: 'ملاحظات مفتوحة', value: building.scheduledVisits.flatMap((v: any) => v.findings).filter((f: any) => f.severity !== 'info').length, color: '#fa8c16', bg: '#fff7e6', icon: <ExclamationCircleOutlined /> },
          { label: 'زيارات طارئة',    value: building.scheduledVisits.filter((v: any) => v.type === 'emergency').length, color: '#ff4d4f', bg: '#fff1f0', icon: <AlertOutlined /> },
        ].map((s: any, i) => (
          <Col xs={12} sm={8} md={5} lg={5} key={i}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 20, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Upcoming Visits ── */}
      {upcomingVisits.length > 0 && (
        <Card bordered={false} style={{ borderRadius: 12, border: '1.5px solid #1677ff', background: '#f0f7ff' }}
          title={<Space><ClockCircleOutlined style={{ color: '#1677ff' }} /><Text strong style={{ color: '#1677ff' }}>الزيارات القادمة</Text><Tag color="blue">{upcomingVisits.length}</Tag></Space>}
          extra={<Button size="small" type="primary" icon={<CalendarOutlined />} onClick={() => setScheduleModalOpen(true)}>جدولة زيارة جديدة</Button>}
        >
          {upcomingVisits.map((v: any, idx: number) => (
            <div key={v.id} style={{ padding: '12px 0', borderBottom: idx < upcomingVisits.length - 1 ? '1px solid #dbeeff' : 'none' }}>
              <Row align="middle" gutter={[12, 8]}>
                <Col xs={2} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, color: '#1677ff' }}>{visitTypeMap[v.type]?.icon}</div>
                </Col>
                <Col xs={22} md={10}>
                  <Text strong style={{ fontSize: 13, display: 'block' }}>{v.typeLabel}</Text>
                  <Space style={{ marginTop: 2 }}>
                    <Tag color="blue" style={{ fontSize: 11 }}>{v.contractNo}</Tag>
                    {v.quarter && <Tag style={{ fontSize: 11 }}>{v.quarter}</Tag>}
                  </Space>
                </Col>
                <Col xs={24} md={6}>
                  <Space>
                    <CalendarOutlined style={{ color: '#888' }} />
                    <div>
                      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{v.scheduledDate}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{v.timeSlot}</Text>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={5}>
                  <Space>
                    <UserOutlined style={{ color: '#888' }} />
                    <div>
                      <Text style={{ fontSize: 12, display: 'block' }}>{v.technician}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{v.technicianPhone}</Text>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={3} style={{ textAlign: 'left' }}>
                  <Button size="small" type="primary" ghost
                    onClick={() => { setSelectedVisit(v); setVisitModalOpen(true); }}>
                    عرض التفاصيل
                  </Button>
                </Col>
              </Row>
              {v.notes && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: '#dbeeff', borderRadius: 6, fontSize: 12 }}>
                  <BellOutlined style={{ marginInlineEnd: 6, color: '#1677ff' }} />{v.notes}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* ── Visits History Table ── */}
      <Card bordered={false} style={{ borderRadius: 10 }}
        title={<Text strong><ClockCircleOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />سجل الزيارات</Text>}
        extra={
          upcomingVisits.length === 0 &&
          <Button size="small" type="primary" icon={<CalendarOutlined />} onClick={() => setScheduleModalOpen(true)}>جدولة زيارة جديدة</Button>
        }
      >
        <Table size="small" rowKey="id" pagination={{ pageSize: 8, size: 'small' }}
          dataSource={[...building.scheduledVisits].sort((a: any, b: any) => b.scheduledDate.localeCompare(a.scheduledDate))}
          expandable={{
            expandedRowRender: (r: any) => (
              <div style={{ padding: '10px 16px', background: '#fafafa', borderRadius: 8 }}>
                <Row gutter={[16, 10]}>
                  {/* Checklist */}
                  <Col xs={24} md={12}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      <CheckCircleOutlined style={{ color: PRIMARY, marginInlineEnd: 4 }} />قائمة الفحص
                    </Text>
                    {r.checklistItems.map((item: any) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${item.done ? '#52c41a' : '#ddd'}`,
                          background: item.done ? '#52c41a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0 }}>
                          {item.done && <span style={{ color: 'white', fontSize: 8, lineHeight: 1 }}>✓</span>}
                        </div>
                        <Text style={{ fontSize: 11, color: item.done ? '#333' : '#888' }}>{item.item}</Text>
                      </div>
                    ))}
                  </Col>
                  {/* Findings */}
                  <Col xs={24} md={12}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      <ExclamationCircleOutlined style={{ color: '#fa8c16', marginInlineEnd: 4 }} />الملاحظات والمخرجات
                    </Text>
                    {r.findings.length === 0
                      ? <Text type="secondary" style={{ fontSize: 11 }}>لا توجد ملاحظات — جميع الأنظمة سليمة</Text>
                      : r.findings.map((f: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, padding: '4px 8px', borderRadius: 6,
                            background: f.severity === 'error' ? '#fff1f0' : f.severity === 'warning' ? '#fff7e6' : '#e6f4ff' }}>
                            <ExclamationCircleOutlined style={{ color: findingColors[f.severity], flexShrink: 0, marginTop: 2 }} />
                            <Text style={{ fontSize: 11 }}>{f.description}</Text>
                          </div>
                        ))
                    }
                    {r.report && (
                      <Button size="small" icon={<FilePdfOutlined />} style={{ marginTop: 8, fontSize: 11 }}>{r.report}</Button>
                    )}
                    {r.notes && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#555' }}>
                        <Text type="secondary">ملاحظات: </Text>{r.notes}
                      </div>
                    )}
                  </Col>
                </Row>
              </div>
            ),
          }}
          columns={[
            { title: 'رقم الزيارة', dataIndex: 'id', render: (v: string) => <a style={{ fontSize: 12, color: PRIMARY }}>{v}</a> },
            { title: 'النوع', dataIndex: 'type', render: (v: string, r: any) => (
              <Space>
                {visitTypeMap[v]?.icon}
                <Text style={{ fontSize: 12 }}>{r.typeLabel}</Text>
              </Space>
            )},
            { title: 'الربع', dataIndex: 'quarter', render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
            { title: 'التاريخ', dataIndex: 'scheduledDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
            { title: 'الفني', dataIndex: 'technician', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
            { title: 'الحالة', dataIndex: 'status', render: (v: string) => (
              <Tag color={visitStatusMap[v]?.color} style={{ fontSize: 11 }}>{visitStatusMap[v]?.label}</Tag>
            )},
            { title: 'ملاحظات', dataIndex: 'findings', render: (findings: any[]) => {
              const issues = findings.filter((f: any) => f.severity !== 'info');
              return issues.length > 0
                ? <Tag color="warning" style={{ fontSize: 11 }}>{issues.length} ملاحظة</Tag>
                : <Tag color="success" style={{ fontSize: 11 }}>سليم</Tag>;
            }},
            { title: '', render: (_: any, r: any) => (
              <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }}
                onClick={() => { setSelectedVisit(r); setVisitModalOpen(true); }}>تفاصيل</Button>
            )},
          ]} />
      </Card>

      {/* ── Visit Detail Modal ── */}
      <Modal open={visitModalOpen} onCancel={() => setVisitModalOpen(false)} footer={null} width={700}
        title={selectedVisit && (
          <Space>
            {visitTypeMap[selectedVisit.type]?.icon}
            <Text strong>{selectedVisit.typeLabel} — {selectedVisit.id}</Text>
            <Tag color={visitStatusMap[selectedVisit.status]?.color}>{visitStatusMap[selectedVisit.status]?.label}</Tag>
          </Space>
        )}
      >
        {selectedVisit && (
          <div style={{ padding: '8px 0' }}>
            <Row gutter={[16, 10]} style={{ marginBottom: 16 }}>
              {[
                { l: 'العقد', v: selectedVisit.contractNo },
                { l: 'المورد', v: selectedVisit.vendor },
                { l: 'تاريخ الزيارة', v: selectedVisit.scheduledDate },
                { l: 'الوقت', v: selectedVisit.timeSlot },
                { l: 'الفني المسؤول', v: selectedVisit.technician },
                { l: 'هاتف الفني', v: selectedVisit.technicianPhone },
              ].map((f, i) => (
                <Col span={8} key={i}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{f.l}</Text>
                  <Text style={{ fontSize: 13 }}>{f.v}</Text>
                </Col>
              ))}
            </Row>
            <Divider style={{ margin: '10px 0' }} />
            <Row gutter={[16, 0]}>
              <Col span={12}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                  <CheckCircleOutlined style={{ color: PRIMARY, marginInlineEnd: 6 }} />قائمة الفحص
                  <Tag style={{ marginInlineStart: 8, fontSize: 11 }}>
                    {selectedVisit.checklistItems.filter((i: any) => i.done).length} / {selectedVisit.checklistItems.length}
                  </Tag>
                </Text>
                <Progress
                  percent={Math.round((selectedVisit.checklistItems.filter((i: any) => i.done).length / selectedVisit.checklistItems.length) * 100)}
                  strokeColor={PRIMARY} size="small" style={{ marginBottom: 10 }}
                />
                {selectedVisit.checklistItems.map((item: any) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
                    borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${item.done ? '#52c41a' : '#ddd'}`,
                      background: item.done ? '#52c41a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.done && <span style={{ color: 'white', fontSize: 9 }}>✓</span>}
                    </div>
                    <Text style={{ fontSize: 12, color: item.done ? '#333' : '#aaa' }}>{item.item}</Text>
                  </div>
                ))}
              </Col>
              <Col span={12}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>
                  <ExclamationCircleOutlined style={{ color: '#fa8c16', marginInlineEnd: 6 }} />الملاحظات
                </Text>
                {selectedVisit.findings.length === 0
                  ? <div style={{ padding: '12px', background: '#f6ffed', borderRadius: 8, textAlign: 'center' }}>
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20, display: 'block', marginBottom: 4 }} />
                      <Text style={{ fontSize: 12, color: '#52c41a' }}>لا توجد ملاحظات</Text>
                    </div>
                  : selectedVisit.findings.map((f: any, i: number) => (
                      <div key={i} style={{ padding: '8px 10px', marginBottom: 6, borderRadius: 8,
                        background: f.severity === 'error' ? '#fff1f0' : f.severity === 'warning' ? '#fff7e6' : '#e6f4ff',
                        borderRight: `3px solid ${findingColors[f.severity]}` }}>
                        <Text style={{ fontSize: 12 }}>{f.description}</Text>
                      </div>
                    ))
                }
                {selectedVisit.report && (
                  <Button block icon={<FilePdfOutlined />} style={{ marginTop: 12 }}>تحميل تقرير الزيارة</Button>
                )}
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* ── Schedule New Visit Modal ── */}
      <Modal open={scheduleModalOpen} onCancel={() => setScheduleModalOpen(false)} width={500}
        title={<Space><CalendarOutlined style={{ color: PRIMARY }} /><Text strong>جدولة زيارة صيانة جديدة</Text></Space>}
        okText="تأكيد الجدولة" cancelText="إلغاء"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}>
          {[
            { label: 'العقد', content: <Tag color="success">{activeContract?.contractNo} — {activeContract?.vendor}</Tag> },
            { label: 'نوع الزيارة', content: (
              <div style={{ display: 'flex', gap: 8 }}>
                {['صيانة ربع سنوية', 'صيانة سنوية', 'زيارة إضافية', 'زيارة طارئة'].map(t => (
                  <Button key={t} size="small" style={{ fontSize: 11 }}>{t}</Button>
                ))}
              </div>
            )},
            { label: 'التاريخ المقترح', content: <Button size="small" icon={<CalendarOutlined />}>اختيار التاريخ</Button> },
            { label: 'الفني المسؤول', content: (
              <div style={{ display: 'flex', gap: 8 }}>
                {['المهندس سالم الكعبي', 'المهندس محمد الزعابي', 'المهندس أحمد الفلاحي'].map(t => (
                  <Button key={t} size="small" style={{ fontSize: 10 }}>{t}</Button>
                ))}
              </div>
            )},
            { label: 'ملاحظات', content: <div style={{ height: 32, border: '1px solid #d9d9d9', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#bbb' }}>أضف ملاحظات...</div> },
          ].map((row, i) => (
            <div key={i}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>{row.label}</Text>
              {row.content}
            </div>
          ))}
        </div>
      </Modal>

    </div>
  );

  // ── Civil Defense CoC Tab ─────────────────────────────────────────
  const [renewalModalOpen, setRenewalModalOpen] = React.useState(false);
  const [selectedCoc, setSelectedCoc] = React.useState<any>(null);
  const [cocMode, setCocMode] = React.useState<'add' | 'renew'>('renew');
  // live civil defence certificates (GET /cd-certificates?buildingId) in the shape this tab uses
  const [cdLive, setCdLive] = React.useState<any[] | null>(null);
  const [cdInspector, setCdInspector] = React.useState<{ name?: string; phone?: string; dept?: string } | null>(null);
  useEffect(() => {
    if (!buildingId) return;
    api<Paged<any>>('/cd-certificates', { query: { buildingId, pageSize: 0 } })
      .then(async r => {
        const rows = r.items.map((c: any) => {
          const inRenewal = c.renewal?.status === 'in_progress';
          return {
            id: c.certificateNo || (c.status === 'pending' ? `طلب جديد #${c.id}` : `CD-${c.id}`), dbId: c.id, type: c.certTypeLabel ?? c.certType, licenseNo: c.licenseNo ?? '', issuedBy: c.issuedBy ?? '—',
            issueDate: c.issueDate ?? '', expiryDate: c.expiryDate ?? '', scope: c.scope ?? '—', inspector: c.inspectorName ?? '', inspectionDate: c.inspectionDate ?? '',
            notes: c.notes ?? '', documents: [] as string[],
            status: inRenewal ? 'renewal_in_progress' : c.status === 'valid' ? ((c.daysToExpiry ?? 1) < 0 ? 'expired' : 'active') : c.status,
            renewalStep: inRenewal ? c.renewal.currentStep ?? 1 : 0, renewalId: inRenewal ? c.renewal.id : null,
          };
        });
        setCdLive(rows);
        const cur = rows.find(x => x.renewalId) ?? rows.find(x => x.status === 'active');
        let insp: { name?: string; phone?: string; dept?: string } = { name: cur?.inspector || undefined };
        if (cur?.renewalId) {
          try {
            const d = await api<any>(`/cd-certificates/${cur.dbId}`);
            const rn = (d.renewals ?? []).map((x: any) => x.renewal).find((x: any) => x.id === cur.renewalId);
            if (rn) insp = { name: rn.inspectorName ?? insp.name, phone: rn.inspectorPhone, dept: rn.inspectorDept };
          } catch { /* keep the certificate inspector */ }
        }
        setCdInspector(insp);
      })
      .catch(() => setCdLive([]));
  }, [buildingId, liveKey]);
  const cdCerts: any[] = buildingId ? (cdLive ?? []) : building.civilDefense.certificates;

  const cocStatusMap: Record<string, { color: string; label: string; bg: string; icon: React.ReactNode }> = {
    active:              { color: '#52c41a', label: 'سارية',            bg: '#f6ffed', icon: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    expired:             { color: '#ff4d4f', label: 'منتهية الصلاحية',  bg: '#fff1f0', icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> },
    renewal_in_progress: { color: '#1677ff', label: 'قيد التجديد',      bg: '#e6f4ff', icon: <ClockCircleOutlined style={{ color: '#1677ff' }} /> },
    pending:             { color: '#fa8c16', label: 'معلقة',            bg: '#fff7e6', icon: <ClockCircleOutlined style={{ color: '#fa8c16' }} /> },
  };

  const renewalSteps = [
    { title: 'تقديم الطلب',        description: 'رفع نموذج طلب التجديد للدفاع المدني',          icon: <SolutionOutlined /> },
    { title: 'دفع الرسوم',         description: 'سداد رسوم الفحص والشهادة',                      icon: <CreditCardOutlined /> },
    { title: 'جدولة الفحص',        description: 'تحديد موعد الفحص الميداني مع المفتش',           icon: <CalendarOutlined /> },
    { title: 'الفحص الميداني',     description: 'زيارة المفتش وفحص منظومة الغاز',               icon: <AuditOutlined /> },
    { title: 'معالجة الملاحظات',   description: 'تصحيح أي ملاحظات أو مخالفات (إن وُجدت)',       icon: <ToolOutlined /> },
    { title: 'إصدار الشهادة',      description: 'استلام شهادة المطابقة الجديدة من الدفاع المدني', icon: <FileDoneOutlined /> },
  ];

  const activeCoc    = cdCerts.find((c: any) => c.status === 'active');
  const inProgressCoc = cdCerts.find((c: any) => c.status === 'renewal_in_progress');
  const allCocs      = [...cdCerts].sort((a: any, b: any) => (b.issueDate || '9999').localeCompare(a.issueDate || '9999'));

  // Days until expiry
  const daysUntilExpiry = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / 86400000);
  };
  const activeDays = activeCoc ? daysUntilExpiry(activeCoc.expiryDate) : null;
  const lastInspectionDate = cdCerts.map((c: any) => c.inspectionDate).filter(Boolean).sort().at(-1);
  const renewalBase = activeCoc ?? inProgressCoc;
  const cd = buildingId ? {
    lastInspection: lastInspectionDate || '—',
    nextRenewalDue: renewalBase?.expiryDate ? new Date(new Date(renewalBase.expiryDate).getTime() - 90 * 86400000).toISOString().slice(0, 10) : '—',
    inspector: cdInspector?.name || 'لم يحدد المفتش بعد', inspectorDept: cdInspector?.dept || 'الدفاع المدني', inspectorPhone: cdInspector?.phone || '—',
  } : building.civilDefense;
  const openCoc = (c: any, mode: 'add' | 'renew' = 'renew') => { setCocMode(mode); setSelectedCoc(c); setRenewalModalOpen(true); };

  const civilDefenseTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Status Banner ── */}
      {activeCoc && (
        <Card bordered={false} style={{ borderRadius: 12,
          background: activeDays !== null && activeDays < 90 ? (activeDays < 30 ? '#fff1f0' : '#fff7e6') : '#f6ffed',
          border: `1.5px solid ${activeDays !== null && activeDays < 90 ? (activeDays < 30 ? '#ff4d4f' : '#fa8c16') : '#52c41a'}` }}>
          <Row align="middle" gutter={[16, 12]}>
            <Col xs={24} md={14}>
              <Space align="start" size={16}>
                <div style={{ fontSize: 40, color: activeDays !== null && activeDays < 30 ? '#ff4d4f' : '#52c41a' }}>
                  <SafetyCertificateOutlined />
                </div>
                <div>
                  <Text strong style={{ fontSize: 15, display: 'block' }}>{activeCoc.type}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>رقم الرخصة: {activeCoc.licenseNo}</Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="success" style={{ fontSize: 12 }}>سارية</Tag>
                    {activeDays !== null && activeDays < 90 && (
                      <Tag color={activeDays < 30 ? 'error' : 'warning'} style={{ fontSize: 12 }}>
                        {activeDays < 0 ? 'منتهية' : `تنتهي خلال ${activeDays} يوم`}
                      </Tag>
                    )}
                  </div>
                </div>
              </Space>
            </Col>
            <Col xs={24} md={10}>
              <Row gutter={[8, 8]}>
                {[
                  { label: 'تاريخ الإصدار',   value: activeCoc.issueDate },
                  { label: 'تاريخ الانتهاء',  value: activeCoc.expiryDate },
                  { label: 'جهة الإصدار',     value: activeCoc.issuedBy },
                  { label: 'المفتش',           value: activeCoc.inspector },
                ].map((f, i) => (
                  <Col span={12} key={i}>
                    <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{f.label}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 500 }}>{f.value}</Text>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>
          {activeDays !== null && activeDays < 90 && !inProgressCoc && (
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 12 }}>
              <Space>
                <AlertOutlined style={{ color: '#fa8c16' }} />
                <Text style={{ fontSize: 12, color: '#fa8c16' }}>
                  {activeDays < 30
                    ? 'تنبيه: الشهادة على وشك الانتهاء — يُنصح ببدء التجديد فوراً'
                    : 'تذكير: يُنصح ببدء إجراءات التجديد قبل 90 يوماً من انتهاء الصلاحية'}
                </Text>
                <Button size="small" type="primary" danger={activeDays < 30}
                  icon={<AuditOutlined />}
                  onClick={() => openCoc(activeCoc)}>
                  بدء التجديد
                </Button>
              </Space>
            </div>
          )}
        </Card>
      )}

      {/* ── Renewal In Progress ── */}
      {inProgressCoc && (
        <Card bordered={false} style={{ borderRadius: 12, border: '1.5px solid #1677ff', background: '#f0f7ff' }}
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#1677ff' }} />
              <Text strong style={{ color: '#1677ff' }}>التجديد جاري — {inProgressCoc.id}</Text>
              <Tag color="blue">الخطوة {inProgressCoc.renewalStep} من {renewalSteps.length}</Tag>
            </Space>
          }
          extra={
            <Button size="small" icon={<EditOutlined />}
              onClick={() => openCoc(inProgressCoc)}>
              تحديث الحالة
            </Button>
          }
        >
          <Steps
            current={inProgressCoc.renewalStep - 1}
            size="small"
            style={{ marginBottom: 8 }}
            items={renewalSteps.map((s, i) => ({
              title: <span style={{ fontSize: 12 }}>{s.title}</span>,
              description: <span style={{ fontSize: 11, color: '#888' }}>{i < inProgressCoc.renewalStep - 1 ? '✓ مكتملة' : i === inProgressCoc.renewalStep - 1 ? 'جارية' : ''}</span>,
              icon: s.icon,
            }))}
          />
          {inProgressCoc.notes && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(22,119,255,0.06)', borderRadius: 8 }}>
              <Text style={{ fontSize: 12 }}><BellOutlined style={{ marginInlineEnd: 6, color: '#1677ff' }} />{inProgressCoc.notes}</Text>
            </div>
          )}
        </Card>
      )}

      {buildingId && cdLive !== null && cdCerts.length === 0 && (
        <Card bordered={false} style={{ borderRadius: 12, border: '1.5px dashed #ff4d4f', background: '#fff8f8' }}>
          <Space align="center" size={16} wrap>
            <SafetyCertificateOutlined style={{ fontSize: 36, color: '#ff4d4f' }} />
            <div>
              <Text strong style={{ fontSize: 14, display: 'block' }}>لا توجد شهادة دفاع مدني مسجلة لهذا المبنى</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>سجّل الشهادة الحالية لمتابعة تاريخ انتهائها وتنبيهات التجديد</Text>
            </div>
            <Button type="primary" icon={<AuditOutlined />} onClick={() => openCoc(null, 'add')}>طلب شهادة جديدة</Button>
          </Space>
        </Card>
      )}

      {/* ── Summary Stats ── */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'إجمالي الشهادات', value: cdCerts.length, color: PRIMARY, bg: '#e8f5e9', icon: <AuditOutlined /> },
          { label: 'سارية حالياً',    value: cdCerts.filter((c: any) => c.status === 'active').length, color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
          { label: 'قيد التجديد',     value: cdCerts.filter((c: any) => c.status === 'renewal_in_progress').length, color: '#1677ff', bg: '#e6f4ff', icon: <ClockCircleOutlined /> },
          { label: 'منتهية الصلاحية', value: cdCerts.filter((c: any) => c.status === 'expired').length, color: '#ff4d4f', bg: '#fff1f0', icon: <ExclamationCircleOutlined /> },
          { label: 'آخر فحص',         value: cd.lastInspection, color: '#888', bg: '#fafafa', icon: <CalendarOutlined />, text: true },
          { label: 'موعد التجديد',    value: cd.nextRenewalDue, color: '#fa8c16', bg: '#fff7e6', icon: <CalendarOutlined />, text: true },
        ].map((s: any, i) => (
          <Col xs={12} sm={8} md={4} key={i}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 18, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                  <div style={{ fontSize: s.text ? 11 : 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Certificates History Table ── */}
      <Card bordered={false} style={{ borderRadius: 10 }}
        title={<Text strong><FileDoneOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />سجل شهادات الدفاع المدني</Text>}
        extra={
          <Space>
            <Button size="small" icon={<PlusOutlined />} onClick={() => openCoc(null, 'add')}>شهادة جديدة</Button>
            <Button size="small" type="primary" ghost icon={<AuditOutlined />}
              onClick={() => inProgressCoc ? openCoc(inProgressCoc) : (activeCoc ?? allCocs[0]) ? openCoc(activeCoc ?? allCocs[0]) : openCoc(null, 'add')}>
              بدء تجديد / طلب جديد
            </Button>
          </Space>
        }
      >
        <Table size="small" rowKey="id" pagination={false}
          dataSource={allCocs}
          expandable={{
            expandedRowRender: (r: any) => buildingId && r.dbId ? <CocCertificateDetails key={`${r.dbId}-${liveKey}`} dbId={r.dbId} /> : (
              <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 8 }}>
                <Row gutter={[16, 8]}>
                  <Col xs={24} md={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>النطاق: </Text>
                    <Text style={{ fontSize: 12 }}>{r.scope}</Text>
                  </Col>
                  <Col xs={24} md={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>المفتش: </Text>
                    <Text style={{ fontSize: 12 }}>{r.inspector || '—'} · تاريخ الفحص: {r.inspectionDate || '—'}</Text>
                  </Col>
                  {r.notes && (
                    <Col span={24}>
                      <Text type="secondary" style={{ fontSize: 11 }}>ملاحظات: </Text>
                      <Text style={{ fontSize: 12 }}>{r.notes}</Text>
                    </Col>
                  )}
                  <Col span={24}>
                    <Space>
                      {r.documents.length > 0
                        ? r.documents.map((d: string, i: number) => (
                          <Button key={i} size="small" icon={<FilePdfOutlined />} style={{ fontSize: 11 }}>{d}</Button>
                        ))
                        : <Text type="secondary" style={{ fontSize: 11 }}>لا توجد وثائق مرفقة</Text>
                      }
                      {!buildingId && <Button size="small" icon={<PlusOutlined />} style={{ fontSize: 11 }}>إرفاق وثيقة</Button>}
                    </Space>
                  </Col>
                </Row>
              </div>
            ),
          }}
          columns={[
            { title: 'رقم الشهادة', dataIndex: 'id', render: (v: string) => <a style={{ fontSize: 12, color: PRIMARY }}>{v}</a> },
            { title: 'تاريخ الإصدار', dataIndex: 'issueDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
            { title: 'تاريخ الانتهاء', dataIndex: 'expiryDate', render: (v: string, r: any) => {
              const days = daysUntilExpiry(v);
              return (
                <Space>
                  <Text style={{ fontSize: 12 }}>{v}</Text>
                  {r.status === 'active' && days < 90 && (
                    <Tag color={days < 30 ? 'error' : 'warning'} style={{ fontSize: 10 }}>
                      {days < 0 ? 'منتهية' : `${days} يوم`}
                    </Tag>
                  )}
                </Space>
              );
            }},
            { title: 'رقم الرخصة', dataIndex: 'licenseNo', render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
            { title: 'الحالة', dataIndex: 'status', render: (v: string) => (
              <Tag color={cocStatusMap[v]?.color} style={{ fontSize: 11 }}>
                {cocStatusMap[v]?.icon} {cocStatusMap[v]?.label}
              </Tag>
            )},
            { title: 'تقدم التجديد', dataIndex: 'renewalStep', render: (v: number, r: any) => (
              r.status === 'renewal_in_progress'
                ? <div style={{ width: 120 }}>
                    <div style={{ fontSize: 11, color: '#1677ff', marginBottom: 2 }}>خطوة {v} من {renewalSteps.length}</div>
                    <div style={{ height: 5, background: '#e6f4ff', borderRadius: 3 }}>
                      <div style={{ height: 5, borderRadius: 3, width: `${(v / renewalSteps.length) * 100}%`, background: '#1677ff' }} />
                    </div>
                  </div>
                : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
            )},
            { title: '', render: (_: any, r: any) => (
              <Button size="small" type="link" style={{ padding: 0, fontSize: 11 }}
                onClick={() => openCoc(r)}>
                {r.status === 'renewal_in_progress' ? 'تحديث التجديد' : r.status === 'active' ? 'بدء التجديد' : 'عرض'}
              </Button>
            )},
          ]} />
      </Card>

      {/* ── Inspector Contact ── */}
      <Card size="small" bordered={false} style={{ borderRadius: 10, background: '#fafafa' }}>
        <Row align="middle" gutter={[12, 0]}>
          <Col>
            <Avatar icon={<UserOutlined />} style={{ background: '#1677ff' }} />
          </Col>
          <Col flex="1">
            <Text strong style={{ fontSize: 13, display: 'block' }}>{cd.inspector}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{cd.inspectorDept}</Text>
          </Col>
          <Col>
            <Space>
              <Button size="small" icon={<PhoneOutlined />} disabled={!cd.inspectorPhone || cd.inspectorPhone === '—'} href={cd.inspectorPhone && cd.inspectorPhone !== '—' ? `tel:${cd.inspectorPhone}` : undefined}>{cd.inspectorPhone}</Button>
              <Button size="small" type="primary" ghost icon={<CalendarOutlined />}
                onClick={() => inProgressCoc ? openCoc(inProgressCoc) : activeCoc ? openCoc(activeCoc) : openCoc(null, 'add')}>جدولة فحص</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Renewal Stepper Modal ── */}
      <CocRenewalModal open={renewalModalOpen} mode={cocMode} coc={selectedCoc} buildingId={buildingId}
        onClose={() => setRenewalModalOpen(false)} onChanged={() => setLiveKey(k => k + 1)} />

    </div>
  );

  // ── Refill Requests Tab ────────────────────────────────────────────
  const refillStatusMap: Record<string, { color: string; label: string }> = {
    requested:       { color: 'orange',     label: 'طلب مقدم' },
    po_issued:       { color: 'blue',       label: 'أمر شراء' },
    paid:            { color: 'cyan',       label: 'تم الدفع' },
    collecting:      { color: 'purple',     label: 'استلام الغاز' },
    invoiced:        { color: 'geekblue',   label: 'تم الإفوترة' },
    scheduled:       { color: 'processing', label: 'مجدول' },
    delivering:      { color: 'magenta',    label: 'قيد التوصيل' },
    pending_approval:{ color: 'gold',       label: 'انتظار الموافقة' },
    completed:       { color: 'green',      label: 'مكتمل' },
  };
  const refillPriorityMap: Record<string, { color: string; label: string }> = {
    low:    { color: 'default', label: 'منخفض' },
    medium: { color: 'blue',    label: 'متوسط' },
    high:   { color: 'orange',  label: 'عالي' },
    urgent: { color: 'red',     label: 'عاجل' },
  };
  const STAGE_LABELS = ['طلب التعبئة','أمر الشراء','الدفع','استلام الغاز','الفاتورة','جدولة','تعبئة الخزان','موافقة الإدارة','مكتمل'];

  const completedRefills = refillRequests.filter(r => r.status === 'completed');
  const activeRefills    = refillRequests.filter(r => r.status !== 'completed');
  const totalDelivered   = completedRefills.reduce((s, r) => s + (r.deliveredQty || 0), 0);

  const openRefill = (r: RefillRequestItem) => { setSelectedRefill(r); setRefillDrawerOpen(true); };

  const refillTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary Cards */}
      <Row gutter={[12, 12]}>
        {[
          { label: 'إجمالي الطلبات', value: refillRequests.length, color: PRIMARY, bg: '#e8f5e9', icon: <DatabaseOutlined /> },
          { label: 'نشطة / قيد التنفيذ', value: activeRefills.length, color: '#fa8c16', bg: '#fff7e6', icon: <ClockCircleOutlined /> },
          { label: 'مكتملة', value: completedRefills.length, color: '#52c41a', bg: '#f6ffed', icon: <CheckCircleOutlined /> },
          { label: 'إجمالي الكمية المسلمة', value: totalDelivered.toLocaleString(), suffix: ' و/م³', color: '#1677ff', bg: '#e6f4ff', icon: <FireOutlined /> },
        ].map((s: any, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card size="small" bordered={false} style={{ borderRadius: 10, background: s.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: '#888' }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}{s.suffix || ''}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Active Requests */}
      {activeRefills.length > 0 && (
        <Card size="small" bordered={false} style={{ borderRadius: 10, border: '1.5px solid #fa8c16', background: '#fffbf0' }}
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
              <Text strong style={{ color: '#fa8c16' }}>طلبات نشطة — اضغط على الطلب لمتابعة مراحله</Text>
              <Tag color="orange">{activeRefills.length}</Tag>
            </Space>
          }
          extra={
            <Button size="small" type="primary" style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
              onClick={() => setNewRefillOpen(true)}>
              + طلب تعبئة جديد
            </Button>
          }
        >
          <Table size="small" rowKey="id" pagination={false}
            dataSource={activeRefills}
            onRow={r => ({ onClick: () => openRefill(r), style: { cursor: 'pointer' } })}
            columns={[
              { title: 'رقم الطلب', dataIndex: 'id', render: (v: string, r: any) => <a style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>{r.requestNo ?? v}</a> },
              { title: 'الخزان', dataIndex: 'tankLabel', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
              { title: 'المستوى الحالي', dataIndex: 'levelPct', render: (v: number, r: any) => (
                <div style={{ width: 100 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span>{r.currentLevel.toLocaleString()} {r.quantityUnit}</span>
                    <span style={{ color: v < 25 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>{v}%</span>
                  </div>
                  <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}>
                    <div style={{ height: 6, borderRadius: 3, width: `${v}%`, background: v < 25 ? '#ff4d4f' : v < 50 ? '#fa8c16' : '#52c41a' }} />
                  </div>
                </div>
              )},
              { title: 'الكمية المطلوبة', dataIndex: 'requestedQty', render: (v: number, r: any) => <Text style={{ fontSize: 12 }}>{v.toLocaleString()} {r.quantityUnit}</Text> },
              { title: 'الأولوية', dataIndex: 'priority', render: (v: string) => <Tag color={refillPriorityMap[v]?.color} style={{ fontSize: 11 }}>{refillPriorityMap[v]?.label}</Tag> },
              { title: 'المرحلة الحالية', dataIndex: 'stage', render: (v: number) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Tag color={refillStatusMap[refillRequests.find(r => r.stage === v && activeRefills.includes(r as any))?.status || 'requested']?.color || 'default'} style={{ fontSize: 11 }}>
                    {STAGE_LABELS[Math.min(v, 8)]}
                  </Tag>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[0,1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} style={{ width: 8, height: 4, borderRadius: 2, background: i < v ? '#52c41a' : i === v ? PRIMARY : '#e0e0e0' }} />
                    ))}
                  </div>
                </div>
              )},
              { title: 'تاريخ الطلب', dataIndex: 'requestDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
            ]} />
        </Card>
      )}

      {/* All Requests History */}
      <Card size="small" bordered={false} style={{ borderRadius: 10 }}
        title={<Text strong><ClockCircleOutlined style={{ marginInlineEnd: 6, color: PRIMARY }} />سجل طلبات التعبئة</Text>}
        extra={
          <Button size="small" type="primary" ghost onClick={() => setNewRefillOpen(true)}>
            + طلب تعبئة جديد
          </Button>
        }
      >
        <Table size="small" rowKey="id" pagination={{ pageSize: 8, size: 'small' }}
          dataSource={[...refillRequests].sort((a, b) => b.requestDate.localeCompare(a.requestDate))}
          onRow={r => ({ onClick: () => openRefill(r), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'رقم الطلب', dataIndex: 'id', render: (v: string, r: any) => <a style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>{r.requestNo ?? v}</a> },
            { title: 'التاريخ', dataIndex: 'requestDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
            { title: 'الخزان', dataIndex: 'tankLabel', render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
            { title: 'الكمية المطلوبة', dataIndex: 'requestedQty', render: (v: number, r: any) => <Text style={{ fontSize: 12 }}>{v.toLocaleString()} {r.quantityUnit}</Text> },
            { title: 'الكمية المسلمة', dataIndex: 'deliveredQty', render: (v: number, r: any) => (
              <Text style={{ fontSize: 12, color: v ? '#52c41a' : '#bbb' }}>
                {v ? `${v.toLocaleString()} ${r.quantityUnit}` : '—'}
              </Text>
            )},
            { title: 'الأولوية', dataIndex: 'priority', render: (v: string) => <Tag color={refillPriorityMap[v]?.color} style={{ fontSize: 11 }}>{refillPriorityMap[v]?.label}</Tag> },
            { title: 'المورد', dataIndex: 'stageData', render: (_: any, r: RefillRequestItem) => <Text style={{ fontSize: 12 }}>{r.stageData?.po?.supplier || '—'}</Text> },
            { title: 'تاريخ الاكتمال', dataIndex: 'completedDate', render: (v: string) => <Text style={{ fontSize: 12 }}>{v || '—'}</Text> },
            { title: 'الحالة', dataIndex: 'status', render: (v: string) => <Tag color={refillStatusMap[v]?.color} style={{ fontSize: 11 }}>{refillStatusMap[v]?.label}</Tag> },
          ]} />
      </Card>
    </div>
  );

  const activityTypeConfig: Record<string, { color: string; dot?: React.ReactNode }> = {
    warning: { color: '#fa8c16', dot: <ExclamationCircleOutlined style={{ color: '#fa8c16' }} /> },
    info:    { color: '#1677ff', dot: <BellOutlined style={{ color: '#1677ff' }} /> },
    success: { color: '#52c41a', dot: <CheckCircleOutlined style={{ color: '#52c41a' }} /> },
    error:   { color: '#ff4d4f', dot: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> },
  };
  const activityTab = (
    <Card bordered={false} style={{ borderRadius: 12 }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 16 }}>
        <ClockCircleOutlined style={{ marginInlineEnd: 8, color: PRIMARY }} />سجل النشاط والأحداث
      </Text>
      <Timeline
        items={building.activity.map(a => ({
          color: activityTypeConfig[a.type]?.color || '#1677ff',
          dot: activityTypeConfig[a.type]?.dot,
          children: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <Text style={{ fontSize: 13 }}>{a.action}</Text>
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{a.date}</Text>
            </div>
          ),
        }))}
      />
    </Card>
  );

  const tabs = [
    { key: 'overview', label: <span><BarChartOutlined /> نظرة عامة</span>,
      children: buildingId ? <BuildingOverviewLive key={liveKey} buildingId={buildingId} live={live} onGoTo={setActiveTab} /> : overviewTab },
    { key: 'units', label: <span><ApartmentOutlined /> الوحدات ({live ? live.stats.units : building.units.length})</span>,
      children: buildingId
        ? <BuildingFloorPlan buildingId={buildingId} buildingName={hd.name} totalFloors={live?.totalFloors} onChanged={() => setLiveKey(k => k + 1)} />
        : unitsTab },
    { key: 'meters', label: <span><FireOutlined /> العدادات ({live ? live.stats.meters ?? 0 : building.meters.length})</span>,
      children: buildingId
        ? <BuildingMetersTab buildingId={buildingId} buildingName={hd.name} canManage={canManageBuilding} onChanged={() => setLiveKey(k => k + 1)} />
        : metersTab },
    { key: 'tenants', label: <span><TeamOutlined /> المستأجرون ({live ? live.stats.activeContracts ?? 0 : building.tenants.length})</span>,
      children: buildingId
        ? <BuildingTenantsTab buildingId={buildingId} buildingName={hd.name} canManage={canManageBuilding} onChanged={() => setLiveKey(k => k + 1)} />
        : tenantsTab },
    // Restaurants & Villas module (additive tabs)
    ...(villaId && buildingId ? [{ key: 'villaoverview', label: <span><BarChartOutlined /> نظرة عامة</span>,
      children: <VillaOverview villaId={villaId} buildingId={buildingId} live={live} reloadKey={liveKey} onGoTo={setActiveTab} /> }] : []),
    ...(villaId ? [{ key: 'villa', label: <span><HomeOutlined /> الفيلا والعقد</span>,
      children: <VillaSiteTab villaId={villaId} onGoTo={setActiveTab} onChanged={() => setLiveKey(k => k + 1)} /> }] : []),
    ...(buildingId ? [{ key: 'restaurants', label: <span><RestaurantTabIcon /> المطاعم</span>,
      children: <BuildingRestaurantsTab buildingId={buildingId} isVilla={(live as any)?.type === 'villa'} /> }] : []),
    { key: 'contracts', label: <span><SafetyCertificateOutlined /> عقود الغاز ({amcList.length + supplyList.length})</span>, children: contractsTab },
    { key: 'visits', label: <span><CalendarOutlined style={{ color: '#1677ff' }} /> زيارات الصيانة ({buildingId ? opsCounts?.visits ?? 0 : building.scheduledVisits.length})</span>,
      children: villaId && buildingId ? <SiteVisitsTab premisesId={villaId} buildingId={buildingId} reloadKey={liveKey} />
        : buildingId ? <BuildingVisitsTab buildingId={buildingId} reloadKey={liveKey} /> : scheduledVisitsTab },
    { key: 'financials', label: <span><DollarOutlined /> الفواتير والمالية</span>,
      children: buildingId ? <BuildingFinanceLive key={liveKey} buildingId={buildingId} /> : financialsTab },
    { key: 'info', label: <span><BankOutlined /> معلومات المبنى</span>, children: infoTab },
    { key: 'owners', label: <span><TeamOutlined /> الملاك ({live ? live.owners.length : building.owners.length})</span>,
      children: buildingId ? <BuildingOwnersLive buildingId={buildingId} owners={(live?.owners ?? []) as any[]} canManage={canManageBuilding} onChanged={() => setLiveKey(k => k + 1)} /> : ownersTab },
    { key: 'tanks', label: <span><DatabaseOutlined /> الخزانات ({live ? live.tanks.length : building.tanks.length})</span>,
      children: buildingId ? <BuildingTanksYard buildingId={buildingId} canManage={canManageBuilding} reloadKey={liveKey} /> : tanksTab },
    { key: 'refill', label: <span><FireOutlined style={{ color: '#fa8c16' }} /> طلبات التعبئة ({refillRequests.length})</span>, children: refillTab },
    { key: 'service', label: <span><ToolOutlined /> طلبات الخدمة ({buildingId ? opsCounts?.service ?? 0 : building.serviceRequests.length})</span>,
      // villa mode: open service requests here, only with a valid maintenance (AMC) contract (Restaurants & Villas)
      children: villaId && buildingId ? <VillaServiceTab villaId={villaId} buildingId={buildingId} reloadKey={liveKey} onChanged={() => setLiveKey(k => k + 1)} onGoTo={setActiveTab} />
        : buildingId ? <BuildingServiceRequestsTab buildingId={buildingId} reloadKey={liveKey} /> : serviceTab },
    { key: 'docs', label: <span><FileTextOutlined /> الوثائق ({buildingId ? docCount ?? '…' : building.documents.length})</span>,
      children: buildingId ? <BuildingDocsLive buildingId={buildingId} branchId={(live as any)?.branchId} canManage={can('documents.manage')} onCount={setDocCount} /> : docsTab },
    { key: 'civildefense', label: <span><AuditOutlined style={{ color: '#1677ff' }} /> الدفاع المدني (CoC)</span>,
      children: civilDefenseTab },
    { key: 'activity', label: <span><ClockCircleOutlined /> سجل النشاط</span>,
      children: buildingId ? <BuildingActivityLive key={liveKey} buildingId={buildingId} /> : activityTab },
  ];

  // ── Grouped navigation: 5 main groups, each with its own sub-tabs ──
  const tabByKey = Object.fromEntries(tabs.map(t => [t.key, t]));
  const counts: Record<string, number> = {
    units: live ? live.stats.units : building.units.length,
    meters: live ? live.stats.meters ?? 0 : building.meters.length, tenants: live ? live.stats.activeContracts ?? 0 : building.tenants.length,
    contracts: amcList.length + supplyList.length,
    tanks: live ? live.tanks.length : building.tanks.length, refill: refillRequests.length,
    visits: buildingId ? opsCounts?.visits ?? 0 : building.scheduledVisits.length,
    service: buildingId ? opsCounts?.service ?? 0 : building.serviceRequests.length,
    owners: live ? live.owners.length : building.owners.length, docs: buildingId ? docCount ?? 0 : building.documents.length,
  };
  const groups = villaId ? [
    { key: 'g-overview', label: 'نظرة عامة', icon: <BarChartOutlined />, tabs: ['villaoverview'] },
    { key: 'g-villa', label: 'الفيلا', icon: <HomeOutlined />, tabs: ['villa'] },
    { key: 'g-finance', label: 'العقود والمالية', icon: <FileTextOutlined />, tabs: ['contracts', 'financials'] },
    { key: 'g-ops', label: 'الخزان والخدمات', icon: <ToolOutlined />, tabs: ['tanks', 'refill', 'visits', 'service', 'civildefense'] },
    { key: 'g-building', label: 'البيانات والوثائق', icon: <BankOutlined />, tabs: ['info', 'owners', 'docs', 'activity'] },
  ] : [
    { key: 'g-overview', label: 'نظرة عامة', icon: <BarChartOutlined />, tabs: ['overview'] },
    { key: 'g-units', label: 'الوحدات والسكان', icon: <ApartmentOutlined />, tabs: ['units', 'meters', 'tenants', ...(buildingId ? ['restaurants'] : [])] },
    { key: 'g-finance', label: 'العقود والمالية', icon: <FileTextOutlined />, tabs: ['contracts', 'financials'] },
    { key: 'g-ops', label: 'التشغيل والصيانة', icon: <ToolOutlined />, tabs: ['tanks', 'refill', 'visits', 'service', 'civildefense'] },
    { key: 'g-building', label: 'المبنى والوثائق', icon: <BankOutlined />, tabs: ['info', 'owners', 'docs', 'activity'] },
  ];
  const activeGroup = groups.find(g => g.tabs.includes(activeTab)) ?? groups[0];
  const groupCount = (g: typeof groups[number]) => g.tabs.reduce((n, k) => n + (counts[k] ?? 0), 0);

  useTrackView('Building', buildingId, hd?.name);
  return (
    <div style={{ padding: '0 0 24px' }}>
      {header}
      {canManageBuilding && <EditBuildingModal buildingId={editOpen ? buildingId! : null} onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); setLiveKey(k => k + 1); }} />}
      <style>{`
        .bp-nav { background: #fff; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); margin-bottom: 12px; }
        .bp-groups { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; }
        .bp-group { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; border: none; background: transparent;
          font-family: inherit; font-size: 13px; font-weight: 600; color: #444; cursor: pointer; transition: background .15s, color .15s; }
        .bp-group:hover { background: #f3f7f3; color: #1a5c2a; }
        .bp-group.on { background: linear-gradient(135deg, #1a5c2a, #0b2e18); color: #c9a84c; box-shadow: 0 2px 6px rgba(26,92,42,.3); }
        .bp-group .n { font-size: 11px; opacity: .7; }
        .bp-sub > .ant-tabs-nav { margin: 0 !important; padding: 0 20px; border-top: 1px solid #f0f0f0; }
        .bp-sub > .ant-tabs-nav::before { border-bottom: none !important; }
        .bp-sub .ant-tabs-tab { padding: 10px 2px; font-size: 13px; }
        .bp-sub .ant-tabs-tab-active .ant-tabs-tab-btn { font-weight: 700; }
        .bp-sub .cnt { color: #999; font-size: 12px; margin-inline-start: 4px; }
      `}</style>

      <div className="bp-nav">
        <div className="bp-groups" role="tablist">
          {groups.map(g => {
            const n = groupCount(g);
            return (
              <button key={g.key} type="button" role="tab" aria-selected={g === activeGroup}
                className={`bp-group${g === activeGroup ? ' on' : ''}`}
                onClick={() => { if (g !== activeGroup) setActiveTab(g.tabs[0]); }}>
                {g.icon}{g.label}{n > 0 && <span className="n">{n}</span>}
              </button>
            );
          })}
        </div>
        {activeGroup.tabs.length > 1 && (
          <Tabs className="bp-sub" activeKey={activeTab} onChange={setActiveTab} tabBarGutter={22}
            items={activeGroup.tabs.map(k => ({ key: k, label: tabByKey[k].label, children: null }))} />
        )}
      </div>

      <div key={activeTab}>{tabByKey[activeTab]?.children ?? tabByKey.overview.children}</div>
      <AddAmcContractModal
        open={amcModalOpen}
        buildingId={buildingId}
        buildingName={hd.name}
        ownerName={building.owners?.[0]?.name}
        ownerPhone={building.owners?.[0]?.defaultPhone ?? undefined}
        ownerEmail={building.owners?.[0]?.defaultEmail ?? undefined}
        onClose={() => setAmcModalOpen(false)}
        onSave={(c) => { if (!buildingId) setAmcContracts(prev => [c, ...prev]); setAmcModalOpen(false); setLiveKey(k => k + 1); }}
      />
      <TenantProfileDrawer
        open={profileDrawerOpen}
        onClose={() => { setProfileDrawerOpen(false); setProfileTenant(null); }}
        tenant={profileTenant}
        buildingName={building.name}
        onOpenInvoices={() => { setProfileDrawerOpen(false); setInvoiceTenant(profileTenant); setInvoiceDrawerOpen(true); }}
      />
      <TenantInvoicesDrawer
        open={invoiceDrawerOpen}
        onClose={() => { setInvoiceDrawerOpen(false); setInvoiceTenant(null); }}
        tenant={invoiceTenant}
        buildingName={building.name}
      />
      <GasContractDrawer
        open={contractDrawerOpen}
        contract={selectedContract}
        buildingName={building.name}
        onClose={() => { setContractDrawerOpen(false); setSelectedContract(null); }}
      />
      <AddTenantModal
        open={addTenantOpen}
        onClose={() => setAddTenantOpen(false)}
        buildingUnits={building.units.map(u => ({ key: u.key, no: u.no, floor: u.floor, typeLabel: u.typeLabel, tenant: u.tenant ?? undefined })) as any}
        onAdd={(data) => { console.log('New tenant:', data); setAddTenantOpen(false); }}
      />
      <AddGasContractModal
        open={addContractOpen}
        onClose={() => { setAddContractOpen(false); setContractTenant(undefined); }}
        buildingUnits={building.units.map(u => ({ key: u.key, no: u.no, floor: u.floor, typeLabel: u.typeLabel, tenant: u.tenant ?? undefined })) as any}
        tenants={building.tenants.map(t => ({ id: t.id, name: t.name, unit: t.unit }))}
        defaultTenantId={contractTenant}
        nextContractNo={`GC-${new Date().getFullYear()}-${String(building.tenants.length + 1).padStart(3, '0')}`}
        onSave={(data) => { console.log('Contract saved:', data); setAddContractOpen(false); setContractTenant(undefined); }}
      />
      <MeterServiceModal
        open={serviceMeter !== null && serviceType !== null}
        meter={serviceMeter}
        serviceType={serviceType}
        onClose={() => { setServiceMeter(null); setServiceType(null); }}
        onSave={(data) => { console.log('Service request:', data); setServiceMeter(null); setServiceType(null); }}
      />
      <MeterReadingModal
        open={readingMeter !== null}
        meter={readingMeter}
        onClose={() => setReadingMeter(null)}
        onSave={(data) => { console.log('Reading saved:', data); setReadingMeter(null); }}
      />
      <MeterDetailDrawer
        open={selectedMeter !== null}
        meter={selectedMeter}
        onClose={() => setSelectedMeter(null)}
      />
      <AddMeterModal
        open={addMeterOpen}
        onClose={() => setAddMeterOpen(false)}
        buildingUnits={building.units.map(u => ({
          key: u.key,
          no: u.no,
          floor: u.floor,
          typeLabel: u.typeLabel,
          tenant: u.tenant,
          meter: u.meter,
        })) as any}
        nextMeterId={`M-0${(building.meters.length + 26).toString().padStart(2, '0')}`}
        onAdd={(meter) => { console.log('New meter:', meter); }}
      />
      <AddUnitModal
        open={addUnitOpen}
        onClose={() => setAddUnitOpen(false)}
        buildingFloors={building.floors}
        existingUnitsCount={building.totalUnits}
        onAdd={(units) => {
          console.log('New units to add:', units);
        }}
      />
      {buildingId && (
        <UnitProfileDrawer unit={contractUnit} buildingName={hd.name} canManage={canManageBuilding} openAction={contractUnitAction}
          onClose={() => { setContractUnit(null); setContractUnitAction(null); }}
          onChanged={() => { setLiveKey(k => k + 1); contractUnit && unitsApi.get(contractUnit.id).then(setContractUnit).catch(() => undefined); }} />
      )}
      <Modal open={pickUnitOpen} title="عقد توريد جديد — اختر الوحدة" okText="متابعة" cancelText="إلغاء" okButtonProps={{ disabled: !pickUnitId }}
        onCancel={() => setPickUnitOpen(false)}
        onOk={() => { setPickUnitOpen(false); if (pickUnitId) openUnitFor(pickUnitId, 'tenant'); }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>الوحدات الشاغرة فقط — يُنشأ العقد مع المستأجر من ملف الوحدة (المستأجر، الرسوم، الشروط والأحكام، العداد).</Text>
        <Select style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="اختر وحدة شاغرة…" value={pickUnitId ?? undefined} onChange={setPickUnitId}
          notFoundContent="لا توجد وحدات شاغرة"
          options={pickUnits.filter(u => !u.contractId && u.isActive !== false).map(u => ({ value: u.id, label: `وحدة ${u.no}${u.floor != null ? ` — طابق ${u.floor}` : ''}${u.typeLabel ? ` — ${u.typeLabel}` : ''}` }))} />
      </Modal>
      <Modal open={!!renewTarget} okText="تجديد" cancelText="إلغاء" onOk={submitRenew} confirmLoading={renewBusy} onCancel={() => setRenewTarget(null)} destroyOnClose
        title={renewTarget?.kind === 'amc' ? `تجديد عقد الصيانة ${renewTarget?.c.contractNo ?? ''}` : `تجديد عقد التوريد ${renewTarget?.c.contractNo ?? ''}`}>
        <Form form={renewForm} layout="vertical">
          {renewTarget?.kind === 'supply' ? (
            <>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>ينتهي العقد الحالي في {renewTarget.c.endDate ?? '—'} — يُمدد بنفس الشروط والرسوم.</Text>
              <Form.Item name="months" label="مدة التجديد (أشهر)" rules={[{ required: true }]}><InputNumber min={1} max={60} style={{ width: '100%' }} /></Form.Item>
              <Form.Item name="newEndDate" label="أو تاريخ انتهاء محدد (اختياري)"><DatePicker style={{ width: '100%' }} /></Form.Item>
            </>
          ) : (
            <>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>يُنشأ عقد جديد بنفس مقدم الخدمة والعميل والنطاق والشروط وتكرار الزيارات، وتُولد الزيارات وجدول الدفعات للفترة الجديدة.</Text>
              <Space style={{ display: 'flex' }} wrap>
                <Form.Item name="startDate" label="بداية العقد الجديد" rules={[{ required: true }]}><DatePicker /></Form.Item>
                <Form.Item name="endDate" label="نهاية العقد الجديد" rules={[{ required: true }]}><DatePicker /></Form.Item>
              </Space>
              <Form.Item name="annualValue" label="القيمة السنوية (د.إ)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
            </>
          )}
        </Form>
      </Modal>
      <RefillRequestDrawer
        open={refillDrawerOpen}
        request={selectedRefill}
        onClose={() => { setRefillDrawerOpen(false); setSelectedRefill(null); }}
        live={!!buildingId}
        onUpdate={(updated) => {
          setRefillRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
          setSelectedRefill(updated);
        }}
      />
      <NewRefillRequestModal
        open={newRefillOpen}
        onClose={() => setNewRefillOpen(false)}
        onCreate={buildingId ? async (v) => {
          const r = await api<{ id: number }>('/refill-requests', { method: 'POST', body: v });
          const fresh = mapLiveRefill(await api<any>(`/refill-requests/${(r as any).id}`));
          setRefillRequests(prev => [fresh, ...prev]);
          setNewRefillOpen(false);
          setSelectedRefill(fresh);
          setRefillDrawerOpen(true);
        } : undefined}
        tanks={buildingId ? ((live?.tanks ?? []) as any[]).filter(t => t.isActive !== false).map(t => ({
          id: String(t.id), label: `${t.tankNo}${t.gasTypeName || t.gasType ? ` — ${t.gasTypeName ?? t.gasType}` : ''}`,
          currentLevel: Number(t.currentLevel ?? t.currentLevelLitres ?? 0), capacity: Number(t.capacityLitres ?? 0),
          levelPct: Math.round(Number(t.levelPct ?? 0)), unit: 'لتر',
        })) : (building.tanks ?? building.meters?.filter((m: any) => m.type === 'tank') ?? []).map((t: any) => ({
          id: t.id || t.key,
          label: t.label || t.name || t.id || t.key,
          currentLevel: t.currentLevel ?? t.reading ?? 0,
          capacity: t.capacity ?? 10000,
          levelPct: t.levelPct ?? Math.round(((t.currentLevel ?? t.reading ?? 0) / (t.capacity ?? 10000)) * 100),
          unit: t.unit || 'م³',
        }))}
        onSave={(req) => {
          setRefillRequests(prev => [req, ...prev]);
          setNewRefillOpen(false);
        }}
      />
    </div>
  );
};

export default BuildingProfile;
