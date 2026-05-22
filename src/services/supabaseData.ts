import { supabase } from '@/integrations/supabase/client';
import { MovimentacaoEntry } from '@/types/accounts-payable';
import { format } from 'date-fns';

const mapRow = (row: any): MovimentacaoEntry => ({
  dataMovimento: row.data_movimento
    ? format(new Date(row.data_movimento + 'T00:00:00'), 'dd/MM/yyyy')
    : '',
  credor:        row.credor         || '',
  descricao:     row.descricao      || '',
  tipoOperacao:  (row.tipo_operacao as 'Crédito' | 'Débito') || 'Débito',
  contaBancaria: row.conta_bancaria || '',
  valor:         Number(row.valor)  || 0,
  status:        row.status         || '',
  categoria:     row.categoria      || '',
  centroCusto:   row.centro_custo   || '',
});

// Busca completa — usada no Dashboard e Relatórios
export const fetchMovimentacoesFromSupabase = async (): Promise<MovimentacaoEntry[]> => {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .order('data_movimento', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
};

// ── Paginada — usada no Extrato (Detalhes) ───────────────────

export interface MovimentacoesFilters {
  search?:    string;
  tipo?:      string;
  centro?:    string;
  conta?:     string;
  sortField?: string;
  sortAsc?:   boolean;
}

// Retorna lista de contas bancárias distintas para popular o filtro.
// Busca as 300 transações mais recentes E as 300 mais antigas em paralelo,
// garantindo cobertura de bancos ativos e descontinuados (ex: PagBank SM).
export const fetchContasBancarias = async (): Promise<string[]> => {
  const [recent, oldest] = await Promise.all([
    supabase
      .from('movimentacoes')
      .select('conta_bancaria')
      .not('conta_bancaria', 'is', null)
      .neq('conta_bancaria', '')
      .order('data_movimento', { ascending: false })
      .limit(300),
    supabase
      .from('movimentacoes')
      .select('conta_bancaria')
      .not('conta_bancaria', 'is', null)
      .neq('conta_bancaria', '')
      .order('data_movimento', { ascending: true })
      .limit(300),
  ]);

  if (recent.error) throw recent.error;
  if (oldest.error) throw oldest.error;

  const all = [...(recent.data ?? []), ...(oldest.data ?? [])];
  const unique = [...new Set(all.map(r => r.conta_bancaria as string))];
  return unique.sort();
};

export interface PaginatedResult {
  data:  MovimentacaoEntry[];
  count: number;
}

export const fetchMovimentacoesPaginated = async (
  page:     number,
  pageSize: number,
  filters:  MovimentacoesFilters,
): Promise<PaginatedResult> => {
  const from = page * pageSize;
  const to   = from + pageSize - 1;

  let query = supabase
    .from('movimentacoes')
    .select('*', { count: 'exact' })
    .order(filters.sortField ?? 'data_movimento', { ascending: filters.sortAsc ?? false })
    .range(from, to);

  if (filters.search) {
    const q = filters.search.replace(/'/g, "''"); // evita injeção
    query = query.or(
      `descricao.ilike.%${q}%,credor.ilike.%${q}%,categoria.ilike.%${q}%,conta_bancaria.ilike.%${q}%`,
    );
  }

  if (filters.tipo && filters.tipo !== 'all') {
    query = query.eq('tipo_operacao', filters.tipo);
  }

  if (filters.centro && filters.centro !== 'all') {
    query = query.eq('centro_custo', filters.centro);
  }

  if (filters.conta && filters.conta !== 'all') {
    query = query.eq('conta_bancaria', filters.conta);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { data: (data ?? []).map(mapRow), count: count ?? 0 };
};
