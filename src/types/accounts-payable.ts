export interface MovimentacaoEntry {
  dataMovimento: string;                   // DD/MM/YYYY
  credor: string;
  descricao: string;
  tipoOperacao: 'Crédito' | 'Débito';
  contaBancaria: string;
  valor: number;                           // positive = crédito, negative = débito
  status: string;
  categoria: string;
  centroCusto: string;
}

export interface MetricData {
  totalEntradas: number;
  totalSaidas: number;
  saldo: number;
  countEntradas: number;
  countSaidas: number;
  totalRegistros: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  tipo: 'credito' | 'debito' | 'misto';
}

export interface CostCenterComparison {
  ilha: number;
  tropical: number;
  ilhaPercentage: number;
  tropicalPercentage: number;
}

export interface ChartDataPoint {
  period: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export type CostCenterFilter = 'Todos' | 'Ilha' | 'Tropical';
export type PeriodFilter = 'day' | 'week' | 'month' | 'year';
export type TipoFilter = 'Todos' | 'Crédito' | 'Débito';
