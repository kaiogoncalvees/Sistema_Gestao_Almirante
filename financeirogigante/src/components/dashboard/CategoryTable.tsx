import { CategoryBreakdown } from '@/types/accounts-payable';
import { formatCurrency } from '@/utils/dataProcessing';
import { Package, TrendingUp, Building2, Zap, FileText, ShoppingCart, Wrench } from 'lucide-react';

interface CategoryTableProps {
  categories: CategoryBreakdown[];
}

const getCategoryIcon = (category: string) => {
  const lower = category.toLowerCase();
  if (lower.includes('material') || lower.includes('revenda')) return <ShoppingCart className="w-4 h-4" />;
  if (lower.includes('fornecedor')) return <Package className="w-4 h-4" />;
  if (lower.includes('serviço')) return <Zap className="w-4 h-4" />;
  if (lower.includes('imposto')) return <FileText className="w-4 h-4" />;
  if (lower.includes('aluguel')) return <Building2 className="w-4 h-4" />;
  if (lower.includes('manutenção')) return <Wrench className="w-4 h-4" />;
  return <TrendingUp className="w-4 h-4" />;
};

export const CategoryTable = ({ categories }: CategoryTableProps) => {
  return (
    <div className="chart-container animate-fade-in">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Top 5 Categorias</h3>
        <p className="text-sm text-muted-foreground">Principais categorias por valor</p>
      </div>
      
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="data-table min-w-full">
          <thead>
            <tr>
              <th>Categoria</th>
              <th className="text-right">Valor</th>
              <th className="text-right hidden sm:table-cell">% do Total</th>
              <th className="text-center hidden md:table-cell">Nº de Contas</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category.category} style={{ animationDelay: `${index * 50}ms` }}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      {getCategoryIcon(category.category)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate text-sm">{category.category}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {category.percentage.toFixed(1)}% • {category.count} contas
                      </p>
                    </div>
                  </div>
                </td>
                <td className="text-right font-semibold text-foreground whitespace-nowrap">
                  {formatCurrency(category.amount)}
                </td>
                <td className="text-right hidden sm:table-cell">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(category.percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground min-w-[3rem]">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="text-center hidden md:table-cell">
                  <span className="text-sm font-medium text-foreground">{category.count}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
