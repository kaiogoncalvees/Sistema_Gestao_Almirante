import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { WeeklyChartData } from '@/types/accounts-payable';
import { formatCurrency } from '@/utils/dataProcessing';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyPaymentChartProps {
  data: WeeklyChartData[];
}

export const WeeklyPaymentChart = ({ data }: WeeklyPaymentChartProps) => {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const chartData = data.map(week => ({
    name: week.label,
    amount: week.total,
    dateRange: week.dateRange,
    count: week.count,
  }));

  const toggleWeek = (index: number) => {
    setExpandedWeek(expandedWeek === index ? null : index);
  };

  return (
    <div className="chart-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Pagamentos - Visão Semanal</h3>
          <p className="text-sm text-muted-foreground">Próximas 4 semanas (Segunda a Sexta)</p>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-md)',
            }}
            formatter={(value: number) => [formatCurrency(value), 'Valor Total']}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return `${label} (${payload[0].payload.dateRange}) - ${payload[0].payload.count} contas`;
              }
              return label;
            }}
            cursor={{ fill: 'hsl(var(--muted) / 0.2)' }}
          />
          <Bar 
            dataKey="amount" 
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? '#1f2937' : '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Weekly Details with Expandable Cost Center Breakdown */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.map((week, index) => (
          <div 
            key={index}
            className="rounded-lg border border-border bg-card/50 overflow-hidden transition-all"
          >
            {/* Collapsed Header - Always Visible */}
            <button
              onClick={() => toggleWeek(index)}
              className="w-full p-4 hover:bg-card transition-colors text-left"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground">
                  {week.label.toUpperCase()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {week.dateRange}
                  </span>
                  {expandedWeek === index ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mb-2">
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(week.total)}
                </span>
                <span className="text-sm text-muted-foreground">
                  • {week.count} contas
                </span>
              </div>
              {week.topPayments.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  Principais: {week.topPayments.slice(0, 2).join(', ')}
                </p>
              )}
            </button>

            {/* Expanded Details - Cost Center Breakdown */}
            <div className={cn(
              "overflow-hidden transition-all duration-300",
              expandedWeek === index ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
            )}>
              <div className="p-4 pt-0 space-y-4 border-t border-border">
                {/* ILHA Section */}
                {week.ilhaCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">ILHA</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {week.ilhaCount} contas
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {week.ilhaBills.map((bill, billIndex) => (
                        <div key={billIndex} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground truncate mr-2">
                            {bill.creditor}
                          </span>
                          <span className="font-medium text-foreground whitespace-nowrap">
                            {formatCurrency(bill.amount)}
                          </span>
                        </div>
                      ))}
                      {week.ilhaCount > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ... e mais {week.ilhaCount - 5} contas
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/50 ml-6">
                      <span className="text-sm font-medium text-foreground">SUBTOTAL ILHA</span>
                      <span className="text-sm font-bold text-foreground">
                        {formatCurrency(week.ilhaTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {/* TROPICAL Section */}
                {week.tropicalCount > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-success" />
                      <span className="text-sm font-semibold text-foreground">TROPICAL</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {week.tropicalCount} contas
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {week.tropicalBills.map((bill, billIndex) => (
                        <div key={billIndex} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground truncate mr-2">
                            {bill.creditor}
                          </span>
                          <span className="font-medium text-foreground whitespace-nowrap">
                            {formatCurrency(bill.amount)}
                          </span>
                        </div>
                      ))}
                      {week.tropicalCount > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ... e mais {week.tropicalCount - 5} contas
                        </p>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-border/50 ml-6">
                      <span className="text-sm font-medium text-foreground">SUBTOTAL TROPICAL</span>
                      <span className="text-sm font-bold text-foreground">
                        {formatCurrency(week.tropicalTotal)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Total Geral */}
                <div className="flex justify-between items-center pt-3 border-t-2 border-border">
                  <span className="text-sm font-bold text-foreground">TOTAL GERAL</span>
                  <span className="text-base font-bold text-foreground">
                    {formatCurrency(week.total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
