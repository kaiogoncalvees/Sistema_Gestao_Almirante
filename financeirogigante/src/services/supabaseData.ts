import { supabase } from '@/integrations/supabase/client';
import { AccountsPayableEntry } from '@/types/accounts-payable';
import { format } from 'date-fns';

export interface AccountsPayableWithId extends AccountsPayableEntry {
  id: number;
}

export const fetchAccountsPayableFromSupabase = async (): Promise<AccountsPayableWithId[]> => {
  const { data, error } = await supabase
    .from('contas_a_pagar')
    .select('*')
    .order('data_vencimento', { ascending: true });

  if (error) {
    console.error('Error fetching contas_a_pagar:', error);
    throw error;
  }

  if (!data) return [];

  // Transform Supabase data to our internal format
  return data.map((row) => ({
    id: row.id,
    dueDate: row.data_vencimento ? format(new Date(row.data_vencimento), 'dd/MM/yyyy') : '',
    scheduleDate: row.data_programacao ? format(new Date(row.data_programacao), 'dd/MM/yyyy') : '',
    creditor: row.credor || '',
    description: row.descricao || '',
    category: row.categoria || '',
    costCenter: row.centro_custo || '',
    amount: Number(row.valor) || 0,
    paymentMethod: row.forma_pagamento || '',
    status: (row.status as AccountsPayableEntry['status']) || 'Pendente',
  }));
};
