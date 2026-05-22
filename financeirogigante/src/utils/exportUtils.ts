import { format } from 'date-fns';
import { AccountsPayableEntry } from '@/types/accounts-payable';

export const exportToCSV = (data: AccountsPayableEntry[], filename: string) => {
  const headers = [
    'Vencimento',
    'Programação',
    'Credor',
    'Descrição',
    'Categoria',
    'Centro de Custo',
    'Valor',
    'Forma de Pagamento',
    'Status',
  ];

  const rows = data.map((entry) => [
    entry.dueDate,
    entry.scheduleDate,
    entry.creditor,
    entry.description,
    entry.category,
    entry.costCenter,
    entry.amount.toFixed(2).replace('.', ','),
    entry.paymentMethod,
    entry.status,
  ]);

  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToXLSX = async (data: AccountsPayableEntry[], filename: string) => {
  const XLSX = await import('xlsx');

  const worksheetData = [
    ['Vencimento', 'Programação', 'Credor', 'Descrição', 'Categoria', 'Centro de Custo', 'Valor', 'Forma de Pagamento', 'Status'],
    ...data.map((entry) => [
      entry.dueDate,
      entry.scheduleDate,
      entry.creditor,
      entry.description,
      entry.category,
      entry.costCenter,
      entry.amount,
      entry.paymentMethod,
      entry.status,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

  // Style the header row
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_col(C) + '1';
    if (!worksheet[address]) continue;
    worksheet[address].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'EFEFEF' } },
    };
  }

  // Set column widths
  worksheet['!cols'] = [
    { wch: 12 }, // Vencimento
    { wch: 12 }, // Programação
    { wch: 25 }, // Credor
    { wch: 30 }, // Descrição
    { wch: 20 }, // Categoria
    { wch: 15 }, // Centro de Custo
    { wch: 12 }, // Valor
    { wch: 18 }, // Forma de Pagamento
    { wch: 12 }, // Status
  ];

  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportToPDF = async (data: AccountsPayableEntry[], filename: string) => {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF('l', 'mm', 'a4');

  // Title
  doc.setFontSize(16);
  doc.text('Relatório Financeiro', 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

  // Calculate totals
  const totalGeral = data.reduce((sum, entry) => sum + entry.amount, 0);
  const totalPago = data.filter((e) => e.status === 'Pago').reduce((sum, e) => sum + e.amount, 0);
  const totalPendente = data.filter((e) => e.status !== 'Pago').reduce((sum, e) => sum + e.amount, 0);

  // Summary
  doc.setFontSize(9);
  doc.text(`Total Registros: ${data.length}`, 14, 30);
  doc.text(`Total Geral: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 80, 30);
  doc.text(`Total Pago: R$ ${totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 160, 30);
  doc.text(`Total Pendente: R$ ${totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 240, 30);

  // Table
  const tableData = data.map((entry) => [
    entry.dueDate,
    entry.creditor.substring(0, 30),
    entry.category || '-',
    entry.costCenter,
    `R$ ${entry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    entry.paymentMethod || '-',
    entry.status,
  ]);

  (doc as any).autoTable({
    head: [['Vencimento', 'Credor', 'Categoria', 'Centro', 'Valor', 'Pagamento', 'Status']],
    body: tableData,
    startY: 38,
    theme: 'striped',
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 50 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30 },
      6: { cellWidth: 25 },
    },
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
