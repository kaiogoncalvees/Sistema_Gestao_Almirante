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
import { format, startOfWeek, startOfMonth, startOfYear, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AccountsPayableEntry, CostCenterFilter } from '@/types/accounts-payable';
import { formatCurrency } from '@/utils/dataProcessing';
import { cn } from '@/lib/utils';

interface PaymentHistoryChartProps {
  data: AccountsPayableEntry[];
}

type TimeFilter = 'week' | 'month' | 'year';

export const PaymentHistoryChart = ({ data }: PaymentHistoryChartProps) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [centerFilter, setCenterFilter] = useState<CostCenterFilter>('Todos');

  const chartData = useMemo(() => {
    const filteredData = centerFilter === 'Todos' 
      ? data 
      : data.filter(entry => entry.costCenter === centerFilter);

    const grouped: Record<string, { paid: number; pending: number }> = {};

    filteredData.forEach((entry) => {
      const [day, month, year] = entry.dueDate.split('/');
      const entryDate = new Date(Number(year), Number(month) - 1, Number(day));
      
      if (!isValid(entryDate)) return;

      let key: string;
      switch (timeFilter) {
        case 'week':
          const weekStart = startOfWeek(entryDate, { weekStartsOn: 1 });
          key = format(weekStart, 'dd/MM', { locale: ptBR });
          break;
        case 'month':
          key = format(entryDate, 'MMM/yy', { locale: ptBR });
          break;
        case 'year':
          key = format(entryDate, 'yyyy', { locale: ptBR });
          break;
      }

      if (!grouped[key]) {
        grouped[key] = { paid: 0, pending: 0 };
      }

      if (entry.status === 'Pago') {
        grouped[key].paid += entry.amount;
      } else {
        grouped[key].pending += entry.amount;
      }
    });

    return Object.entries(grouped)
      .map(([period, values]) => ({
        period,
        paid: values.paid,
        pending: values.pending,
        total: values.paid + values.pending,
      }))
      .sort((a, b) => {
        // Sort chronologically
        return a.period.localeCompare(b.period);
      })
      .slice(-12); // Last 12 periods
  }, [data, timeFilter, centerFilter]);

  const timeLabels: { key: TimeFilter; label: string }[] = [
    { key: 'week', label: 'Semana' },
    { key: 'month', label: 'Mês' },
    { key: 'year', label: 'Ano' },
  ];

  const centerLabels: { key: CostCenterFilter; label: string }[] = [
    { key: 'Todos', label: 'Todos' },
    { key: 'Ilha', label: 'Ilha' },
    { key: 'Tropical', label: 'Tropical' },
  ];

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, item) => ({
        paid: acc.paid + item.paid,
        pending: acc.pending + item.pending,
      }),
      { paid: 0, pending: 0 }
    );
  }, [chartData]);

  return (
    <div className="chart-container animate-fade-in">
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Histórico de Pagamentos</h3>
          <p className="text-sm text-muted-foreground">Pagos vs A Pagar ao longo do tempo</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {timeLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeFilter(key)}
              className={cn(
                'pill-button min-h-[36px] text-xs',
                timeFilter === key ? 'pill-button-active' : 'pill-button-inactive'
              )}
            >
              {label}
            </button>
          ))}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block self-center" />

          {centerLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setCenterFilter(key)}
              className={cn(
                'pill-button min-h-[36px] text-xs',
                centerFilter === key ? 'pill-button-active' : 'pill-button-inactive'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-success/10 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Pago</p>
          <p className="text-lg font-bold text-success">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="bg-warning/10 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">A Pagar</p>
          <p className="text-lg font-bold text-warning">{formatCurrency(totals.pending)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="period"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === 'paid' ? 'Pago' : 'A Pagar',
            ]}
            labelFormatter={(label) => `Período: ${label}`}
          />
          <Legend
            formatter={(value) => (value === 'paid' ? 'Pago' : 'A Pagar')}
            wrapperStyle={{ paddingTop: '10px' }}
          />
          <Area
            type="monotone"
            dataKey="paid"
            stackId="1"
            stroke="hsl(var(--success))"
            fill="url(#colorPaid)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="pending"
            stackId="1"
            stroke="hsl(var(--warning))"
            fill="url(#colorPending)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
