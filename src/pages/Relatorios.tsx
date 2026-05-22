import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, Download, Calendar, TrendingUp, TrendingDown,
  Wallet, RefreshCw, FileSpreadsheet, File, ChevronDown,
} from 'lucide-react';
import { fetchMovimentacoesFromSupabase } from '@/services/supabaseData';
import { formatCurrency, getCategoryBreakdown, getCostCenterComparison } from '@/utils/dataProcessing';
import { MovimentacaoEntry } from '@/types/accounts-payable';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToXLSX, exportToPDF } from '@/utils/exportUtils';

const Relatorios = () => {
  const [startDate,    setStartDate]    = useState<Date>();
  const [endDate,      setEndDate]      = useState<Date>();
  const [tipoFilter,   setTipoFilter]   = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [isExporting,  setIsExporting]  = useState(false);

  const { data: raw, isLoading, refetch } = useQuery<MovimentacaoEntry[]>({
    queryKey: ['movimentacoes'],
    queryFn: fetchMovimentacoesFromSupabase,
  });

  const filteredData = useMemo((): MovimentacaoEntry[] => {
    if (!raw) return [];
    return raw.filter(e => {
      const [d, m, y] = e.dataMovimento.split('/');
      const date = new Date(+y, +m - 1, +d);
      const matchStart  = !startDate  || date >= startDate;
      const matchEnd    = !endDate    || date <= endDate;
      const matchTipo   = tipoFilter   === 'all' || e.tipoOperacao === tipoFilter;
      const matchCenter = centerFilter === 'all' || e.centroCusto  === centerFilter;
      return matchStart && matchEnd && matchTipo && matchCenter;
    });
  }, [raw, startDate, endDate, tipoFilter, centerFilter]);

  const metrics = useMemo(() => {
    const totalEntradas = filteredData
      .filter(e => e.tipoOperacao === 'Crédito')
      .reduce((s, e) => s + Math.abs(e.valor), 0);
    const totalSaidas = filteredData
      .filter(e => e.tipoOperacao === 'Débito')
      .reduce((s, e) => s + Math.abs(e.valor), 0);
    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      count: filteredData.length,
    };
  }, [filteredData]);

  const categories  = getCategoryBreakdown(filteredData, 10);
  const costCenters = getCostCenterComparison(filteredData);

  const monthlyData = useMemo(() => {
    const grouped: Record<string, { entradas: number; saidas: number }> = {};
    filteredData.forEach(e => {
      const [, m, y] = e.dataMovimento.split('/');
      const key = `${y}-${m}`;
      if (!grouped[key]) grouped[key] = { entradas: 0, saidas: 0 };
      if (e.tipoOperacao === 'Crédito') grouped[key].entradas += Math.abs(e.valor);
      else grouped[key].saidas += Math.abs(e.valor);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        return {
          month: format(new Date(+y, +m - 1), 'MMM/yy', { locale: ptBR }),
          entradas: v.entradas,
          saidas: v.saidas,
          saldo: v.entradas - v.saidas,
        };
      });
  }, [filteredData]);

  const handleExport = async (fmt: 'csv' | 'xlsx' | 'pdf') => {
    if (filteredData.length === 0) { toast.error('Nenhum dado para exportar'); return; }
    setIsExporting(true);
    try {
      if (fmt === 'csv')  exportToCSV(filteredData, 'relatorio_movimentacoes');
      if (fmt === 'xlsx') await exportToXLSX(filteredData, 'relatorio_movimentacoes');
      if (fmt === 'pdf')  await exportToPDF(filteredData, 'relatorio_movimentacoes');
      toast.success('Relatório exportado!');
    } catch { toast.error('Erro ao exportar'); }
    finally { setIsExporting(false); }
  };

  const handleRefresh = () =>
    toast.promise(refetch(), { loading: 'Atualizando...', success: 'Atualizado!', error: 'Erro' });

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Análise das movimentações bancárias</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="min-h-[44px]" disabled={isExporting}>
                <Download className="w-4 h-4 mr-2" /> Exportar <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="w-4 h-4 mr-2" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xlsx')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <File className="w-4 h-4 mr-2" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filtros */}
        <div className="chart-container mb-6">
          <h3 className="font-semibold text-foreground mb-4">Filtros</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('min-h-[44px] w-full justify-start font-normal', !startDate && 'text-muted-foreground')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy') : 'Data inicial'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={startDate} onSelect={setStartDate} locale={ptBR} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('min-h-[44px] w-full justify-start font-normal', !endDate && 'text-muted-foreground')}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy') : 'Data final'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={endDate} onSelect={setEndDate} locale={ptBR} className="pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="Crédito">Crédito</SelectItem>
                <SelectItem value="Débito">Débito</SelectItem>
              </SelectContent>
            </Select>

            <Select value={centerFilter} onValueChange={setCenterFilter}>
              <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Centro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Centros</SelectItem>
                <SelectItem value="Ilha">Ilha</SelectItem>
                <SelectItem value="Tropical">Tropical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="min-h-[40px]"
              onClick={() => { setStartDate(undefined); setEndDate(undefined); setTipoFilter('all'); setCenterFilter('all'); }}>
              Limpar Filtros
            </Button>
            <Button variant="outline" size="icon" onClick={handleRefresh} className="min-h-[40px] min-w-[40px]">
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <span className="text-sm text-muted-foreground">Total Entradas</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-success">{formatCurrency(metrics.totalEntradas)}</p>
          </div>
          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-danger" />
              <span className="text-sm text-muted-foreground">Total Saídas</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-danger">{formatCurrency(metrics.totalSaidas)}</p>
          </div>
          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Saldo</span>
            </div>
            <p className={cn('text-xl sm:text-2xl font-bold', metrics.saldo >= 0 ? 'text-success' : 'text-danger')}>
              {formatCurrency(metrics.saldo)}
            </p>
          </div>
          <div className="chart-container">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground">Registros</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-foreground">{metrics.count}</p>
          </div>
        </div>

        {/* Análise detalhada */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Por categoria */}
          <div className="chart-container">
            <h3 className="font-semibold text-foreground mb-4">Por Categoria</h3>
            <div className="space-y-3">
              {categories.map((cat, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground truncate flex-1 mr-2">{cat.category}</span>
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${cat.percentage}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{cat.count} registro(s)</span>
                    <span>{cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
              {categories.length === 0 && <p className="text-muted-foreground text-center py-4">Sem dados</p>}
            </div>
          </div>

          {/* Por centro de custo + evolução mensal */}
          <div className="chart-container">
            <h3 className="font-semibold text-foreground mb-4">Por Centro de Custo</h3>
            <div className="space-y-4 mb-8">
              {[
                { label: 'Ilha',     value: costCenters.ilha,     pct: costCenters.ilhaPercentage,     color: 'bg-gray-900' },
                { label: 'Tropical', value: costCenters.tropical, pct: costCenters.tropicalPercentage, color: 'bg-gray-600' },
              ].map(({ label, value, pct, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(value)}</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% do total</p>
                </div>
              ))}
            </div>

            <h4 className="font-medium text-foreground mb-4">Evolução Mensal</h4>
            <div className="space-y-2">
              {monthlyData.slice(-6).map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">{item.month}</span>
                  <div className="flex-1 space-y-1">
                    <div className="h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-success rounded"
                        style={{ width: `${(item.entradas / Math.max(...monthlyData.map(m => m.entradas), 1)) * 100}%` }} />
                    </div>
                    <div className="h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-danger rounded"
                        style={{ width: `${(item.saidas / Math.max(...monthlyData.map(m => m.saidas), 1)) * 100}%` }} />
                    </div>
                  </div>
                  <span className={cn('text-xs font-medium w-24 text-right', item.saldo >= 0 ? 'text-success' : 'text-danger')}>
                    {formatCurrency(item.saldo)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger inline-block" /> Saídas</span>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Relatorios;
