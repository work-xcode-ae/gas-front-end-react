export interface MeterRecord {
  id: string;
  serial: string;
  unit: string;
  floor: number;
  type: string;
  typeLabel: string;
  status: string;
  statusLabel: string;
  installDate: string;
  lastRead: string;
  lastReadValue: number;
  monthlyAvg: number;
  balance: number;
  tenant: string | null;
  brand: string;
  calibrationDate: string;
}
