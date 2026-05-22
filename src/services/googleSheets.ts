import { MovimentacaoEntry } from '@/types/accounts-payable';

const SHEET_ID = '1YyELG9hRAlIeIiyFYur7vib1HI7fgeH8RQkEA8enEsc';

// Colunas da planilha:
// A(0) Data de Movimento | B(1) Credor | C(2) Descrição | D(3) Tipo de Operação
// E(4) Conta Bancaria    | F(5) Valor  | G(6) Status    | H(7) Categoria | I(8) Centro de Custo

const parseBrazilianDate = (val: string): string => {
  if (!val) return '';
  const parts = val.trim().split('/');
  if (parts.length === 3) return val.trim(); // already DD/MM/YYYY
  return '';
};

const parseCurrency = (val: string): number => {
  if (!val) return 0;
  const str = String(val).trim();
  const isNegative = str.startsWith('-');
  const clean = str
    .replace(/^-?\s*R?\$\s?/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(clean) || 0;
  return isNegative ? -Math.abs(num) : num;
};

const parseCSVRow = (row: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ''));
  return values;
};

export const fetchMovimentacoesData = async (): Promise<MovimentacaoEntry[]> => {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
    const response = await fetch(csvUrl);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const csvText = await response.text();
    const rows = csvText.split('\n').map(parseCSVRow);
    const dataRows = rows.slice(1).filter(row => row.length >= 9 && row[0]);

    return dataRows.map((row): MovimentacaoEntry => {
      const valor = parseCurrency(row[5]);
      const tipoRaw = (row[3] || '').trim();
      const tipoOperacao: 'Crédito' | 'Débito' =
        tipoRaw === 'Crédito' ? 'Crédito' : 'Débito';

      return {
        dataMovimento: parseBrazilianDate(row[0]),
        credor:        (row[1] || '').trim(),
        descricao:     (row[2] || '').trim(),
        tipoOperacao,
        contaBancaria: (row[4] || '').trim(),
        valor,
        status:        (row[6] || '').trim(),
        categoria:     (row[7] || '').trim(),
        centroCusto:   (row[8] || '').trim(),
      };
    });
  } catch (error) {
    console.error('Erro ao buscar dados do Google Sheets:', error);
    return [];
  }
};
