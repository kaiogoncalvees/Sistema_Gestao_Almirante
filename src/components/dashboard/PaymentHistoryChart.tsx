import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MovimentacaoEntry, CostCenterFilter } from '@/types/accounts-payable';
import { getChartData, formatCurrency } from '@/utils/dataProcessing';
import { cn } from '@/lib/utils';

interface PaymentHistoryChartProps {
  data: MovimentacaoEntry[];
}

type TimeFilter = 'week' | 'month' | 'year';

export const PaymentHistoryChart = ({ data }: PaymentHistoryChartProps) => {
  const [timeFilter, setTimeFilter]     = useState<TimeFilter>('month');
  const [centerFilter, setCenterFilter] = useState<CostCenterFilter>('Todos');

  const filtered = centerFilter === 'Todos'
    ? data
    : data.filter(e => e.centroCusto === centerFilter);

  const chartData = useMemo(
    () => getChartData(filtered, timeFilter),
    [filtered, timeFilter]
  );

  const totals = useMemo(() =>
    chartData.reduce(
      (acc, d) => ({ entradas: acc.entradas + d.entradas, saidas: acc.saidas + d.saidas }),
      { entradas: 0, saidas: 0 }
    ),
    [chartData]
  );

  const timeLabels: { key: TimeFilter; label: string }[] = [
    { key: 'week',  label: 'Semana' },
    { key: 'month', label: 'Mês'    },
    { key: 'year',  label: 'Ano'    },
  ];

  const centerLabels: { key: CostCenterFilter; label: string }[] = [
    { key: 'Todos',    label: 'Todos'    },
    { key: 'Ilha',     label: 'Ilha'     },
    { key: 'Tropical', label: 'Tropical' },
  ];

  return (
    <div className="chart-container animate-fade-in">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Histórico de Movimentações</h3>
          <p className="text-sm text-muted-foreground">Entradas vs Saídas ao longo do tempo</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {timeLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeFilter(key)}
              className={cn('pill-button min-h-[36px] text-xs',
                timeFilter === key ? 'pill-button-active' : 'pill-button-inactive')}
            >
              {label}
            </button>
          ))}
          <div className="w-px h-6 bg-border mx-1 hidden sm:block self-center" />
          {centerLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCenterFilter(key)}
              className={cn('pill-button min-h-[36px] text-xs',
                centerFilter === key ? 'pill-button-active' : 'pill-button-inactive')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-success/10 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Entradas</p>
          <p className="text-lg font-bold text-success">{formatCurrency(totals.entradas)}</p>
        </div>
        <div className="bg-danger/10 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Saídas</p>
          <p className="text-lg font-bold text-danger">{formatCurrency(totals.saidas)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="hsl(var(--success))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="hsl(var(--danger))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--danger))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="period"
            axisLine={false} tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <YAxis
            axisLine={false} tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickFormatter={v => `${(v / 1000).toFixed(0)}K`}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === 'entradas' ? 'Entradas' : 'Saídas',
            ]}
            labelFormatter={label => `Período: ${label}`}
          />
          <Legend formatter={v => v === 'entradas' ? 'Entradas' : 'Saídas'} wrapperStyle={{ paddingTop: '10px' }} />
          <Area type="monotone" dataKey="entradas" stroke="hsl(var(--success))" fill="url(#colorEntradas)" strokeWidth={2} />
          <Area type="monotone" dataKey="saidas"   stroke="hsl(var(--danger))"  fill="url(#colorSaidas)"   strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
