import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Wallet, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchMovimentacoesFromSupabase } from '@/services/supabaseData';
import {
  calculateMetrics,
  getCategoryBreakdown,
  getCostCenterComparison,
  formatCurrency,
  formatCompactCurrency,
  filterDataByPeriod,
  filterDataByCostCenter,
} from '@/utils/dataProcessing';
import { CostCenterFilter, PeriodFilter } from '@/types/accounts-payable';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { PaymentHistoryChart } from '@/components/dashboard/PaymentHistoryChart';
import { CategoryTable } from '@/components/dashboard/CategoryTable';
import { DailyCards } from '@/components/dashboard/DailyCards';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('month');
  const [selectedCenter, setSelectedCenter] = useState<CostCenterFilter>('Todos');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: raw, isLoading, error, refetch } = useQuery({
    queryKey: ['movimentacoes'],
    queryFn: fetchMovimentacoesFromSupabase,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (error) toast.error('Erro ao carregar dados', { description: 'Verifique a conexão com o Supabase.' });
  }, [error]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Carregando movimentações...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const data          = raw || [];
  const periodData    = filterDataByPeriod(data, selectedPeriod);
  const filteredData  = filterDataByCostCenter(periodData, selectedCenter);
  const metrics       = calculateMetrics(filteredData);
  const categories    = getCategoryBreakdown(filteredData, 8);
  const costCenters   = getCostCenterComparison(filteredData);

  const handleRefresh = () =>
    toast.promise(refetch(), { loading: 'Atualizando...', success: 'Dados atualizados!', error: 'Erro ao atualizar' });

  const periodLabels: Record<PeriodFilter, string> = { day: 'Dia', week: 'Semana', month: 'Mês', year: 'Ano' };
  const centerLabels: { key: CostCenterFilter; label: string }[] = [
    { key: 'Todos', label: 'Todos' },
    { key: 'Ilha', label: 'Ilha' },
    { key: 'Tropical', label: 'Tropical' },
  ];

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">

        {/* Métricas principais */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <MetricCard
            title="Total Entradas"
            value={formatCompactCurrency(metrics.totalEntradas)}
            variant="dark"
            icon={<TrendingUp className="w-5 h-5 text-background" />}
            subtitle={`${metrics.countEntradas} créditos`}
          />
          <MetricCard
            title="Total Saídas"
            value={formatCompactCurrency(metrics.totalSaidas)}
            icon={<TrendingDown className="w-5 h-5 text-danger" />}
            subtitle={`${metrics.countSaidas} débitos`}
          />
          <MetricCard
            title="Saldo"
            value={formatCompactCurrency(metrics.saldo)}
            icon={<Wallet className="w-5 h-5 text-primary" />}
            subtitle={`${metrics.totalRegistros} movimentações`}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
          {(['day', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={cn('pill-button min-h-[40px]',
                selectedPeriod === p ? 'pill-button-active' : 'pill-button-inactive')}
            >
              {periodLabels[p]}
            </button>
          ))}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          {centerLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedCenter(key)}
              className={cn('pill-button min-h-[40px]',
                selectedCenter === key ? 'pill-button-active' : 'pill-button-inactive')}
            >
              {label}
            </button>
          ))}

          <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto min-h-[40px] min-w-[40px]">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Movimentações do Dia */}
        <div className="chart-container mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Movimentações do Dia</h3>
          </div>
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="min-h-[44px] min-w-[44px]">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground capitalize">
                {format(selectedDate, 'EEEE', { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="min-h-[44px] min-w-[44px]">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
          <DailyCards data={data} selectedDate={selectedDate} />
        </div>

        {/* Gráficos e tabelas */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          <div className="lg:col-span-3 space-y-4 lg:space-y-6">
            <PaymentHistoryChart data={data} />
            <CategoryTable categories={categories} />
          </div>

          <div className="lg:col-span-2">
            <div className="chart-container">
              <h3 className="text-lg font-semibold text-foreground mb-4">Centros de Custo</h3>
              <div className="space-y-4">
                {[
                  { label: 'Ilha',     value: costCenters.ilha,     pct: costCenters.ilhaPercentage,     dim: selectedCenter === 'Tropical' },
                  { label: 'Tropical', value: costCenters.tropical, pct: costCenters.tropicalPercentage, dim: selectedCenter === 'Ilha' },
                ].map(({ label, value, pct, dim }) => (
                  <div key={label} className={cn('transition-opacity', dim ? 'opacity-30' : 'opacity-100')}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{label}</span>
                      <span className="text-sm font-bold text-foreground">{formatCurrency(value)}</span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', label === 'Ilha' ? 'bg-gray-900' : 'bg-gray-600')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% do total</p>
                  </div>
                ))}

                {/* Saldo visual */}
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Saldo do período</span>
                    <span className={cn('font-bold', metrics.saldo >= 0 ? 'text-success' : 'text-danger')}>
                      {formatCurrency(metrics.saldo)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{metrics.countEntradas} entradas</span>
                    <span>{metrics.countSaidas} saídas</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
