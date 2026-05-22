import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Search, RefreshCw, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { fetchMovimentacoesPaginated, fetchContasBancarias } from '@/services/supabaseData';
import { formatCurrency } from '@/utils/dataProcessing';
import { MovimentacaoEntry } from '@/types/accounts-payable';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type SortField = 'data_movimento' | 'descricao' | 'valor' | 'tipo_operacao' | 'categoria';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [25, 50, 100];

const Detalhes = () => {
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [tipoFilter,   setTipoFilter]   = useState('all');
  const [centerFilter, setCenterFilter] = useState('all');
  const [contaFilter,  setContaFilter]  = useState('all');
  const [sortField,    setSortField]    = useState<SortField>('data_movimento');
  const [sortOrder,    setSortOrder]    = useState<SortOrder>('desc');
  const [page,         setPage]         = useState(0);
  const [pageSize,     setPageSize]     = useState(50);

  // Debounce: dispara a query 400ms após parar de digitar
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Volta para página 1 quando filtros ou ordenação mudam
  useEffect(() => { setPage(0); }, [search, tipoFilter, centerFilter, contaFilter, sortField, sortOrder]);

  // Lista de contas bancárias para o dropdown — cacheada por 10 minutos
  const { data: contasBancarias = [] } = useQuery({
    queryKey: ['contas-bancarias'],
    queryFn:  fetchContasBancarias,
    staleTime: 10 * 60 * 1000,
  });

  const { data: result, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['movimentacoes-paginado', page, pageSize, search, tipoFilter, centerFilter, contaFilter, sortField, sortOrder],
    queryFn: () => fetchMovimentacoesPaginated(page, pageSize, {
      search,
      tipo:      tipoFilter,
      centro:    centerFilter,
      conta:     contaFilter,
      sortField,
      sortAsc:   sortOrder === 'asc',
    }),
    placeholderData: keepPreviousData,
  });

  const entries    = result?.data  ?? [];
  const totalCount = result?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const from       = totalCount === 0 ? 0 : page * pageSize + 1;
  const to         = Math.min(page * pageSize + pageSize, totalCount);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const handleRefresh = () =>
    toast.promise(refetch(), { loading: 'Atualizando...', success: 'Dados atualizados!', error: 'Erro ao atualizar' });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Extrato Bancário</h1>
          <p className="text-sm text-muted-foreground">Visualize e filtre as movimentações sincronizadas</p>
        </div>

        {/* Filtros */}
        <div className="chart-container mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, credor, categoria, conta..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full sm:w-[150px] min-h-[44px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Crédito">Crédito</SelectItem>
                <SelectItem value="Débito">Débito</SelectItem>
              </SelectContent>
            </Select>

            <Select value={centerFilter} onValueChange={setCenterFilter}>
              <SelectTrigger className="w-full sm:w-[150px] min-h-[44px]">
                <SelectValue placeholder="Centro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Ilha">Ilha</SelectItem>
                <SelectItem value="Tropical">Tropical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={contaFilter} onValueChange={setContaFilter}>
              <SelectTrigger className="w-full sm:w-[200px] min-h-[44px]">
                <SelectValue placeholder="Conta bancária" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {contasBancarias.map(conta => (
                  <SelectItem key={conta} value={conta}>{conta}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={handleRefresh} className="min-h-[44px] min-w-[44px]">
              <RefreshCw className={cn('w-4 h-4', (isLoading || isFetching) && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Contador + seletor de itens por página */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            {totalCount > 0
              ? `Mostrando ${from}–${to} de ${totalCount.toLocaleString('pt-BR')} resultado(s)`
              : isLoading ? 'Carregando...' : 'Nenhum resultado'}
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Por página:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {entries.map((entry: MovimentacaoEntry, i: number) => {
            const isCredito = entry.tipoOperacao === 'Crédito';
            return (
              <div key={i} className={cn('bg-card border rounded-lg p-4 space-y-2', isCredito ? 'border-success/20' : 'border-danger/20')}>
                <div className="flex items-start justify-between">
                  <p className="font-medium text-foreground text-sm flex-1 truncate">{entry.descricao || '—'}</p>
                  <span className={cn('ml-2 flex items-center gap-1 text-xs font-semibold', isCredito ? 'text-success' : 'text-danger')}>
                    {isCredito ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {entry.tipoOperacao}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn('text-xl font-bold', isCredito ? 'text-success' : 'text-danger')}>
                    {isCredito ? '+' : '-'}{formatCurrency(Math.abs(entry.valor))}
                  </span>
                  <span className="text-sm text-muted-foreground">{entry.dataMovimento}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{entry.centroCusto}</span>
                  {entry.categoria && <><span>•</span><span>{entry.categoria}</span></>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block chart-container overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('data_movimento')}>
                  Data <SortIcon field="data_movimento" />
                </TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('descricao')}>
                  Descrição <SortIcon field="descricao" />
                </TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('tipo_operacao')}>
                  Tipo <SortIcon field="tipo_operacao" />
                </TableHead>
                <TableHead>Conta</TableHead>
                <TableHead className="cursor-pointer hover:text-foreground text-right" onClick={() => handleSort('valor')}>
                  Valor <SortIcon field="valor" />
                </TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('categoria')}>
                  Categoria <SortIcon field="categoria" />
                </TableHead>
                <TableHead>Centro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: MovimentacaoEntry, i: number) => {
                const isCredito = entry.tipoOperacao === 'Crédito';
                return (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-sm">{entry.dataMovimento}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{entry.descricao || '—'}</TableCell>
                    <TableCell>
                      <span className={cn('flex items-center gap-1 text-xs font-semibold w-fit', isCredito ? 'text-success' : 'text-danger')}>
                        {isCredito ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {entry.tipoOperacao}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">{entry.contaBancaria}</TableCell>
                    <TableCell className={cn('text-right font-semibold whitespace-nowrap', isCredito ? 'text-success' : 'text-danger')}>
                      {isCredito ? '+' : '-'}{formatCurrency(Math.abs(entry.valor))}
                    </TableCell>
                    <TableCell className="text-sm">{entry.categoria || '—'}</TableCell>
                    <TableCell className="text-sm">{entry.centroCusto}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {entries.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum resultado encontrado</p>
          </div>
        )}

        {/* Controles de paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(0)}
              disabled={page === 0 || isFetching}
            >
              Primeira
            </Button>
            <Button
              variant="outline" size="icon"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0 || isFetching}
              className="min-h-[36px] min-w-[36px]"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-sm text-muted-foreground px-3 min-w-[120px] text-center">
              Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong>
            </span>

            <Button
              variant="outline" size="icon"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1 || isFetching}
              className="min-h-[36px] min-w-[36px]"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1 || isFetching}
            >
              Última
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Detalhes;
