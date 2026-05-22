import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, Building2, CreditCard } from 'lucide-react';
import { AccountsPayableEntry } from '@/types/accounts-payable';
import { formatCurrency, getStatusColor } from '@/utils/dataProcessing';
import { cn } from '@/lib/utils';

interface DailyCardsProps {
  data: AccountsPayableEntry[];
  selectedDate: Date;
}

export const DailyCards = ({ data, selectedDate }: DailyCardsProps) => {
  // Filter data for the selected date
  const todayEntries = data.filter((entry) => {
    const [day, month, year] = entry.dueDate.split('/');
    const entryDate = new Date(Number(year), Number(month) - 1, Number(day));
    return (
      entryDate.getDate() === selectedDate.getDate() &&
      entryDate.getMonth() === selectedDate.getMonth() &&
      entryDate.getFullYear() === selectedDate.getFullYear()
    );
  });

  const totalAmount = todayEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const statusBadgeClass = (status: string) => {
    const color = getStatusColor(status);
    return `badge-${color}`;
  };

  if (todayEntries.length === 0) {
    return (
      <div className="chart-container">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">
            {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </h3>
        </div>
        <div className="text-center py-8">
          <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">Nenhuma conta para esta data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="chart-container">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
            <p className="text-sm text-muted-foreground">{todayEntries.length} conta(s)</p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {todayEntries.map((entry, index) => (
          <div
            key={index}
            className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate">{entry.creditor}</h4>
                <p className="text-sm text-muted-foreground truncate">{entry.description}</p>
              </div>
              <span className={cn(statusBadgeClass(entry.status), 'ml-2 flex-shrink-0')}>
                {entry.status}
              </span>
            </div>

            {/* Amount */}
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-success" />
              <span className="text-xl font-bold text-foreground">{formatCurrency(entry.amount)}</span>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span>{entry.costCenter}</span>
                <span className="text-border">•</span>
                <span>{entry.category}</span>
              </div>
              {entry.paymentMethod && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="w-4 h-4" />
                  <span>{entry.paymentMethod}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
