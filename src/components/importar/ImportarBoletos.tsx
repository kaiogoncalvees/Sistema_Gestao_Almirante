import { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { parse as dateParse, isValid, format } from 'date-fns';
import {
  FileText, Trash2, Upload, AlertCircle, CheckCircle2,
  Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { fmtBRL } from '@/utils/format';
import { CENTROS_CUSTO } from '@/config/centros';

import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

const CATEGORIAS = [
  'Aluguel', 'Fornecedor', 'Folha de Pagamento', 'Impostos', 'Serviços',
  'Manutenção', 'Marketing', 'Transporte', 'Alimentação', 'Outros',
];

const CONTAS = [
  'Bradesco SM', 'Bradesco SA', 'Stone SA', 'Stone SM',
  'Conta Cartão SA', 'PagBank SA', 'PagBank SM',
];

interface BoletoCard {
  id: string;
  fileName: string;
  credor: string;
  descricao: string;
  valor: string;
  dataVencimento: string; // YYYY-MM-DD
  linhaDigitavel: string;
  centroCusto: string;
  categoria: string;
  contaBancaria: string;
  isDuplicate: boolean;
  selected: boolean;
  expanded: boolean;
  parseWarning?: string;
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item): item is TextItem => 'str' in item)
      .map(item => item.str)
      .join(' ');
    text += pageText + '\n';
  }
  return text;
}

function parseBoletoText(text: string, fileName: string): Omit<BoletoCard, 'isDuplicate' | 'selected' | 'expanded'> {
  // Linha digitável: 5.5 or 5.6 or grouped digit blocks
  const linhaPatterns = [
    /\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}/,
    /\d{5}\.\d{5} \d{5}\.\d{6} \d{5}\.\d{6} \d \d{14}/,
    /(\d{10}\s+\d{10}\s+\d{10}\s+\d{10})/,
  ];
  let linhaDigitavel = '';
  for (const p of linhaPatterns) {
    const m = text.match(p);
    if (m) { linhaDigitavel = m[0].replace(/\s+/g, ' ').trim(); break; }
  }

  // Valor: try to find near "Valor" labels first, then any currency
  const valorPatterns = [
    /(?:Valor\s+do\s+Documento|Valor\s+Cobrado|Valor\s+Total|\(=\)\s*Valor)[^\d]*([\d]+(?:[.,]\d{3})*[.,]\d{2})/i,
    /(?:Valor)[:\s]+([\d]+(?:[.,]\d{3})*[.,]\d{2})/i,
    /R\$\s*([\d]+(?:\.\d{3})*,\d{2})/,
  ];
  let valorRaw = '';
  for (const p of valorPatterns) {
    const m = text.match(p);
    if (m) { valorRaw = m[1]; break; }
  }

  // Vencimento date: try labeled first, then any dd/mm/yyyy
  const datePatterns = [
    /(?:Vencimento|Data\s+de\s+Vencimento)[:\s]*([\d]{2}\/[\d]{2}\/[\d]{4})/i,
    /([\d]{2}\/[\d]{2}\/[\d]{4})/,
  ];
  let dataVencimento = '';
  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) {
      const d = dateParse(m[1], 'dd/MM/yyyy', new Date());
      if (isValid(d) && d.getFullYear() >= 2020) {
        dataVencimento = format(d, 'yyyy-MM-dd');
        break;
      }
    }
  }

  // Beneficiário / cedente
  const credorPatterns = [
    /(?:Benefici[aá]rio|Cedente|Favorecido|Raz[aã]o\s+Social|Nome\s+do\s+Benefici[aá]rio)[:\s]+([^\n\r\t|]{3,80})/i,
  ];
  let credor = '';
  for (const p of credorPatterns) {
    const m = text.match(p);
    if (m) { credor = m[1].trim().replace(/\s+/g, ' '); break; }
  }

  const parseWarning = (!valorRaw || !dataVencimento)
    ? 'Alguns campos não foram extraídos automaticamente. Verifique e preencha manualmente.'
    : undefined;

  const parseValor = (s: string): string => {
    if (!s) return '';
    const clean = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? '' : n.toFixed(2);
  };

  return {
    id: crypto.randomUUID(),
    fileName,
    credor,
    descricao: '',
    valor: parseValor(valorRaw),
    dataVencimento,
    linhaDigitavel,
    centroCusto: '',
    categoria: '',
    contaBancaria: '',
    parseWarning,
  };
}

export const ImportarBoletos = () => {
  const [cards, setCards] = useState<BoletoCard[]>([]);
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  function updateCard(id: string, patch: Partial<BoletoCard>) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  async function processFiles(files: FileList | File[]) {
    const pdfs = Array.from(files).filter(f => /\.pdf$/i.test(f.name));
    if (!pdfs.length) { toast.error('Selecione arquivos PDF'); return; }

    setProcessing(true);
    try {
      // Fetch existing linha digitável values for dedup
      const { data: existing } = await supabase
        .from('contas_a_pagar')
        .select('observacao');
      const existingLinhas = new Set(
        (existing ?? []).map((e: { observacao: string }) => e.observacao?.trim()).filter(Boolean)
      );

      const newCards: BoletoCard[] = [];
      for (const file of pdfs) {
        const buffer = await file.arrayBuffer();
        const parsed = parseBoletoText(await extractPdfText(buffer), file.name);
        const isDuplicate = !!(parsed.linhaDigitavel && existingLinhas.has(parsed.linhaDigitavel));
        newCards.push({
          ...parsed,
          isDuplicate,
          selected: !isDuplicate,
          expanded: !!parsed.parseWarning,
        });
      }

      setCards(prev => [...prev, ...newCards]);
      const dups = newCards.filter(c => c.isDuplicate).length;
      toast.success(`${newCards.length} boleto(s) carregado(s)${dups ? ` — ${dups} duplicado(s)` : ''}`);
    } catch (e: unknown) {
      toast.error('Erro ao processar PDF', { description: (e as Error).message });
    } finally {
      setProcessing(false);
    }
  }

  async function importSelected() {
    const selected = cards.filter(c => c.selected && !c.isDuplicate);
    if (!selected.length) { toast.error('Nenhum boleto selecionado'); return; }

    const invalid = selected.filter(c => !c.valor || !c.dataVencimento);
    if (invalid.length) {
      toast.error(`${invalid.length} boleto(s) com campos obrigatórios em branco (valor ou vencimento)`);
      return;
    }

    setImporting(true);
    try {
      const payload = selected.map(c => ({
        credor:          c.credor,
        descricao:       c.descricao || c.fileName,
        valor:           parseFloat(c.valor),
        data_vencimento: c.dataVencimento,
        categoria:       c.categoria,
        centro_custo:    c.centroCusto,
        conta_bancaria:  c.contaBancaria,
        observacao:      c.linhaDigitavel,
        status:          'Pendente',
        recorrente:      false,
      }));

      const { error } = await supabase.from('contas_a_pagar').insert(payload);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['contas-a-pagar'] });
      toast.success(`${selected.length} boleto(s) importado(s)!`);
      setCards(prev => prev.filter(c => !selected.find(s => s.id === c.id)));
    } catch (e: unknown) {
      toast.error('Erro ao importar', { description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = cards.filter(c => c.selected && !c.isDuplicate).length;
  const dupCount = cards.filter(c => c.isDuplicate).length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          processFiles(e.dataTransfer.files);
        }}
      >
        {processing ? (
          <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
        ) : (
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        )}
        <p className="font-semibold text-foreground">
          {processing ? 'Processando PDFs...' : 'Arraste PDFs de boletos ou clique para selecionar'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Múltiplos arquivos aceitos — um boleto por PDF</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Cards */}
      {cards.length > 0 && (
        <div className="space-y-3">
          {cards.map(card => (
            <div
              key={card.id}
              className={cn(
                'border rounded-xl overflow-hidden transition-all',
                card.isDuplicate ? 'border-amber-300/50 bg-amber-50/10 opacity-60' : 'border-border bg-card'
              )}
            >
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  disabled={card.isDuplicate}
                  checked={card.selected}
                  onChange={e => updateCard(card.id, { selected: e.target.checked })}
                  className="w-4 h-4 shrink-0"
                />
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{card.credor || card.fileName}</p>
                  <p className="text-xs text-muted-foreground truncate">{card.fileName}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {card.valor && (
                    <span className="text-sm font-semibold tabular-nums">{fmtBRL(parseFloat(card.valor) || 0)}</span>
                  )}
                  {card.dataVencimento && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(card.dataVencimento + 'T00:00:00'), 'dd/MM/yy')}
                    </span>
                  )}
                  {card.isDuplicate ? (
                    <span className="inline-flex items-center gap-1 text-amber-500 text-xs font-medium">
                      <AlertCircle className="w-3 h-3" />Duplicado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                      <CheckCircle2 className="w-3 h-3" />Novo
                    </span>
                  )}
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7"
                    onClick={() => updateCard(card.id, { expanded: !card.expanded })}
                  >
                    {card.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setCards(prev => prev.filter(c => c.id !== card.id))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Expanded fields */}
              {card.expanded && (
                <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/10">
                  {card.parseWarning && (
                    <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50/30 border border-amber-200/50 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {card.parseWarning}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Credor / Beneficiário</label>
                      <Input
                        value={card.credor}
                        onChange={e => updateCard(card.id, { credor: e.target.value })}
                        placeholder="Nome do credor"
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                      <Input
                        value={card.descricao}
                        onChange={e => updateCard(card.id, { descricao: e.target.value })}
                        placeholder="Referência ou descrição"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Valor (R$) *</label>
                      <Input
                        value={card.valor}
                        onChange={e => updateCard(card.id, { valor: e.target.value })}
                        placeholder="0.00"
                        inputMode="decimal"
                        className={cn('h-9 text-sm', !card.valor && 'border-destructive')}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Vencimento *</label>
                      <Input
                        type="date"
                        value={card.dataVencimento}
                        onChange={e => updateCard(card.id, { dataVencimento: e.target.value })}
                        className={cn('h-9 text-sm', !card.dataVencimento && 'border-destructive')}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                      <Select value={card.categoria} onValueChange={v => updateCard(card.id, { categoria: v })}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Centro</label>
                      <Select value={card.centroCusto} onValueChange={v => updateCard(card.id, { centroCusto: v })}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {CENTROS_CUSTO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Conta Bancária</label>
                      <Select value={card.contaBancaria} onValueChange={v => updateCard(card.id, { contaBancaria: v })}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                        <SelectContent>
                          {CONTAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Linha Digitável (dedup)</label>
                      <Input
                        value={card.linhaDigitavel}
                        onChange={e => updateCard(card.id, { linhaDigitavel: e.target.value })}
                        placeholder="Extraída automaticamente do PDF"
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{cards.length} boleto(s)</span>
              {dupCount > 0 && (
                <span className="text-amber-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />{dupCount} duplicado(s)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCards([])}>
                <Trash2 className="w-4 h-4 mr-2" />Limpar tudo
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
          </div>
        </div>
      )}
    </div>
  );
};
