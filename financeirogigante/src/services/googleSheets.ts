import { AccountsPayableEntry } from '@/types/accounts-payable';

const SHEET_ID = '1ix6-B_C-EjZKeVmuoGnZeia9Xgg8i3pXrutnpr3yp5I';
const RANGE = 'Sheet1!A:I'; // Adjust range as needed

// Parse Brazilian date format (DD/MM/YYYY) to Date object
const parseBrazilianDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
};

// Parse Brazilian currency (R$ X.XXX,XX) to number
const parseBrazilianCurrency = (currencyStr: string): number => {
  if (!currencyStr) return 0;
  // Remove R$, spaces, and dots (thousand separator), then replace comma with dot
  const cleanStr = currencyStr
    .replace(/R\$\s?/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  return parseFloat(cleanStr) || 0;
};

// Determine status based on due date and current status
const determineStatus = (dueDate: Date, currentStatus: string): 'Pago' | 'A vencer' | 'Atrasado' => {
  const trimmedStatus = currentStatus?.trim().toLowerCase();
  if (trimmedStatus === 'pago' || trimmedStatus.includes('pago')) return 'Pago';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  
  if (dueDate < today) return 'Atrasado';
  return 'A vencer';
};

export const fetchAccountsPayableData = async (): Promise<AccountsPayableEntry[]> => {
  try {
    // Using Google Sheets public CSV export
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    const rows = csvText.split('\n').map(row => {
      // Handle CSV parsing with quotes
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // Remove surrounding quotes and trim
          values.push(current.trim().replace(/^"|"$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      // Remove surrounding quotes from last value
      values.push(current.trim().replace(/^"|"$/g, ''));
      return values;
    });
    
    // Skip header row
    const dataRows = rows.slice(1).filter(row => row.length >= 9 && row[0]);
    
    console.log('=== GOOGLE SHEETS DATA PARSING DEBUG ===');
    console.log('Total data rows found:', dataRows.length);
    console.log('Raw status values (first 10):', dataRows.slice(0, 10).map(row => `"${row[8]}"`));
    
    const entries: AccountsPayableEntry[] = dataRows.map((row, index) => {
      const dueDate = parseBrazilianDate(row[0].trim());
      // Clean status: remove quotes, trim, handle empty
      const rawStatus = (row[8] || '').trim().replace(/^"|"$/g, '');
      const cleanStatus = rawStatus || 'A vencer';
      const status = determineStatus(dueDate, cleanStatus);
      const amount = parseBrazilianCurrency(row[6]);
      
      // Debug first 5 entries
      if (index < 5) {
        console.log(`\nEntry ${index}:`, {
          creditor: row[2].trim(),
          rawStatus: `"${rawStatus}"`,
          cleanStatus: cleanStatus,
          determinedStatus: status,
          rawAmount: row[6],
          parsedAmount: amount,
          dueDate: row[0].trim()
        });
      }
      
      return {
        dueDate: row[0].trim(),
        scheduleDate: (row[1] || '').trim(),
        creditor: (row[2] || '').trim(),
        description: (row[3] || '').trim(),
        category: (row[4] || '').trim(),
        costCenter: (row[5] || '').trim(),
        amount,
        paymentMethod: (row[7] || '').trim(),
        status,
      };
    });
    
    const paidEntries = entries.filter(e => e.status === 'Pago');
    console.log('\n=== PAID ENTRIES SUMMARY ===');
    console.log('Total entries with status "Pago":', paidEntries.length);
    console.log('First 5 paid entries:', paidEntries.slice(0, 5).map(e => ({
      creditor: e.creditor,
      amount: e.amount,
      status: e.status,
      dueDate: e.dueDate
    })));
    console.log('Total of first 5 paid amounts:', paidEntries.slice(0, 5).reduce((sum, e) => sum + e.amount, 0));
    
    return entries;
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    // Return sample data for development/fallback
    return generateSampleData();
  }
};

// Generate sample data for development or when API fails
const generateSampleData = (): AccountsPayableEntry[] => {
  const categories = ['Fornecedores', 'Serviços', 'Impostos', 'Aluguel', 'Utilidades'];
  const creditors = ['Fornecedor A', 'Fornecedor B', 'Prestador C', 'Empresa D', 'Serviços E'];
  const costCenters = ['Ilha', 'Tropical'];
  const paymentMethods = ['Transferência', 'Boleto', 'PIX', 'Cartão'];
  
  const data: AccountsPayableEntry[] = [];
  const today = new Date();
  
  for (let i = 0; i < 50; i++) {
    const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + daysOffset);
    
    const status = daysOffset < -5 
      ? (Math.random() > 0.3 ? 'Pago' : 'Atrasado')
      : daysOffset < 0 
        ? (Math.random() > 0.5 ? 'Pago' : 'A vencer')
        : 'A vencer';
    
    data.push({
      dueDate: dueDate.toLocaleDateString('pt-BR'),
      scheduleDate: new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
      creditor: creditors[Math.floor(Math.random() * creditors.length)],
      description: `Pagamento ${i + 1}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      costCenter: costCenters[Math.floor(Math.random() * costCenters.length)],
      amount: Math.floor(Math.random() * 10000) + 500,
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      status: status as 'Pago' | 'A vencer' | 'Atrasado',
    });
  }
  
  return data.sort((a, b) => {
    const dateA = parseBrazilianDate(a.dueDate);
    const dateB = parseBrazilianDate(b.dueDate);
    return dateA.getTime() - dateB.getTime();
  });
};

export const refreshData = fetchAccountsPayableData;
