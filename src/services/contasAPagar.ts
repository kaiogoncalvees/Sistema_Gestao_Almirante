import { supabase } from '@/integrations/supabase/client';
import { addWeeks, addMonths, addDays, format, isPast, isToday, differenceInDays } from 'date-fns';

export interface ContaAPagar {
  id: number;
  descricao: string;
  credor: string;
  valor: number;
  dataVencimento: string;        // DD/MM/YYYY
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';
  statusReal: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado'; // status do banco
  categoria: string;
  centroCusto: string;
  contaBancaria: string;
  observacao: string;
  recorrente: boolean;
  frequencia: string | null;
  dataFim: string | null;
  idOrigem: number | null;
  diasParaVencer: number;        // negativo = atrasado
}

export interface ContaFormData {
  descricao: string;
  credor: string;
  valor: number;
  dataVencimento: Date;
  status: string;
  categoria: string;
  centroCusto: string;
  contaBancaria: string;
  observacao: string;
  recorrente: boolean;
  frequencia?: string;
  dataFim?: Date | null;
}

// Quantas instâncias futuras gerar por frequência
const INSTANCIAS: Record<string, number> = {
  semanal:    26,   // 6 meses
  quinzenal:  12,   // 6 meses
  mensal:     13,   // 13 meses
  bimestral:   6,
  trimestral:  4,
  semestral:   2,
  anual:       2,
};

function proximaData(base: Date, frequencia: string): Date {
  switch (frequencia) {
    case 'semanal':    return addWeeks(base, 1);
    case 'quinzenal':  return addDays(base, 15);
    case 'mensal':     return addMonths(base, 1);
    case 'bimestral':  return addMonths(base, 2);
    case 'trimestral': return addMonths(base, 3);
    case 'semestral':  return addMonths(base, 6);
    case 'anual':      return addMonths(base, 12);
    default:           return addMonths(base, 1);
  }
}

function mapRow(row: any): ContaAPagar {
  const venc = new Date(row.data_vencimento + 'T00:00:00');
  const dias  = differenceInDays(venc, new Date());
  const statusReal = row.status as ContaAPagar['status'];
  // Recalcula "Atrasado" em runtime se ainda Pendente e já venceu
  const status: ContaAPagar['status'] =
    statusReal === 'Pendente' && dias < 0 ? 'Atrasado' : statusReal;

  return {
    id:            row.id,
    descricao:     row.descricao,
    credor:        row.credor        || '',
    valor:         Number(row.valor) || 0,
    dataVencimento: format(venc, 'dd/MM/yyyy'),
    status,
    statusReal,
    categoria:     row.categoria     || '',
    centroCusto:   row.centro_custo  || '',
    contaBancaria: row.conta_bancaria || '',
    observacao:    row.observacao    || '',
    recorrente:    row.recorrente    ?? false,
    frequencia:    row.frequencia    ?? null,
    dataFim:       row.data_fim      ?? null,
    idOrigem:      row.id_origem     ?? null,
    diasParaVencer: dias,
  };
}

// ── Leitura ──────────────────────────────────────────────────

export interface FetchContasFilters {
  status?: string;           // 'all' | 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado'
  centro?: string;
  dataInicio?: string;       // YYYY-MM-DD
  dataFim?: string;          // YYYY-MM-DD
}

export const fetchContasAPagar = async (
  filters: FetchContasFilters = {},
): Promise<ContaAPagar[]> => {
  let query = supabase
    .from('contas_a_pagar')
    .select('*')
    .order('data_vencimento', { ascending: true });

  if (filters.dataInicio) query = query.gte('data_vencimento', filters.dataInicio);
  if (filters.dataFim)    query = query.lte('data_vencimento', filters.dataFim);
  if (filters.centro && filters.centro !== 'all')
    query = query.eq('centro_custo', filters.centro);

  const { data, error } = await query;
  if (error) throw error;

  const mapped = (data ?? []).map(mapRow);

  // Filtro de status pós-mapeamento (pois "Atrasado" é calculado no frontend)
  if (!filters.status || filters.status === 'all') return mapped;
  return mapped.filter(c => c.status === filters.status);
};

// ── Criação (simples ou recorrente) ──────────────────────────

export const criarConta = async (data: ContaFormData): Promise<void> => {
  const base: any = {
    descricao:       data.descricao,
    credor:          data.credor,
    valor:           data.valor,
    data_vencimento: format(data.dataVencimento, 'yyyy-MM-dd'),
    status:          data.status || 'Pendente',
    categoria:       data.categoria,
    centro_custo:    data.centroCusto,
    conta_bancaria:  data.contaBancaria,
    observacao:      data.observacao,
    recorrente:      data.recorrente,
    frequencia:      data.recorrente ? (data.frequencia ?? 'mensal') : null,
    data_fim:        data.dataFim ? format(data.dataFim, 'yyyy-MM-dd') : null,
  };

  const { data: inserted, error } = await supabase
    .from('contas_a_pagar')
    .insert(base)
    .select('id')
    .single();

  if (error) throw error;

  // Gera instâncias futuras se recorrente
  if (data.recorrente && data.frequencia && inserted) {
    const qtd   = INSTANCIAS[data.frequencia] ?? 12;
    const rows  = [];
    let   atual = data.dataVencimento;
    const fim   = data.dataFim ?? null;

    for (let i = 0; i < qtd; i++) {
      atual = proximaData(atual, data.frequencia);
      if (fim && atual > fim) break;
      rows.push({ ...base, data_vencimento: format(atual, 'yyyy-MM-dd'), id_origem: inserted.id });
    }

    if (rows.length > 0) {
      const { error: errRec } = await supabase.from('contas_a_pagar').insert(rows);
      if (errRec) throw errRec;
    }
  }
};

// ── Marcar como Pago ─────────────────────────────────────────

export const marcarComoPago = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from('contas_a_pagar')
    .update({ status: 'Pago', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
};

// ── Atualizar ────────────────────────────────────────────────

export const atualizarConta = async (
  id: number,
  data: Partial<ContaFormData>,
): Promise<void> => {
  const payload: any = { updated_at: new Date().toISOString() };
  if (data.descricao       !== undefined) payload.descricao       = data.descricao;
  if (data.credor          !== undefined) payload.credor          = data.credor;
  if (data.valor           !== undefined) payload.valor           = data.valor;
  if (data.dataVencimento  !== undefined) payload.data_vencimento = format(data.dataVencimento, 'yyyy-MM-dd');
  if (data.status          !== undefined) payload.status          = data.status;
  if (data.categoria       !== undefined) payload.categoria       = data.categoria;
  if (data.centroCusto     !== undefined) payload.centro_custo    = data.centroCusto;
  if (data.contaBancaria   !== undefined) payload.conta_bancaria  = data.contaBancaria;
  if (data.observacao      !== undefined) payload.observacao      = data.observacao;

  const { error } = await supabase.from('contas_a_pagar').update(payload).eq('id', id);
  if (error) throw error;
};

// ── Excluir ──────────────────────────────────────────────────

export const excluirConta = async (id: number, excluirFuturas = false): Promise<void> => {
  if (excluirFuturas) {
    // Exclui esta e todas as futuras da mesma série
    const { data: conta } = await supabase
      .from('contas_a_pagar').select('id_origem').eq('id', id).single();
    const origemId = conta?.id_origem ?? id;
    await supabase.from('contas_a_pagar').delete().eq('id_origem', origemId);
    await supabase.from('contas_a_pagar').delete().eq('id', origemId);
  } else {
    const { error } = await supabase.from('contas_a_pagar').delete().eq('id', id);
    if (error) throw error;
  }
};
