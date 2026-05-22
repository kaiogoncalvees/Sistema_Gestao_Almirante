import { 
  AccountsPayableEntry, 
  MetricData, 
  CategoryBreakdown, 
  SupplierData,
  WeeklyChartData,
  CostCenterComparison,
  CostCenterFilter
} from '@/types/accounts-payable';
import { 
  format, 
  startOfWeek, 
  addWeeks, 
  startOfMonth, 
  endOfMonth,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  isWithinInterval,
  addDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Parse Brazilian date format
const parseBrazilianDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length !== 3) return new Date();
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
};

// Filter data by cost center
export const filterDataByCostCenter = (
  data: AccountsPayableEntry[], 
  center: CostCenterFilter
): AccountsPayableEntry[] => {
  if (center === 'Todos') return data;
  return data.filter(entry => entry.costCenter === center);
};

// Filter data by time period
export const filterDataByPeriod = (
  data: AccountsPayableEntry[], 
  period: 'day' | 'week' | 'month' | 'year'
): AccountsPayableEntry[] => {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'day':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = addDays(startDate, 4); // Monday to Friday
      break;
    case 'month':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case 'year':
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      break;
    default:
      return data;
  }

  return data.filter(entry => {
    const dueDate = parseBrazilianDate(entry.dueDate);
    return isWithinInterval(dueDate, { start: startDate, end: endDate });
  });
};

export const calculateMetrics = (data: AccountsPayableEntry[]): MetricData => {
  console.log('\n=== CALCULATE METRICS DEBUG ===');
  console.log('Total entries received:', data.length);
  
  // Log all unique status values
  const allStatuses = [...new Set(data.map(entry => entry.status))];
  console.log('All unique status values:', allStatuses);
  
  // Cost center breakdown
  const costCenters = [...new Set(data.map(entry => entry.costCenter))];
  console.log('Cost centers:', costCenters);
  costCenters.forEach(center => {
    const centerCount = data.filter(e => e.costCenter === center).length;
    console.log(`  ${center}: ${centerCount} entries`);
  });
  
  // Total A Pagar: ALL bills that are NOT "Pago"
  const pendingEntries = data.filter(entry => entry.status !== 'Pago');
  const totalToPay = pendingEntries.reduce((sum, entry) => sum + entry.amount, 0);
  console.log('Total a Pagar:', totalToPay, 'from', pendingEntries.length, 'entries');

  // Total Pago: bills with status "Pago"
  const paidEntries = data.filter(entry => entry.status === 'Pago');
  console.log('\n=== PAID ENTRIES DEBUG ===');
  console.log('Entries with status "Pago":', paidEntries.length);
  if (paidEntries.length > 0) {
    console.log('First 3 paid entries:', paidEntries.slice(0, 3).map(e => ({
      creditor: e.creditor,
      amount: e.amount,
      status: e.status
    })));
  }
  
  const totalPaid = paidEntries.reduce((sum, entry) => sum + entry.amount, 0);
  console.log('Total Pago:', totalPaid);
  
  // Próximos 7 Dias: Unpaid bills due in next 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next7Days = new Date(today);
  next7Days.setDate(today.getDate() + 7);
  
  const next7DaysEntries = data.filter(entry => {
    if (entry.status === 'Pago') return false;
    const dueDate = parseBrazilianDate(entry.dueDate);
    return dueDate >= today && dueDate <= next7Days;
  });
  
  const next7DaysTotal = next7DaysEntries.reduce((sum, entry) => sum + entry.amount, 0);
  console.log('\n=== PRÓXIMOS 7 DIAS ===');
  console.log('Bills in next 7 days:', next7DaysEntries.length);
  console.log('Total próximos 7 dias:', next7DaysTotal);
  
  // Pending count and total
  const pendingCount = pendingEntries.length;
  const totalPending = totalToPay;
  
  console.log('\n=== FINAL METRICS ===');
  console.log('Total A Pagar:', totalToPay);
  console.log('Total Pago:', totalPaid);
  console.log('Próximos 7 Dias:', next7DaysTotal);
  console.log('=====================================');
  
  return {
    totalToPay,
    totalPaid,
    pendingCount,
    totalPending,
    next7Days: next7DaysTotal,
    next7DaysCount: next7DaysEntries.length,
  };
};

export const getCategoryBreakdown = (data: AccountsPayableEntry[], limit: number = 5): CategoryBreakdown[] => {
  const categoryMap = new Map<string, { amount: number; count: number; paid: number; overdue: number }>();
  
  // Only include non-paid entries for category breakdown
  const unpaidData = data.filter(entry => entry.status !== 'Pago');
  
  unpaidData.forEach(entry => {
    const category = entry.category?.trim() || 'Sem Categoria';
    const current = categoryMap.get(category) || { amount: 0, count: 0, paid: 0, overdue: 0 };
    categoryMap.set(category, {
      amount: current.amount + entry.amount,
      count: current.count + 1,
      paid: current.paid,
      overdue: current.overdue + (entry.status === 'Atrasado' ? 1 : 0),
    });
  });
  
  const totalAmount = unpaidData.reduce((sum, entry) => sum + entry.amount, 0);
  
  const breakdown: CategoryBreakdown[] = Array.from(categoryMap.entries()).map(([category, stats]) => ({
    category,
    amount: stats.amount,
    percentage: totalAmount > 0 ? (stats.amount / totalAmount) * 100 : 0,
    count: stats.count,
    status: stats.overdue > 0 ? 'overdue' : 'pending',
  }));
  
  return breakdown.sort((a, b) => b.amount - a.amount).slice(0, limit);
};

// Get top suppliers filtered by category "Materiais para Revenda"
export const getTopSuppliersByCategory = (data: AccountsPayableEntry[], category: string, limit: number = 5): SupplierData[] => {
  const filteredData = data.filter(entry => {
    const entryCategory = entry.category?.toString().trim();
    return entryCategory === category && entry.status !== 'Pago';
  });
  
  console.log(`\n=== TOP SUPPLIERS FOR "${category}" ===`);
  console.log('Filtered entries:', filteredData.length);
  
  const supplierMap = new Map<string, { count: number; amount: number }>();
  
  filteredData.forEach(entry => {
    const supplierName = entry.creditor?.toString().trim();
    if (!supplierName) return;
    
    const current = supplierMap.get(supplierName) || { count: 0, amount: 0 };
    supplierMap.set(supplierName, {
      count: current.count + 1,
      amount: current.amount + entry.amount,
    });
  });
  
  const suppliers: SupplierData[] = Array.from(supplierMap.entries()).map(([name, stats]) => ({
    name,
    billCount: stats.count,
    totalAmount: stats.amount,
    status: 'active',
  }));
  
  return suppliers.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, limit);
};

// Get weekly chart data for next 4 weeks with cost center breakdown
export const getWeeklyChartData = (data: AccountsPayableEntry[], centerFilter: CostCenterFilter = 'Todos'): WeeklyChartData[] => {
  const today = new Date();
  const weeks: WeeklyChartData[] = [];
  
  // Apply cost center filter
  const filteredData = centerFilter === 'Todos' ? data : data.filter(e => e.costCenter === centerFilter);
  
  for (let i = 0; i < 4; i++) {
    const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 }); // Monday
    const weekEnd = addDays(weekStart, 4); // Friday (4 days after Monday)
    
    const weekEntries = filteredData.filter(entry => {
      const entryDate = parseBrazilianDate(entry.dueDate);
      const dayOfWeek = entryDate.getDay();
      // Only include Monday (1) to Friday (5)
      if (dayOfWeek === 0 || dayOfWeek === 6) return false;
      return entryDate >= weekStart && entryDate <= weekEnd && entry.status !== 'Pago';
    });
    
    // Get Ilha bills
    const ilhaBills = weekEntries.filter(e => e.costCenter === 'Ilha');
    const ilhaTotal = ilhaBills.reduce((sum, e) => sum + e.amount, 0);
    
    // Get Tropical bills
    const tropicalBills = weekEntries.filter(e => e.costCenter === 'Tropical');
    const tropicalTotal = tropicalBills.reduce((sum, e) => sum + e.amount, 0);
    
    const weekTotal = weekEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const topPayments = weekEntries
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map(entry => entry.creditor);
    
    weeks.push({
      label: i === 0 ? 'Esta Semana' : `Semana ${i + 1}`,
      dateRange: `${format(weekStart, 'dd MMM', { locale: ptBR })} - ${format(weekEnd, 'dd MMM', { locale: ptBR })}`,
      total: weekTotal,
      count: weekEntries.length,
      topPayments,
      // Cost center breakdown
      ilhaTotal,
      ilhaCount: ilhaBills.length,
      ilhaBills: ilhaBills
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(e => ({ creditor: e.creditor, amount: e.amount })),
      tropicalTotal,
      tropicalCount: tropicalBills.length,
      tropicalBills: tropicalBills
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(e => ({ creditor: e.creditor, amount: e.amount })),
    });
  }
  
  return weeks;
};

export const getCostCenterComparison = (data: AccountsPayableEntry[], centerFilter: CostCenterFilter = 'Todos'): CostCenterComparison => {
  // Only include unpaid entries
  const unpaidData = data.filter(entry => entry.status !== 'Pago');
  
  const ilha = unpaidData
    .filter(entry => entry.costCenter === 'Ilha')
    .reduce((sum, entry) => sum + entry.amount, 0);
  
  const tropical = unpaidData
    .filter(entry => entry.costCenter === 'Tropical')
    .reduce((sum, entry) => sum + entry.amount, 0);
  
  const total = ilha + tropical;
  
  return {
    ilha,
    tropical,
    ilhaPercentage: total > 0 ? (ilha / total) * 100 : 50,
    tropicalPercentage: total > 0 ? (tropical / total) * 100 : 50,
  };
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}K`;
  }
  return formatCurrency(value);
};

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'pago':
    case 'paid':
      return 'success';
    case 'a vencer':
    case 'pending':
      return 'warning';
    case 'atrasado':
    case 'overdue':
      return 'danger';
    default:
      return 'info';
  }
};
