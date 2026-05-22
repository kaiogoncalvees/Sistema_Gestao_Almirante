export interface MetricData {
  totalToPay: number;
  totalPaid: number;
  pendingCount: number;
  totalPending: number;
  next7Days: number;
  next7DaysCount: number;
}

export interface AccountsPayableEntry {
  dueDate: string; // Data de Vencimento
  scheduleDate: string; // Data de Programação
  creditor: string; // Credor
  description: string; // Descrição
  category: string; // Categoria
  costCenter: string; // Centro de Custo
  amount: number; // Valor
  paymentMethod: string; // Forma de Pagamento
  status: 'Pago' | 'A vencer' | 'Atrasado' | 'Pendente' | 'Programado' | 'A Programar';
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  status: 'paid' | 'pending' | 'overdue';
}

export interface SupplierData {
  name: string;
  billCount: number;
  totalAmount: number;
  status: 'active' | 'inactive';
}

export interface WeeklyData {
  weekStart: Date;
  weekEnd: Date;
  totalAmount: number;
  billCount: number;
  keyPayments: string[];
  label: string;
}

export interface WeeklyChartData {
  label: string;
  dateRange: string;
  total: number;
  count: number;
  topPayments: string[];
  // Cost center breakdown
  ilhaTotal: number;
  ilhaCount: number;
  ilhaBills: { creditor: string; amount: number }[];
  tropicalTotal: number;
  tropicalCount: number;
  tropicalBills: { creditor: string; amount: number }[];
}

export interface ChartDataPoint {
  month: string;
  amount: number;
}

export interface CostCenterComparison {
  ilha: number;
  tropical: number;
  ilhaPercentage: number;
  tropicalPercentage: number;
}

export type CostCenterFilter = 'Todos' | 'Ilha' | 'Tropical';
export type PeriodFilter = 'day' | 'week' | 'month' | 'year';
