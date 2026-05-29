import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { parse as dateParse, isValid, format } from 'date-fns';
import { FileSpreadsheet, Trash2, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fmtBRL } from '@/utils/format';

interface PreviewRow {
  idx: number;
  credor: string;
  descricao: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  categoria: string;
  centroCusto: string;
  contaBancaria: string;
  observacao: string;
  isDuplicate: boolean;
  selected: boolean;
}

function normalizeHeader(h: string): string | null {
  const clean = String(h)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 _]/g, '')
    .trim();

  const MAP: Record<string, string> = {
    'credor': 'credor', 'fornecedor': 'credor', 'beneficiario': 'credor',
    'nome': 'credor', 'razao social': 'credor', 'empresa': 'credor',
    'descricao': 'descricao', 'historico': 'descricao', 'discriminacao': 'descricao',
    'memo': 'descricao', 'referencia': 'descricao',
    'valor': 'valor', 'valor do documento': 'valor', 'quantia': 'valor', 'total': 'valor',
    'vencimento': 'dataVencimento', 'data vencimento': 'dataVencimento',
    'data de vencimento': 'dataVencimento', 'data_vencimento': 'dataVencimento',
    'data': 'dataVencimento', 'competencia': 'dataVencimento', 'dt vencimento': 'dataVencimento',
    'categoria': 'categoria', 'tipo': 'categoria', 'classificacao': 'categoria',
    'centro custo': 'centroCusto', 'centro de custo': 'centroCusto',
    'centro': 'centroCusto', 'centro_custo': 'centroCusto', 'cc': 'centroCusto',
    'conta': 'contaBancaria', 'banco': 'contaBancaria', 'conta bancaria': 'contaBancaria',
    'conta_bancaria': 'contaBancaria',
    'observacao': 'observacao', 'obs': 'observacao', 'nota': 'observacao', 'notas': 'observacao',
  };

  return MAP[clean] ?? null;
}

function parseValue(v: unknown): number {
  if (typeof v === 'number') return Math.abs(v);
  const s = String(v ?? '').replace(/R\$\s*/g, '').replace(/\s/g, '').trim();
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : Math.abs(n);
}

function parseDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date && isValid(v)) return format(v, 'yyyy-MM-dd');
  const s = String(v).trim();
  const fmts = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'd/M/yyyy'];
  for (const f of fmts) {
    const d = dateParse(s, f, new Date());
    if (isValid(d) && d.getFullYear() > 2000) return format(d, 'yyyy-MM-dd');
  }
  return null;
}

function dupKey(credor: string, valor: number, data: string) {
  return `${credor.toLowerCase().trim()}_${valor}_${data}`;
}

export const ImportarPlanilha = () => {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  async function processFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

      if (raw.length < 2) { toast.error('Planilha vazia ou sem linhas de dados'); return; }

      const headerMap: Record<number, string> = {};
      (raw[0] as unknown[]).forEach((h, i) => {
        const key = normalizeHeader(String(h ?? ''));
        if (key) headerMap[i] = key;
      });

      if (!Object.values(headerMap).includes('valor') && !Object.values(headerMap).includes('dataVencimento')) {
        toast.error('Colunas obrigatórias não encontradas: "valor" e "vencimento"');
        return;
      }

      const parsed: Omit<PreviewRow, 'isDuplicate' | 'selected' | 'idx'>[] = [];
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r] as unknown[];
        const obj: Record<string, unknown> = {};
        Object.entries(headerMap).forEach(([i, key]) => { obj[key] = row[Number(i)]; });

        const dataVencimento = parseDate(obj.dataVencimento);
        const valor = parseValue(obj.valor);
        if (!dataVencimento || !valor) continue;

        parsed.push({
          credor:        String(obj.credor ?? '').trim(),
          descricao:     String(obj.descricao ?? '').trim(),
          valor,
          dataVencimento,
          categoria:     String(obj.categoria ?? '').trim(),
          centroCusto:   String(obj.centroCusto ?? '').trim(),
          contaBancaria: String(obj.contaBancaria ?? '').trim(),
          observacao:    String(obj.observacao ?? '').trim(),
        });
      }

      if (!parsed.length) { toast.error('Nenhuma linha válida encontrada. Verifique os cabeçalhos da planilha.'); return; }

      const { data: existing } = await supabase
        .from('contas_a_pagar')
        .select('credor, valor, data_vencimento');

      const existingKeys = new Set(
        (existing ?? []).map((e: { credor: string; valor: number; data_vencimento: string }) =>
          dupKey(e.credor ?? '', e.valor, e.data_vencimento)
        )
      );

      setRows(parsed.map((r, i) => ({
        ...r,
        idx: i,
        isDuplicate: existingKeys.has(dupKey(r.credor, r.valor, r.dataVencimento)),
        selected: !existingKeys.has(dupKey(r.credor, r.valor, r.dataVencimento)),
      })));

      const dups = parsed.filter(r => existingKeys.has(dupKey(r.credor, r.valor, r.dataVencimento))).length;
      toast.success(`${parsed.length} linha(s) carregada(s)${dups ? ` — ${dups} duplicada(s) ignorada(s)` : ''}`);
    } catch (e: unknown) {
      toast.error('Erro ao processar planilha', { description: (e as Error).message });
    }
  }

  function handleFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Formato inválido. Use .xlsx, .xls ou .csv');
      return;
    }
    processFile(file);
  }

  async function importSelected() {
    const selected = rows.filter(r => r.selected && !r.isDuplicate);
    if (!selected.length) { toast.error('Nenhuma linha selecionada'); return; }

    setImporting(true);
    try {
      const payload = selected.map(r => ({
        credor:          r.credor,
        descricao:       r.descricao,
        valor:           r.valor,
        data_vencimento: r.dataVencimento,
        categoria:       r.categoria,
        centro_custo:    r.centroCusto,
        conta_bancaria:  r.contaBancaria,
        observacao:      r.observacao,
        status:          'Pendente',
        recorrente:      false,
      }));

      const { error } = await supabase.from('contas_a_pagar').insert(payload);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['contas-a-pagar'] });
      toast.success(`${selected.length} conta(s) importada(s) com sucesso!`);
      setRows([]);
    } catch (e: unknown) {
      toast.error('Erro ao importar', { description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  const newRows = rows.filter(r => !r.isDuplicate);
  const dupCount = rows.filter(r => r.isDuplicate).length;
  const selectedCount = rows.filter(r => r.selected && !r.isDuplicate).length;
  const allNew = newRows.length > 0 && newRows.every(r => r.selected);

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-semibold text-foreground">Arraste uma planilha ou clique para selecionar</p>
        <p className="text-sm text-muted-foreground mt-1">Formatos: .xlsx, .xls, .csv</p>
        <p className="text-xs text-muted-foreground mt-3 font-mono bg-muted/50 rounded px-3 py-1.5 inline-block">
          descricao | valor | vencimento | centro_custo | categoria
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="text-muted-foreground">{rows.length} linha(s) lida(s)</span>
            <span className="text-success font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />{newRows.length} nova(s)
            </span>
            {dupCount > 0 && (
              <span className="text-amber-500 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />{dupCount} duplicada(s)
              </span>
            )}
          </div>

          <div className="chart-container overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allNew}
                      onChange={e => setRows(prev => prev.map(r => r.isDuplicate ? r : { ...r, selected: e.target.checked }))}
                    />
                  </th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Vencimento</th>
                  <th className="px-3 py-2.5">Centro de Custo</th>
                  <th className="px-3 py-2.5">Categoria</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.idx}
                    className={cn(
                      'border-b border-border/40 hover:bg-muted/20 transition-colors',
                      row.isDuplicate && 'opacity-40'
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        disabled={row.isDuplicate}
                        checked={row.selected}
                        onChange={e => setRows(prev => prev.map(r => r.idx === row.idx ? { ...r, selected: e.target.checked } : r))}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate font-medium">
                      {row.descricao || row.credor || '—'}
                      {row.credor && row.descricao && (
                        <span className="block text-xs text-muted-foreground truncate">{row.credor}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {row.dataVencimento
                        ? format(new Date(row.dataVencimento + 'T00:00:00'), 'dd/MM/yyyy')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{row.centroCusto || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{row.categoria || '—'}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtBRL(row.valor)}</td>
                    <td className="px-3 py-2">
                      {row.isDuplicate ? (
                        <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                          <AlertCircle className="w-3 h-3" />Duplicada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                          <CheckCircle2 className="w-3 h-3" />Nova
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => setRows([])}>
              <Trash2 className="w-4 h-4 mr-2" />Limpar
            </Button>
            <Button
              onClick={importSelected}
              disabled={importing || selectedCount === 0}
              className="min-h-[44px] min-w-[160px]"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Importando...</>
                : <><Upload className="w-4 h-4 mr-2" />Importar {selectedCount > 0 ? `(${selectedCount})` : ''}</>
              }
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
