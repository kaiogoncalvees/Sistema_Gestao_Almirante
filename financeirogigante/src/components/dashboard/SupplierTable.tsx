import { SupplierData } from '@/types/accounts-payable';
import { formatCurrency } from '@/utils/dataProcessing';
import { MoreVertical, Eye } from 'lucide-react';

interface SupplierTableProps {
  suppliers: SupplierData[];
  title?: string;
  subtitle?: string;
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (index: number): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
  ];
  return colors[index % colors.length];
};

export const SupplierTable = ({ 
  suppliers, 
  title = "Top 5 Fornecedores - Materiais para Revenda",
  subtitle = "Apenas categoria: Materiais para Revenda"
}: SupplierTableProps) => {
  return (
    <div className="chart-container animate-fade-in">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      
      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum fornecedor encontrado nesta categoria
        </p>
      ) : (
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="data-table min-w-full">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th className="text-center hidden sm:table-cell">Nº de Contas</th>
                <th className="text-right">Valor Total</th>
                <th className="text-center hidden md:table-cell">Ações</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, index) => (
                <tr key={supplier.name} style={{ animationDelay: `${index * 50}ms` }}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${getAvatarColor(index)} flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0`}>
                        {getInitials(supplier.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate text-sm">{supplier.name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {supplier.billCount} contas
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center hidden sm:table-cell">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                      {supplier.billCount}
                    </span>
                  </td>
                  <td className="text-right font-semibold text-foreground whitespace-nowrap">
                    {formatCurrency(supplier.totalAmount)}
                  </td>
                  <td className="hidden md:table-cell">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors group">
                        <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-muted transition-colors group">
                        <MoreVertical className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
