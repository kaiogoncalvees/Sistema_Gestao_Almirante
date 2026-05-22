import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  PieChart,
  TrendingUp,
  RefreshCw,
  FileSpreadsheet,
  File,
  ChevronDown,
} from 'lucide-react';
import { fetchAccountsPayableFromSupabase } from '@/services/supabaseData';
import {
  formatCurrency,
  getCategoryBreakdown,
  getCostCenterComparison,
} from '@/utils/dataProcessing';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToXLSX, exportToPDF } from '@/utils/exportUtils';

const Relatorios = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const { data: accountsData, isLoading, refetch } = useQuery({
    queryKey: ['accountsPayable'],
    queryFn: fetchAccountsPayableFromSupabase,
  });

  const filteredData = useMemo(() => {
    if (!accountsData) return [];

    return accountsData.filter((entry) => {
      const [day, month, year] = entry.dueDate.split('/');
      const entryDate = new Date(Number(year), Number(month) - 1, Number(day));

      const matchesStartDate = !startDate || entryDate >= startDate;
      const matchesEndDate = !endDate || entryDate <= endDate;
      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
      const matchesCenter = centerFilter === 'all' || entry.costCenter === centerFilter;

      return matchesStartDate && matchesEndDate && matchesStatus && matchesCenter;
    });
  }, [accountsData, startDate, endDate, statusFilter, centerFilter]);

  // Calculate report metrics
  const metrics = useMemo(() => {
    const total = filteredData.reduce((sum, entry) => sum + entry.amount, 0);
    const totalPaid = filteredData
      .filter((e) => e.status === 'Pago')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalPending = filteredData
      .filter((e) => e.status !== 'Pago')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalOverdue = filteredData
      .filter((e) => e.status === 'Atrasado')
      .reduce((sum, e) => sum + e.amount, 0);

    return { total, totalPaid, totalPending, totalOverdue, count: filteredData.length };
  }, [filteredData]);

  const categories = getCategoryBreakdown(filteredData, 10);
  const costCenters = getCostCenterComparison(filteredData, 'Todos');

  // Group by month for chart
  const monthlyData = useMemo(() => {
    const grouped: Record<string, number> = {};
    filteredData.forEach((entry) => {
      const [day, month, year] = entry.dueDate.split('/');
      const key = `${year}-${month}`;
      grouped[key] = (grouped[key] || 0) + entry.amount;
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => {
        const [year, month] = key.split('-');
        return {
          month: format(new Date(Number(year), Number(month) - 1), 'MMM/yy', { locale: ptBR }),
          amount,
        };
      });
  }, [filteredData]);

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (filteredData.length === 0) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    setIsExporting(true);
    try {
      switch (format) {
        case 'csv':
          exportToCSV(filteredData, 'relatorio_financeiro');
          break;
        case 'xlsx':
          await exportToXLSX(filteredData, 'relatorio_financeiro');
          break;
        case 'pdf':
          await exportToPDF(filteredData, 'relatorio_financeiro');
          break;
      }
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar relatório');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    toast.promise(refetch(), {
      loading: 'Atualizando...',
      success: 'Dados atualizados!',
      error: 'Erro ao atualizar',
    });
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Análise financeira detalhada</p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="min-h-[44px]" disabled={isExporting}>
                <Download className="w-4 h-4 mr-2" />
                Exportar
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <File className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filters */}
        <div className="chart-container mb-6">
          <h3 className="font-semibold text-foreground mb-4">Filtros do Relatório</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'min-h-[44px] w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy') : 'Data inicial'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'min-h-[44px] w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy') : 'Data final'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Programado">Programado</SelectItem>
                <SelectItem value="A vencer">A vencer</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Atrasado">Atrasado</SelectItem>
              </SelectContent>
            </Select>

            {/* Center Filter */}
            <Select value={centerFilter} onValueChange={setCenterFilter}>
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Centro de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Centros</SelectItem>
                <SelectItem value="Ilha">Ilha</SelectItem>
                <SelectItem value="Tropical">Tropical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(undefined);
                setEndDate(undefined);
                setStatusFilter('all');
                setCenterFilter('all');
              }}
              className="min-h-[40px]"
            >
              Limpar Filtros
            </Button>
            <Button variant="outline" size="icon" onClick={handleRefresh} className="min-h-[40px] min-w-[40px]">
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Geral</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {formatCurrency(metrics.total)}
            </p>
            <p className="text-xs text-muted-foreground">{metrics.count} registros</p>
          </div>

          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <span className="text-sm text-muted-foreground">Total Pago</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-success">
              {formatCurrency(metrics.totalPaid)}
            </p>
          </div>

          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-warning" />
              <span className="text-sm text-muted-foreground">Pendente</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-warning">
              {formatCurrency(metrics.totalPending)}
            </p>
          </div>

          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="w-5 h-5 text-danger" />
              <span className="text-sm text-muted-foreground">Atrasado</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-danger">
              {formatCurrency(metrics.totalOverdue)}
            </p>
          </div>
        </div>

        {/* Detailed Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories Report */}
          <div className="chart-container">
            <h3 className="font-semibold text-foreground mb-4">Por Categoria</h3>
            <div className="space-y-3">
              {categories.map((cat, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground truncate flex-1 mr-2">
                      {cat.category}
                    </span>
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(cat.amount)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{cat.count} conta(s)</span>
                    <span>{cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Sem dados</p>
              )}
            </div>
          </div>

          {/* Cost Centers Report */}
          <div className="chart-container">
            <h3 className="font-semibold text-foreground mb-4">Por Centro de Custo</h3>
            <div className="space-y-4">
              <div>
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

              <div>
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

            {/* Monthly Evolution */}
            <div className="mt-8">
              <h4 className="font-medium text-foreground mb-4">Evolução Mensal</h4>
              <div className="space-y-2">
                {monthlyData.slice(-6).map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{item.month}</span>
                    <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary rounded transition-all duration-500"
                        style={{
                          width: `${
                            (item.amount /
                              Math.max(...monthlyData.map((m) => m.amount), 1)) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium text-foreground w-24 text-right">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Relatorios;
