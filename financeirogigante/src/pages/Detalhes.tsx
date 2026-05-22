import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { fetchAccountsPayableFromSupabase, AccountsPayableWithId } from '@/services/supabaseData';
import { formatCurrency, getStatusColor } from '@/utils/dataProcessing';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { EditAccountDialog } from '@/components/forms/EditAccountDialog';

type SortField = 'dueDate' | 'creditor' | 'amount' | 'status' | 'category';
type SortOrder = 'asc' | 'desc';

const Detalhes = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [editingAccount, setEditingAccount] = useState<AccountsPayableWithId | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: accountsData, isLoading, refetch } = useQuery({
    queryKey: ['accountsPayable'],
    queryFn: fetchAccountsPayableFromSupabase,
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleRefresh = () => {
    toast.promise(refetch(), {
      loading: 'Atualizando...',
      success: 'Dados atualizados!',
      error: 'Erro ao atualizar',
    });
  };

  const handleEdit = (account: AccountsPayableWithId) => {
    setEditingAccount(account);
    setEditDialogOpen(true);
  };

  const filteredData = (accountsData || [])
    .filter((entry) => {
      const matchesSearch =
        entry.creditor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.category?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
      const matchesCenter = centerFilter === 'all' || entry.costCenter === centerFilter;

      return matchesSearch && matchesStatus && matchesCenter;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'dueDate':
          const [dayA, monthA, yearA] = a.dueDate.split('/');
          const [dayB, monthB, yearB] = b.dueDate.split('/');
          const dateA = new Date(Number(yearA), Number(monthA) - 1, Number(dayA));
          const dateB = new Date(Number(yearB), Number(monthB) - 1, Number(dayB));
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case 'creditor':
          comparison = a.creditor.localeCompare(b.creditor);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const statusBadgeClass = (status: string) => {
    const color = getStatusColor(status);
    return `badge-${color}`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  // Mobile Card View
  const MobileCardView = ({ entry }: { entry: AccountsPayableWithId }) => (
    <div 
      className="bg-card border border-border rounded-lg p-4 space-y-3 active:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => handleEdit(entry)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-foreground truncate">{entry.creditor}</h4>
          <p className="text-sm text-muted-foreground truncate">{entry.description}</p>
        </div>
        <span className={cn(statusBadgeClass(entry.status), 'ml-2 flex-shrink-0')}>
          {entry.status}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xl font-bold text-foreground">{formatCurrency(entry.amount)}</span>
        <span className="text-sm text-muted-foreground">{entry.dueDate}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{entry.costCenter}</span>
          <span>•</span>
          <span>{entry.category}</span>
        </div>
        <Pencil className="w-4 h-4 text-primary" />
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Dados Detalhados</h1>
          <p className="text-sm text-muted-foreground">Visualize, edite ou exclua contas cadastradas</p>
        </div>

        {/* Filters */}
        <div className="chart-container mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por credor, descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px] min-h-[44px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Programado">Programado</SelectItem>
                <SelectItem value="A vencer">A vencer</SelectItem>
                <SelectItem value="Pago">Pago</SelectItem>
                <SelectItem value="Atrasado">Atrasado</SelectItem>
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

            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              className="min-h-[44px] min-w-[44px]"
            >
              <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-4">
          {filteredData.length} resultado(s) encontrado(s)
        </p>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {filteredData.map((entry) => (
            <MobileCardView key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block chart-container overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('dueDate')}
                >
                  Vencimento <SortIcon field="dueDate" />
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('creditor')}
                >
                  Credor <SortIcon field="creditor" />
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('category')}
                >
                  Categoria <SortIcon field="category" />
                </TableHead>
                <TableHead>Centro</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground text-right"
                  onClick={() => handleSort('amount')}
                >
                  Valor <SortIcon field="amount" />
                </TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </TableHead>
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((entry) => (
                <TableRow key={entry.id} className="group">
                  <TableCell className="whitespace-nowrap">{entry.dueDate}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {entry.creditor}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {entry.description}
                  </TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{entry.costCenter}</TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap">
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>{entry.paymentMethod}</TableCell>
                  <TableCell>
                    <span className={statusBadgeClass(entry.status)}>{entry.status}</span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(entry)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredData.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum resultado encontrado</p>
          </div>
        )}
      </div>

      <EditAccountDialog
        account={editingAccount}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </AppLayout>
  );
};

export default Detalhes;
