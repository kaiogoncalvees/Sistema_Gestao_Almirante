import {
  MovimentacaoEntry,
  MetricData,
  CategoryBreakdown,
  CostCenterComparison,
  ChartDataPoint,
  CostCenterFilter,
  TipoFilter,
} from '@/types/accounts-payable';
import {
  format,
  startOfWeek,
  startOfMonth,
  startOfDay,
  endOfDay,
  startOfYear,
  endOfYear,
  endOfMonth,
  isWithinInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const parseBRDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

export const filterDataByCostCenter = (
  data: MovimentacaoEntry[],
  center: CostCenterFilter
): MovimentacaoEntry[] => {
  if (center === 'Todos') return data;
  return data.filter(e => e.centroCusto === center);
};

export const filterDataByTipo = (
  data: MovimentacaoEntry[],
  tipo: TipoFilter
): MovimentacaoEntry[] => {
  if (tipo === 'Todos') return data;
  return data.filter(e => e.tipoOperacao === tipo);
};

export const filterDataByPeriod = (
  data: MovimentacaoEntry[],
  period: 'day' | 'week' | 'month' | 'year'
): MovimentacaoEntry[] => {
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
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
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

  return data.filter(e => {
    const d = parseBRDate(e.dataMovimento);
    return isWithinInterval(d, { start: startDate, end: endDate });
  });
};

export const calculateMetrics = (data: MovimentacaoEntry[]): MetricData => {
  const entradas = data.filter(e => e.tipoOperacao === 'Crédito');
  const saidas   = data.filter(e => e.tipoOperacao === 'Débito');

  const totalEntradas = entradas.reduce((sum, e) => sum + Math.abs(e.valor), 0);
  const totalSaidas   = saidas.reduce((sum, e) => sum + Math.abs(e.valor), 0);

  return {
    totalEntradas,
    totalSaidas,
    saldo: totalEntradas - totalSaidas,
    countEntradas: entradas.length,
    countSaidas: saidas.length,
    totalRegistros: data.length,
  };
};

export const getCategoryBreakdown = (
  data: MovimentacaoEntry[],
  limit = 10
): CategoryBreakdown[] => {
  const map = new Map<string, { amount: number; count: number; creditos: number; debitos: number }>();

  data.forEach(e => {
    const cat = e.categoria?.trim() || 'Sem Categoria';
    const cur = map.get(cat) || { amount: 0, count: 0, creditos: 0, debitos: 0 };
    map.set(cat, {
      amount:   cur.amount + Math.abs(e.valor),
      count:    cur.count + 1,
      creditos: cur.creditos + (e.tipoOperacao === 'Crédito' ? 1 : 0),
      debitos:  cur.debitos  + (e.tipoOperacao === 'Débito'  ? 1 : 0),
    });
  });

  const total = data.reduce((s, e) => s + Math.abs(e.valor), 0);

  return Array.from(map.entries())
    .map(([category, stats]): CategoryBreakdown => ({
      category,
      amount: stats.amount,
      percentage: total > 0 ? (stats.amount / total) * 100 : 0,
      count: stats.count,
      tipo: stats.creditos > 0 && stats.debitos > 0
        ? 'misto'
        : stats.creditos > 0 ? 'credito' : 'debito',
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
};

export const getCostCenterComparison = (
  data: MovimentacaoEntry[]
): CostCenterComparison => {
  const ilha     = data.filter(e => e.centroCusto === 'Ilha')
                       .reduce((s, e) => s + Math.abs(e.valor), 0);
  const tropical = data.filter(e => e.centroCusto === 'Tropical')
                       .reduce((s, e) => s + Math.abs(e.valor), 0);
  const total = ilha + tropical;

  return {
    ilha,
    tropical,
    ilhaPercentage:     total > 0 ? (ilha / total) * 100 : 50,
    tropicalPercentage: total > 0 ? (tropical / total) * 100 : 50,
  };
};

export const getChartData = (
  data: MovimentacaoEntry[],
  groupBy: 'week' | 'month' | 'year' = 'month'
): ChartDataPoint[] => {
  const grouped: Record<string, { entradas: number; saidas: number }> = {};

  data.forEach(e => {
    const d = parseBRDate(e.dataMovimento);
    let key: string;
    switch (groupBy) {
      case 'week':
        key = format(startOfWeek(d, { weekStartsOn: 1 }), 'dd/MM', { locale: ptBR });
        break;
      case 'year':
        key = format(d, 'yyyy');
        break;
      default:
        key = format(startOfMonth(d), 'MMM/yy', { locale: ptBR });
    }

    if (!grouped[key]) grouped[key] = { entradas: 0, saidas: 0 };
    if (e.tipoOperacao === 'Crédito') grouped[key].entradas += Math.abs(e.valor);
    else grouped[key].saidas += Math.abs(e.valor);
  });

  return Object.entries(grouped)
    .map(([period, v]): ChartDataPoint => ({
      period,
      entradas: v.entradas,
      saidas:   v.saidas,
      saldo:    v.entradas - v.saidas,
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-12);
};

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatCompactCurrency = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}R$ ${(abs / 1_000).toFixed(1)}K`;
  return formatCurrency(value);
};

export const getTipoColor = (tipo: string): string => {
  if (tipo === 'Crédito') return 'success';
  if (tipo === 'Débito')  return 'danger';
  return 'info';
};
