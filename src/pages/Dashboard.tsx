import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  format, parse, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isToday, addMonths, subMonths, isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Plus, Check, X } from 'lucide-react';

import { AppLayout } from '@/components/layout/AppLayout';
import { NovaContaDialog } from '@/components/contas/NovaContaDialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchContasAPagar, marcarComoPago, ContaAPagar } from '@/services/contasAPagar';
import { fmtBRL, fmtCompact, parseDMY, dayKey } from '@/utils/format';
import { cn } from '@/lib/utils';

// ── Main Page ──────────────────────────────────────────────────

export default function Dashboard() {
  const [calMonth,    setCalMonth]    = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(dayKey(new Date()));
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [confirmPago, setConfirmPago] = useState<ContaAPagar | null>(null);

  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: allContas = [], isLoading } = useQuery({
    queryKey: ['contas-a-pagar'],
    queryFn:  () => fetchContasAPagar(),
    staleTime: 60_000,
  });

  // Saídas reais do mês corrente vindas do extrato bancário
  const mesKey = format(new Date(), 'yyyy-MM');
  const { data: saídasMes = [] } = useQuery({
    queryKey: ['movimentacoes', 'saidas-mes', mesKey],
    queryFn: async () => {
      const inicio = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const fim    = format(endOfMonth(new Date()),   'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('movimentacoes')
        .select('valor')
        .gte('data_movimento', inicio)
        .lte('data_movimento', fim)
        .eq('tipo_operacao', 'Débito');
      if (error) throw error;
      return (data ?? []) as { valor: number }[];
    },
    staleTime: 60_000,
  });

  // Bills do mês exibido no calendário
  const calBillsByDay = useMemo(() => {
    const map = new Map<string, ContaAPagar[]>();
    allContas
      .filter(c => isSameMonth(parseDMY(c.dataVencimento), calMonth))
      .forEach(c => {
        const k = dayKey(parseDMY(c.dataVencimento));
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
      });
    return map;
  }, [allContas, calMonth]);

  // ── Widgets data ────────────────────────────────────────────

  const urgency = useMemo(() => {
    const atrasadas = allContas.filter(c => c.status === 'Atrasado');
    const hoje      = allContas.filter(c => c.status === 'Pendente' && c.diasParaVencer === 0);
    return { atrasadas, hoje, hasAlert: atrasadas.length > 0 || hoje.length > 0 };
  }, [allContas]);

  const mesProgress = useMemo(() => {
    // Realizado = soma das saídas do extrato bancário no mês atual
    const realizado = saídasMes.reduce((s, m) => s + Math.abs(m.valor), 0);

    // Previsto = contas a pagar do mês (exceto canceladas)
    const contasMes = allContas.filter(c =>
      isSameMonth(parseDMY(c.dataVencimento), new Date()) && c.status !== 'Cancelado'
    );
    const previsto = contasMes.reduce((s, c) => s + c.valor, 0);
    const pendente = contasMes
      .filter(c => c.status === 'Pendente' || c.status === 'Atrasado')
      .reduce((s, c) => s + c.valor, 0);

    // % baseado no maior entre realizado e previsto (evita ultrapassar 100%)
    const base = Math.max(previsto, realizado);
    const pct  = base > 0 ? Math.min(Math.round((realizado / base) * 100), 100) : 0;
    return { realizado, previsto, pendente, pct, count: contasMes.length };
  }, [allContas, saídasMes]);

  const centroBreakdown = useMemo(() => {
    const aberto = allContas.filter(c => c.status === 'Pendente' || c.status === 'Atrasado');
    const build  = (nome: string) => {
      const arr = aberto.filter(c => c.centroCusto === nome);
      return { valor: arr.reduce((s, c) => s + c.valor, 0), count: arr.length };
    };
    return { ilha: build('Ilha'), tropical: build('Tropical') };
  }, [allContas]);

  const cashFlow = useMemo(() => {
    const pending = allContas.filter(c =>
      (c.status === 'Pendente' || c.status === 'Atrasado') &&
      c.diasParaVencer >= 0 && c.diasParaVencer <= 30
    );
    return [
      { label: 'Esta sem.',  min: 0,  max: 6  },
      { label: 'Próx. sem.', min: 7,  max: 13 },
      { label: '3ª sem.',    min: 14, max: 20 },
      { label: '4ª sem.',    min: 21, max: 30 },
    ].map(w => {
      const slice = pending.filter(c => c.diasParaVencer >= w.min && c.diasParaVencer <= w.max);
      return { label: w.label, valor: slice.reduce((s, c) => s + c.valor, 0), count: slice.length };
    });
  }, [allContas]);

  const listaUrgente = useMemo(() => {
    return allContas
      .filter(c => (c.status === 'Pendente' || c.status === 'Atrasado') && c.diasParaVencer <= 3)
      .sort((a, b) => a.diasParaVencer - b.diasParaVencer)
      .slice(0, 8);
  }, [allContas]);

  const selectedDayBills = useMemo(
    () => (selectedDay ? calBillsByDay.get(selectedDay) ?? [] : []),
    [selectedDay, calBillsByDay]
  );

  // ── Actions ─────────────────────────────────────────────────

  const invalidate = () => qc.invalidateQueries({ queryKey: ['contas-a-pagar'] });

  const handlePagar = async (conta: ContaAPagar) => {
    try {
      await marcarComoPago(conta.id);
      invalidate();
      toast({ title: 'Marcada como paga!' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
    setConfirmPago(null);
  };

  const goCalBack    = () => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); };
  const goCalForward = () => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4 pb-24 md:pb-6 max-w-[1400px]">

        {/* ── Alerta de urgência ──────────────────────────── */}
        {urgency.hasAlert && !alertDismissed && (
          <AlertaBanner
            atrasadas={urgency.atrasadas}
            hoje={urgency.hoje}
            onDismiss={() => setAlertDismissed(true)}
            onPagar={setConfirmPago}
          />
        )}

        {/* ── Header row ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Visão Geral</h1>
          <NovaContaDialog
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nova Conta</span>
              </Button>
            }
            onSuccess={invalidate}
          />
        </div>

        {/* ── Progresso + Centro ─────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProgressoMes {...mesProgress} />
          <CentroBreakdown {...centroBreakdown} />
        </div>

        {/* ── Calendário + Detalhe do dia ─────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-[300px,1fr] gap-4">
          <CalendarioCompacto
            calMonth={calMonth}
            billsByDay={calBillsByDay}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onBack={goCalBack}
            onForward={goCalForward}
          />
          <PainelDia
            day={selectedDay}
            bills={selectedDayBills}
            allBills={allContas}
            calMonth={calMonth}
            onPagar={setConfirmPago}
          />
        </div>

        {/* ── Lista urgente + Projeção ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ListaUrgente bills={listaUrgente} onPagar={setConfirmPago} />
          <ProjecaoCaixa data={cashFlow} />
        </div>

      </div>

      {/* ── FAB mobile ─────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <NovaContaDialog
          trigger={
            <Button size="icon" className="h-12 w-12 rounded-full shadow-lg">
              <Plus className="w-5 h-5" />
            </Button>
          }
          onSuccess={invalidate}
        />
      </div>

      {/* ── Confirm Pay ────────────────────────────────────── */}
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
    </AppLayout>
  );
}

// ── AlertaBanner ───────────────────────────────────────────────

function AlertaBanner({
  atrasadas, hoje, onDismiss, onPagar,
}: {
  atrasadas: ContaAPagar[];
  hoje: ContaAPagar[];
  onDismiss: () => void;
  onPagar: (c: ContaAPagar) => void;
}) {
  const totalAtrasado = atrasadas.reduce((s, c) => s + c.valor, 0);
  const totalHoje     = hoje.reduce((s, c) => s + c.valor, 0);
  const isRed         = atrasadas.length > 0;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex items-start gap-3',
      isRed
        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
        : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    )}>
      <AlertTriangle className={cn('w-5 h-5 mt-0.5 shrink-0', isRed ? 'text-red-500' : 'text-orange-500')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', isRed ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300')}>
          {isRed
            ? `${atrasadas.length} conta${atrasadas.length > 1 ? 's' : ''} em atraso — ${fmtBRL(totalAtrasado)}`
            : `${hoje.length} conta${hoje.length > 1 ? 's' : ''} vence${hoje.length === 1 ? ' hoje' : 'm hoje'} — ${fmtBRL(totalHoje)}`
          }
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {[...atrasadas, ...hoje].slice(0, 3).map(c => (
            <button
              key={c.id}
              onClick={() => onPagar(c)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 transition-colors',
                isRed
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200'
                  : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200',
              )}
            >
              <Check className="w-3 h-3" />
              {c.descricao.length > 20 ? c.descricao.slice(0, 20) + '…' : c.descricao}
            </button>
          ))}
          {[...atrasadas, ...hoje].length > 3 && (
            <span className="text-xs text-muted-foreground self-center">
              +{[...atrasadas, ...hoje].length - 3} mais
            </span>
          )}
        </div>
      </div>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── ProgressoMes ───────────────────────────────────────────────

function ProgressoMes({ realizado, previsto, pendente, pct, count }: {
  realizado: number; previsto: number; pendente: number; pct: number; count: number;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Pagamentos do Mês</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Realizado via extrato bancário</p>
        </div>
        <span className="text-xs text-muted-foreground">{count} contas</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Realizado vs. previsto</span>
          <span className="font-medium text-foreground">{pct}%</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <p className="text-xs text-muted-foreground">Realizado (extrato)</p>
          <p className="text-base font-bold text-green-600 dark:text-green-400">{fmtBRL(realizado)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">A pagar</p>
          <p className="text-base font-bold">{fmtBRL(pendente)}</p>
        </div>
      </div>
    </div>
  );
}

// ── CentroBreakdown ────────────────────────────────────────────

function CentroBreakdown({ ilha, tropical }: {
  ilha:     { valor: number; count: number };
  tropical: { valor: number; count: number };
}) {
  const total = ilha.valor + tropical.valor;
  const pctIlha     = total > 0 ? Math.round((ilha.valor / total) * 100)     : 50;
  const pctTropical = total > 0 ? Math.round((tropical.valor / total) * 100) : 50;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <p className="text-sm font-semibold">Em Aberto por Centro</p>

      <div className="space-y-2.5">
        {[
          { label: 'Ilha',     data: ilha,     pct: pctIlha,     color: 'bg-foreground' },
          { label: 'Tropical', data: tropical, pct: pctTropical, color: 'bg-muted-foreground' },
        ].map(({ label, data, pct, color }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">{label}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{data.count} contas</span>
                <span className="text-sm font-bold">{fmtBRL(data.valor)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {total === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma conta em aberto</p>
      )}
    </div>
  );
}

// ── CalendarioCompacto ─────────────────────────────────────────

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function CalendarioCompacto({ calMonth, billsByDay, selectedDay, onSelectDay, onBack, onForward }: {
  calMonth: Date;
  billsByDay: Map<string, ContaAPagar[]>;
  selectedDay: string | null;
  onSelectDay: (k: string) => void;
  onBack: () => void;
  onForward: () => void;
}) {
  const calStart = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 1 });
  const calEnd   = endOfWeek(endOfMonth(calMonth),     { weekStartsOn: 1 });
  const allDays  = eachDayOfInterval({ start: calStart, end: calEnd });
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <button onClick={onBack} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold capitalize">
          {format(calMonth, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={onForward} className="p-1 rounded hover:bg-muted transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5 uppercase">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="divide-y divide-border">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-border">
            {week.map(day => {
              const key   = dayKey(day);
              const bills = billsByDay.get(key) ?? [];
              const inMth = isSameMonth(day, calMonth);
              const today = isToday(day);
              const sel   = selectedDay === key;

              const hasAtrasada = bills.some(b => b.status === 'Atrasado');
              const hasHoje     = bills.some(b => b.status === 'Pendente' && b.diasParaVencer === 0);
              const hasUrgente  = bills.some(b => b.status === 'Pendente' && b.diasParaVencer <= 3);
              const hasPendente = bills.some(b => b.status === 'Pendente');
              const allPago     = bills.length > 0 && bills.every(b => b.status === 'Pago' || b.status === 'Cancelado');

              const dotColor =
                hasAtrasada ? 'bg-red-500'    :
                hasHoje     ? 'bg-orange-500' :
                hasUrgente  ? 'bg-amber-400'  :
                hasPendente ? 'bg-primary'    :
                allPago     ? 'bg-green-500'  : null;

              return (
                <button
                  key={key}
                  onClick={() => onSelectDay(key)}
                  disabled={!inMth}
                  className={cn(
                    'flex flex-col items-center py-2 gap-1 transition-colors',
                    inMth ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-20 cursor-default',
                    sel && 'bg-primary/10',
                  )}
                >
                  <span className={cn(
                    'w-7 h-7 flex items-center justify-center rounded-full text-xs font-medium',
                    today && 'bg-primary text-primary-foreground',
                    sel && !today && 'ring-1 ring-primary text-primary',
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dotColor
                    ? <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
                    : <span className="w-1.5 h-1.5" />
                  }
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PainelDia ──────────────────────────────────────────────────

function PainelDia({ day, bills, allBills, calMonth, onPagar }: {
  day: string | null;
  bills: ContaAPagar[];
  allBills: ContaAPagar[];
  calMonth: Date;
  onPagar: (c: ContaAPagar) => void;
}) {
  // Resumo do mês para o painel quando nenhum dia está selecionado
  const monthSummary = useMemo(() => {
    const mes = allBills.filter(c =>
      isSameMonth(parseDMY(c.dataVencimento), calMonth) && c.status !== 'Cancelado'
    );
    const total = mes.reduce((s, c) => s + c.valor, 0);
    const pago  = mes.filter(c => c.status === 'Pago').reduce((s, c) => s + c.valor, 0);
    return { total, pago, count: mes.length };
  }, [allBills, calMonth]);

  if (!day) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 flex flex-col items-center justify-center text-center min-h-[280px]">
        <Clock className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Selecione um dia</p>
        <p className="text-xs text-muted-foreground mt-1">
          {monthSummary.count} contas em {format(calMonth, 'MMMM', { locale: ptBR })} · {fmtBRL(monthSummary.total)} total
        </p>
      </div>
    );
  }

  const date  = parse(day, 'yyyy-MM-dd', new Date());
  const total = bills.reduce((s, b) => s + b.valor, 0);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col min-h-[280px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
        <div>
          <p className="text-sm font-semibold capitalize">
            {format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            {isToday(date) && <span className="ml-2 text-xs text-primary font-normal">Hoje</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {bills.length > 0
              ? `${bills.length} conta${bills.length > 1 ? 's' : ''} · ${fmtBRL(total)}`
              : 'Nenhuma conta'}
          </p>
        </div>
      </div>

      {/* Bills */}
      {bills.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Dia livre</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {bills.map(b => (
            <BillRow key={b.id} conta={b} onPagar={() => onPagar(b)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ListaUrgente ───────────────────────────────────────────────

function ListaUrgente({ bills, onPagar }: {
  bills: ContaAPagar[];
  onPagar: (c: ContaAPagar) => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Clock className="w-4 h-4 text-orange-500" />
        <p className="text-sm font-semibold">Atenção Imediata</p>
        {bills.length > 0 && (
          <span className="ml-auto text-xs bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full">
            {bills.length}
          </span>
        )}
      </div>

      {bills.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma conta urgente
        </div>
      ) : (
        <div className="divide-y divide-border">
          {bills.map(b => (
            <div key={b.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.descricao}</p>
                <p className="text-xs text-muted-foreground">
                  {b.status === 'Atrasado'
                    ? <span className="text-red-500">{Math.abs(b.diasParaVencer)}d em atraso</span>
                    : b.diasParaVencer === 0
                      ? <span className="text-orange-500">Vence hoje</span>
                      : <span className="text-amber-500">Vence em {b.diasParaVencer}d</span>
                  }
                  {b.centroCusto && ` · ${b.centroCusto}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold">{fmtBRL(b.valor)}</span>
                <button
                  onClick={() => onPagar(b)}
                  className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 flex items-center justify-center transition-colors"
                  title="Marcar como pago"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProjecaoCaixa ──────────────────────────────────────────────

function ProjecaoCaixa({ data }: {
  data: { label: string; valor: number; count: number }[];
}) {
  const maxValor = Math.max(...data.map(d => d.valor), 1);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold">Projeção — próximos 30 dias</p>
        <p className="text-xs text-muted-foreground">Saídas previstas por semana</p>
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-end gap-2 h-28">
          {data.map((item, i) => {
            const heightPct = (item.valor / maxValor) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {item.valor > 0 ? fmtCompact(item.valor) : '—'}
                </span>
                <div className="w-full flex items-end" style={{ height: '68px' }}>
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-700',
                      i === 0 ? 'bg-orange-400 dark:bg-orange-500' : 'bg-primary/60',
                      item.valor === 0 && 'bg-muted',
                    )}
                    style={{ height: item.valor > 0 ? `${Math.max(heightPct, 6)}%` : '4px' }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground text-center leading-none">
                  {item.label}
                </span>
                {item.count > 0 && (
                  <span className="text-[9px] text-muted-foreground/60">{item.count}c</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── BillRow ────────────────────────────────────────────────────

function BillRow({ conta, onPagar }: { conta: ContaAPagar; onPagar: () => void }) {
  const isPendente = conta.status === 'Pendente' || conta.status === 'Atrasado';

  const leftBorder =
    conta.status === 'Atrasado'   ? 'border-l-[3px] border-red-500'    :
    conta.diasParaVencer === 0    ? 'border-l-[3px] border-orange-500' :
    conta.diasParaVencer <= 3     ? 'border-l-[3px] border-amber-400'  : '';

  const nameColor =
    conta.status === 'Atrasado'   ? 'text-red-600 dark:text-red-400'       :
    conta.diasParaVencer === 0    ? 'text-orange-600 dark:text-orange-400' :
    conta.diasParaVencer <= 3     ? 'text-amber-600 dark:text-amber-400'   : '';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5',
      leftBorder,
      conta.status === 'Pago' && 'opacity-50',
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium truncate', nameColor)}>{conta.descricao}</p>
        <p className="text-xs text-muted-foreground truncate">
          {[conta.credor, conta.categoria].filter(Boolean).join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold">{fmtBRL(conta.valor)}</span>
        {isPendente && (
          <button
            onClick={onPagar}
            className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 flex items-center justify-center transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
