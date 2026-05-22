import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  DollarSign,
  Receipt,
  Calendar,
  RefreshCw,
  LogOut,
  User
} from 'lucide-react';
import { fetchAccountsPayableFromSupabase } from '@/services/supabaseData';
import { 
  calculateMetrics,
  getCategoryBreakdown,
  getTopSuppliersByCategory,
  getWeeklyChartData,
  getCostCenterComparison,
  formatCurrency,
  formatCompactCurrency,
  filterDataByPeriod,
  filterDataByCostCenter
} from '@/utils/dataProcessing';
import { CostCenterFilter, PeriodFilter } from '@/types/accounts-payable';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { WeeklyPaymentChart } from '@/components/dashboard/WeeklyPaymentChart';
import { CategoryTable } from '@/components/dashboard/CategoryTable';
import { SupplierTable } from '@/components/dashboard/SupplierTable';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('month');
  const [selectedCenter, setSelectedCenter] = useState<CostCenterFilter>('Todos');
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
    toast.success('Logout realizado com sucesso!');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground">Carregando dados...</p>
          <p className="text-sm text-muted-foreground">Conectando ao Supabase</p>
        </div>
      </div>
    );
  }

  const data = accountsData || [];
  
  // Apply filters in sequence: first period, then cost center
  const periodFilteredData = filterDataByPeriod(data, selectedPeriod);
  const filteredData = filterDataByCostCenter(periodFilteredData, selectedCenter);
  
  // Calculate metrics based on filtered data
  const metrics = calculateMetrics(filteredData);
  const categories = getCategoryBreakdown(filteredData, 5);
  const suppliers = getTopSuppliersByCategory(filteredData, 'Materiais para Revenda', 5);
  
  // Weekly chart uses all data (not period filtered) but applies cost center filter
  const weeklyChartData = getWeeklyChartData(data, selectedCenter);
  
  // Cost centers - show based on center filter
  const costCenters = getCostCenterComparison(periodFilteredData, selectedCenter);

  const handleRefresh = () => {
    toast.promise(refetch(), {
      loading: 'Atualizando dados...',
      success: 'Dados atualizados com sucesso!',
      error: 'Erro ao atualizar dados',
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
    <div className="min-h-screen bg-background">
      <div className="w-full">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Financeiro Gigante</h1>
                <p className="text-sm text-muted-foreground">Contas a Pagar</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span className="max-w-[150px] truncate">{user?.email}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSignOut}
                  className="min-h-[40px]"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Top 3 Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <MetricCard
              title="Total a Pagar"
              value={formatCompactCurrency(metrics.totalToPay)}
              variant="dark"
              icon={<DollarSign className="w-5 h-5 text-white" />}
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
              subtitle={`${metrics.next7DaysCount} contas esta semana`}
            />
          </div>

          {/* Filter Pills - Period and Cost Center */}
          <div className="flex flex-wrap items-center gap-2 mb-6 sm:mb-8">
            {/* Period Filters */}
            {(['day', 'week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  'pill-button min-h-[44px]',
                  selectedPeriod === period ? 'pill-button-active' : 'pill-button-inactive'
                )}
              >
                {periodLabels[period]}
              </button>
            ))}
            
            {/* Separator */}
            <div className="w-px h-6 bg-border mx-2 hidden sm:block" />
            
            {/* Cost Center Filters */}
            {centerLabels.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSelectedCenter(key)}
                className={cn(
                  'pill-button min-h-[44px]',
                  selectedCenter === key ? 'pill-button-active' : 'pill-button-inactive'
                )}
              >
                {label}
              </button>
            ))}
            
            {/* Refresh Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh} 
              className="ml-auto min-h-[44px] min-w-[44px]"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile: Single Column | Desktop: Two Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* LEFT COLUMN (60%) */}
            <div className="lg:col-span-3 space-y-6 lg:space-y-8 order-2 lg:order-1">
              {/* Weekly Payment Chart with Details */}
              <WeeklyPaymentChart data={weeklyChartData} />

              {/* Top 5 Suppliers by Category */}
              <SupplierTable suppliers={suppliers} />
              
              {/* Top 5 Categories */}
              <CategoryTable categories={categories} />
            </div>

            {/* RIGHT COLUMN (40%) */}
            <div className="lg:col-span-2 space-y-6 lg:space-y-8 order-1 lg:order-2">
              {/* Cost Center Comparison */}
              <div className="chart-container">
                <h3 className="text-lg font-semibold text-foreground mb-4">Centros de Custo</h3>
                <div className="space-y-4">
                  {/* Ilha */}
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
                  
                  {/* Tropical */}
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
        </main>
      </div>
    </div>
  );
};

export default Index;
