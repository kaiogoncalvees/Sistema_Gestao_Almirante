import { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface ParsedRow {
  credor: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_programacao: string | null;
  categoria: string;
  centro_custo: string;
  forma_pagamento: string;
  status: string;
  pix_codigo: string | null;
}

interface CSVImportProps {
  onClose?: () => void;
}

export const CSVImport = ({ onClose }: CSVImportProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const parseCSV = (text: string): { data: ParsedRow[]; errors: string[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    const errors: string[] = [];
    const data: ParsedRow[] = [];

    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes('credor') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const columns = line.split(';').map(col => col.trim().replace(/^"|"$/g, ''));
      
      if (columns.length < 7) {
        errors.push(`Linha ${i + 1}: Número insuficiente de colunas`);
        continue;
      }

      try {
        // Parse value - handle Brazilian number format
        const valorStr = columns[6]?.replace(/[^\d,.-]/g, '').replace(',', '.');
        const valor = parseFloat(valorStr);
        
        if (isNaN(valor)) {
          errors.push(`Linha ${i + 1}: Valor inválido "${columns[6]}"`);
          continue;
        }

        // Parse date - accept dd/mm/yyyy format
        const dataVencimento = columns[0];
        if (!dataVencimento || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataVencimento)) {
          errors.push(`Linha ${i + 1}: Data de vencimento inválida "${dataVencimento}"`);
          continue;
        }

        // Convert to YYYY-MM-DD for database
        const [day, month, year] = dataVencimento.split('/');
        const formattedDate = `${year}-${month}-${day}`;

        let formattedScheduleDate: string | null = null;
        if (columns[1] && /^\d{2}\/\d{2}\/\d{4}$/.test(columns[1])) {
          const [sDay, sMonth, sYear] = columns[1].split('/');
          formattedScheduleDate = `${sYear}-${sMonth}-${sDay}`;
        }

        data.push({
          credor: columns[2] || '',
          descricao: columns[3] || '',
          valor,
          data_vencimento: formattedDate,
          data_programacao: formattedScheduleDate,
          categoria: columns[4] || 'Outros',
          centro_custo: columns[5] || 'Ilha',
          forma_pagamento: columns[7] || 'PIX',
          status: columns[8] || 'Pendente',
          pix_codigo: columns[9] || null,
        });
      } catch (e) {
        errors.push(`Linha ${i + 1}: Erro ao processar linha`);
      }
    }

    return { data, errors };
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV');
      return;
    }

    setFile(file);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);
      setParsedData(result.data);
      setErrors(result.errors);
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (parsedData.length === 0) {
      toast.error('Nenhum dado válido para importar');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Insert in batches of 50
      const batchSize = 50;
      let imported = 0;

      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        
        const { error } = await supabase.from('contas_a_pagar').insert(batch);
        
        if (error) throw error;
        
        imported += batch.length;
        setImportProgress(Math.round((imported / parsedData.length) * 100));
      }

      toast.success(`${parsedData.length} registro(s) importado(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      
      // Reset state
      setFile(null);
      setParsedData([]);
      setErrors([]);
      onClose?.();
    } catch (error: any) {
      toast.error('Erro ao importar dados', {
        description: error.message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground mb-1">
            Arraste um arquivo CSV ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Formato: Vencimento;Programação;Credor;Descrição;Categoria;Centro;Valor;Pagamento;Status;PIX
          </p>
        </div>
      )}

      {/* File Selected */}
      {file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {parsedData.length} registro(s) válido(s)
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-danger/10 rounded-lg p-3 max-h-32 overflow-y-auto">
              <div className="flex items-center gap-2 text-danger mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{errors.length} erro(s) encontrado(s)</span>
              </div>
              <ul className="space-y-1">
                {errors.slice(0, 5).map((error, i) => (
                  <li key={i} className="text-xs text-danger/80">{error}</li>
                ))}
                {errors.length > 5 && (
                  <li className="text-xs text-danger/80">... e mais {errors.length - 5} erro(s)</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview */}
          {parsedData.length > 0 && (
            <div className="bg-success/10 rounded-lg p-3">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Prévia dos dados</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {parsedData.slice(0, 3).map((row, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">
                    {row.credor} - R$ {row.valor.toFixed(2)} - {row.status}
                  </p>
                ))}
                {parsedData.length > 3 && (
                  <p className="text-xs text-muted-foreground">... e mais {parsedData.length - 3} registro(s)</p>
                )}
              </div>
            </div>
          )}

          {/* Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Importando...</span>
                <span className="font-medium">{importProgress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={resetForm}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 min-h-[44px]"
              onClick={handleImport}
              disabled={parsedData.length === 0 || isImporting}
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Importar {parsedData.length} registro(s)
            </Button>
          </div>
        </div>
      )}

      {/* Template Download */}
      <div className="text-center pt-2">
        <button
          onClick={() => {
            const template = 'Vencimento;Programação;Credor;Descrição;Categoria;Centro de Custo;Valor;Forma Pagamento;Status;PIX\n' +
              '01/01/2025;;Fornecedor Exemplo;Descrição da conta;Materiais para Revenda;Ilha;1500,00;PIX;Pendente;';
            const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'template_importacao.csv';
            link.click();
          }}
          className="text-xs text-primary hover:underline"
        >
          Baixar modelo CSV
        </button>
      </div>
    </div>
  );
};
