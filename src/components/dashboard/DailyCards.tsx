import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, TrendingUp, TrendingDown, Building2 } from 'lucide-react';
import { MovimentacaoEntry } from '@/types/accounts-payable';
import { formatCurrency } from '@/utils/dataProcessing';
import { cn } from '@/lib/utils';

interface DailyCardsProps {
  data: MovimentacaoEntry[];
  selectedDate: Date;
}

export const DailyCards = ({ data, selectedDate }: DailyCardsProps) => {
  const dayEntries = data.filter(e => {
    if (!e.dataMovimento) return false;
    const [day, month, year] = e.dataMovimento.split('/').map(Number);
    const d = new Date(year, month - 1, day);
    return (
      d.getDate()     === selectedDate.getDate() &&
      d.getMonth()    === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  });

  const totalEntradas = dayEntries
    .filter(e => e.tipoOperacao === 'Crédito')
    .reduce((s, e) => s + Math.abs(e.valor), 0);
  const totalSaidas = dayEntries
    .filter(e => e.tipoOperacao === 'Débito')
    .reduce((s, e) => s + Math.abs(e.valor), 0);

  if (dayEntries.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="text-muted-foreground">Nenhuma movimentação nesta data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo do dia */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          {dayEntries.length} movimentação(ões) em{' '}
          {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
        </p>
        <div className="flex gap-4 text-sm">
          <span className="text-success font-semibold">+{formatCurrency(totalEntradas)}</span>
          <span className="text-danger font-semibold">-{formatCurrency(totalSaidas)}</span>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {dayEntries.map((entry, index) => {
          const isCredito = entry.tipoOperacao === 'Crédito';
          return (
            <div
              key={index}
              className={cn(
                'bg-card border rounded-xl p-4 shadow-sm',
                isCredito ? 'border-success/30' : 'border-danger/30'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {entry.descricao || entry.credor || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{entry.categoria}</p>
                </div>
                <div className={cn(
                  'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ml-2 flex-shrink-0',
                  isCredito
                    ? 'bg-success/10 text-success'
                    : 'bg-danger/10 text-danger'
                )}>
                  {isCredito
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />}
                  {entry.tipoOperacao}
                </div>
              </div>

              <p className={cn(
                'text-xl font-bold',
                isCredito ? 'text-success' : 'text-danger'
              )}>
                {isCredito ? '+' : '-'}{formatCurrency(Math.abs(entry.valor))}
              </p>

              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{entry.contaBancaria || entry.centroCusto}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
