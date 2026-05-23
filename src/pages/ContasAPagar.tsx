import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Plus, AlertTriangle, Clock, CheckCircle2, XCircle, Trash2, Check } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { NovaContaDialog } from '@/components/contas/NovaContaDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  fetchContasAPagar, marcarComoPago, excluirConta,
  ContaAPagar, FetchContasFilters,
} from '@/services/contasAPagar';
import { fmtBRL } from '@/utils/format';

// ── Helpers ────────────────────────────────────────────────────

function urgencyClass(conta: ContaAPagar): string {
  if (conta.status === 'Pago')      return 'opacity-60';
  if (conta.status === 'Cancelado') return 'opacity-40 line-through';
  if (conta.diasParaVencer < 0)     return 'border-l-4 border-red-500';
  if (conta.diasParaVencer === 0)   return 'border-l-4 border-orange-500';
  if (conta.diasParaVencer <= 3)    return 'border-l-4 border-amber-400';
  return '';
}

function statusBadge(conta: ContaAPagar) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    Pendente:  { label: 'Pendente',  variant: 'secondary'   },
    Pago:      { label: 'Pago',      variant: 'default'     },
    Atrasado:  { label: 'Atrasado',  variant: 'destructive' },
    Cancelado: { label: 'Cancelado', variant: 'outline'     },
  };
  const s = map[conta.status] ?? map['Pendente'];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

function diasLabel(conta: ContaAPagar): string {
  if (conta.status === 'Pago' || conta.status === 'Cancelado') return '';
  if (conta.diasParaVencer < 0)  return `${Math.abs(conta.diasParaVencer)}d em atraso`;
  if (conta.diasParaVencer === 0) return 'Vence hoje';
  return `${conta.diasParaVencer}d`;
}

// ── Summary Cards ──────────────────────────────────────────────

function SummaryCards({ contas }: { contas: ContaAPagar[] }) {
  const atrasadas  = contas.filter(c => c.status === 'Atrasado');
  const hoje       = contas.filter(c => c.diasParaVencer === 0 && c.status === 'Pendente');
  const proximos7  = contas.filter(c => c.status === 'Pendente' && c.diasParaVencer > 0 && c.diasParaVencer <= 7);
  const totalMes   = contas.filter(c => c.status !== 'Pago' && c.status !== 'Cancelado');

  const soma = (arr: ContaAPagar[]) => arr.reduce((s, c) => s + c.valor, 0);

  const cards = [
    { label: 'Em Atraso',      value: soma(atrasadas),  count: atrasadas.length,  icon: AlertTriangle, color: 'text-red-500'    },
    { label: 'Vencem Hoje',    value: soma(hoje),        count: hoje.length,       icon: Clock,         color: 'text-orange-500' },
    { label: 'Próximos 7 dias',value: soma(proximos7),   count: proximos7.length,  icon: Clock,         color: 'text-amber-500'  },
    { label: 'Total em Aberto',value: soma(totalMes),    count: totalMes.length,   icon: XCircle,       color: 'text-muted-foreground' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(({ label, value, count, icon: Icon, color }) => (
        <div key={label} className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-4 h-4 ${color}`} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
          <p className="text-lg font-bold">{fmtBRL(value)}</p>
          <p className="text-xs text-muted-foreground">{count} conta{count !== 1 ? 's' : ''}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function ContasAPagar() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [centroFilter, setCentroFilter] = useState('all');
  const [confirmPago, setConfirmPago]   = useState<ContaAPagar | null>(null);
  const [confirmDel,  setConfirmDel]    = useState<ContaAPagar | null>(null);
  const [delFuturas,  setDelFuturas]    = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();

  const filters: FetchContasFilters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    centro: centroFilter !== 'all' ? centroFilter : undefined,
  }), [statusFilter, centroFilter]);

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-a-pagar', statusFilter, centroFilter],
    queryFn:  () => fetchContasAPagar(filters),
    staleTime: 30_000,
  });

  const handlePagar = async (conta: ContaAPagar) => {
    try {
      await marcarComoPago(conta.id);
      qc.invalidateQueries({ queryKey: ['contas-a-pagar'] });
      toast({ title: 'Marcada como paga!' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
    setConfirmPago(null);
  };

  const handleExcluir = async () => {
    if (!confirmDel) return;
    try {
      await excluirConta(confirmDel.id, delFuturas);
      qc.invalidateQueries({ queryKey: ['contas-a-pagar'] });
      toast({ title: 'Conta excluída.' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
    setConfirmDel(null);
    setDelFuturas(false);
  };

  // Split into groups for display
  const atrasadas = contas.filter(c => c.status === 'Atrasado');
  const pendentes = contas.filter(c => c.status === 'Pendente');
  const pagas     = contas.filter(c => c.status === 'Pago');
  const canceladas= contas.filter(c => c.status === 'Cancelado');

  const groups = [
    { key: 'atrasadas', label: 'Em Atraso',  items: atrasadas,  show: atrasadas.length > 0  },
    { key: 'pendentes', label: 'Pendentes',   items: pendentes,  show: pendentes.length > 0  },
    { key: 'pagas',     label: 'Pagas',       items: pagas,      show: pagas.length > 0      },
    { key: 'canceladas',label: 'Canceladas',  items: canceladas, show: canceladas.length > 0 },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">{contas.length} conta{contas.length !== 1 ? 's' : ''} encontrada{contas.length !== 1 ? 's' : ''}</p>
          </div>
          <NovaContaDialog
            trigger={
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova Conta</span>
              </Button>
            }
          />
        </div>

        {/* Summary Cards */}
        <SummaryCards contas={contas} />

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Atrasado">Atrasado</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={centroFilter} onValueChange={setCentroFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Centro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os centros</SelectItem>
              <SelectItem value="Ilha">Ilha</SelectItem>
              <SelectItem value="Tropical">Tropical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Carregando...</div>
        ) : contas.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma conta encontrada.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.filter(g => g.show).map(group => (
              <section key={group.key}>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  {group.label} ({group.items.length})
                </h2>
                <div className="space-y-2">
                  {group.items.map(conta => (
                    <ContaRow
                      key={conta.id}
                      conta={conta}
                      onPagar={() => setConfirmPago(conta)}
                      onExcluir={() => { setConfirmDel(conta); setDelFuturas(false); }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Confirm Pago */}
      <AlertDialog open={!!confirmPago} onOpenChange={v => !v && setConfirmPago(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPago?.descricao} — {confirmPago ? fmtBRL(confirmPago.valor) : ''}
              <br />Vencimento: {confirmPago?.dataVencimento}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPago && handlePagar(confirmPago)}>
              Confirmar Pago
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDel} onOpenChange={v => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.descricao}
              {confirmDel?.recorrente && (
                <span className="block mt-2 text-sm">
                  Esta é uma conta recorrente.{' '}
                  <button
                    className="text-primary underline"
                    onClick={() => setDelFuturas(v => !v)}
                  >
                    {delFuturas ? 'Excluir só esta' : 'Excluir esta e todas as futuras'}
                  </button>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleExcluir}>
              {delFuturas ? 'Excluir série' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ── ContaRow ───────────────────────────────────────────────────

function ContaRow({
  conta,
  onPagar,
  onExcluir,
}: {
  conta: ContaAPagar;
  onPagar: () => void;
  onExcluir: () => void;
}) {
  const isPendente = conta.status === 'Pendente' || conta.status === 'Atrasado';

  return (
    <div className={`bg-card rounded-xl border border-border p-3 md:p-4 flex items-start gap-3 ${urgencyClass(conta)}`}>
      {/* Left: info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{conta.descricao}</span>
          {conta.recorrente && (
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">recorrente</span>
          )}
          {statusBadge(conta)}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
          {conta.credor && <span>{conta.credor}</span>}
          <span>Venc. {conta.dataVencimento}</span>
          {conta.categoria && <span>{conta.categoria}</span>}
          {conta.centroCusto && <span>{conta.centroCusto}</span>}
        </div>

        {diasLabel(conta) && (
          <p className={`text-xs mt-0.5 font-medium ${conta.diasParaVencer < 0 ? 'text-red-500' : conta.diasParaVencer === 0 ? 'text-orange-500' : 'text-amber-500'}`}>
            {diasLabel(conta)}
          </p>
        )}
      </div>

      {/* Right: value + actions */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="font-bold text-sm">{fmtBRL(conta.valor)}</span>
        <div className="flex gap-1">
          {isPendente && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              title="Marcar como pago"
              onClick={onPagar}
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Excluir"
            onClick={onExcluir}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
