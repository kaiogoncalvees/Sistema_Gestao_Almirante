import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  Receipt,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchAccountsPayableFromSupabase } from '@/services/supabaseData';
import {
  calculateMetrics,
  getCategoryBreakdown,
  getTopSuppliersByCategory,
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
import { SupplierTable } from '@/components/dashboard/SupplierTable';
import { DailyCards } from '@/components/dashboard/DailyCards';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('month');
  const [selectedCenter, setSelectedCenter] = useState<CostCenterFilter>('Todos');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: accountsData, isLoading, error, refetch } = useQuery({
    queryKey: ['accountsPayable'],
    queryFn: fetchAccountsPayableFromSupabase,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (error) {
      toast.error('Erro ao carregar dados', {
        description: 'Verifique a conexão com o Supabase.',
      });
    }
  }, [error]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Carregando dados...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const data = accountsData || [];
  const periodFilteredData = filterDataByPeriod(data, selectedPeriod);
  const filteredData = filterDataByCostCenter(periodFilteredData, selectedCenter);
  const metrics = calculateMetrics(filteredData);
  const categories = getCategoryBreakdown(filteredData, 5);
  const suppliers = getTopSuppliersByCategory(filteredData, 'Materiais para Revenda', 5);
  const costCenters = getCostCenterComparison(periodFilteredData, selectedCenter);

  const handleRefresh = () => {
    toast.promise(refetch(), {
      loading: 'Atualizando dados...',
      success: 'Dados atualizados!',
      error: 'Erro ao atualizar',
    });
  };

  const periodLabels = {
    day: 'Dia',
    week: 'Semana',
    month: 'Mês',
    year: 'Ano',
  };

  const centerLabels: { key: CostCenterFilter; label: string }[] = [
    { key: 'Todos', label: 'Todos' },
    { key: 'Ilha', label: 'Ilha' },
    { key: 'Tropical', label: 'Tropical' },
  ];

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        {/* Top 3 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <MetricCard
            title="Total a Pagar"
            value={formatCompactCurrency(metrics.totalToPay)}
            variant="dark"
            icon={<DollarSign className="w-5 h-5 text-background" />}
            subtitle={`${metrics.pendingCount} contas`}
          />
          <MetricCard
            title="Total Pago"
            value={formatCompactCurrency(metrics.totalPaid)}
            icon={<Receipt className="w-5 h-5 text-success" />}
            subtitle="histórico"
          />
          <MetricCard
            title="Próximos 7 Dias"
            value={formatCompactCurrency(metrics.next7Days)}
            icon={<Calendar className="w-5 h-5 text-warning" />}
            subtitle={`${metrics.next7DaysCount} contas`}
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
          {(['day', 'week', 'month', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                'pill-button min-h-[40px]',
                selectedPeriod === period ? 'pill-button-active' : 'pill-button-inactive'
              )}
            >
              {periodLabels[period]}
            </button>
          ))}

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          {centerLabels.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedCenter(key)}
              className={cn(
                'pill-button min-h-[40px]',
                selectedCenter === key ? 'pill-button-active' : 'pill-button-inactive'
              )}
            >
              {label}
            </button>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto min-h-[40px] min-w-[40px]"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Date Navigation - Programações do Dia */}
        <div className="chart-container mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Programações do Dia</h3>
          </div>
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground capitalize">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="min-h-[44px] min-w-[44px]"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Daily Cards */}
          <DailyCards data={data} selectedDate={selectedDate} />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          <div className="lg:col-span-3 space-y-4 lg:space-y-6">
            <PaymentHistoryChart data={data} />
            <SupplierTable suppliers={suppliers} />
            <CategoryTable categories={categories} />
          </div>

          <div className="lg:col-span-2">
            <div className="chart-container">
              <h3 className="text-lg font-semibold text-foreground mb-4">Centros de Custo</h3>
              <div className="space-y-4">
                <div className={cn(
                  "transition-opacity",
                  selectedCenter === 'Tropical' ? 'opacity-30' : 'opacity-100'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Ilha</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(costCenters.ilha)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-900 rounded-full transition-all duration-500"
                      style={{ width: `${costCenters.ilhaPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {costCenters.ilhaPercentage.toFixed(1)}% do total
                  </p>
                </div>

                <div className={cn(
                  "transition-opacity",
                  selectedCenter === 'Ilha' ? 'opacity-30' : 'opacity-100'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Tropical</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatCurrency(costCenters.tropical)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-600 rounded-full transition-all duration-500"
                      style={{ width: `${costCenters.tropicalPercentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {costCenters.tropicalPercentage.toFixed(1)}% do total
                  </p>
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
