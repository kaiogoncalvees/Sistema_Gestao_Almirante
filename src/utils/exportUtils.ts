import { format } from 'date-fns';
import { MovimentacaoEntry } from '@/types/accounts-payable';

const HEADERS = [
  'Data',
  'Credor',
  'Descrição',
  'Tipo',
  'Conta Bancária',
  'Valor',
  'Status',
  'Categoria',
  'Centro de Custo',
];

const toRow = (e: MovimentacaoEntry) => [
  e.dataMovimento,
  e.credor,
  e.descricao,
  e.tipoOperacao,
  e.contaBancaria,
  e.valor.toFixed(2).replace('.', ','),
  e.status,
  e.categoria,
  e.centroCusto,
];

export const exportToCSV = (data: MovimentacaoEntry[], filename: string) => {
  const rows = data.map(toRow);
  const csv = 'data:text/csv;charset=utf-8,' +
    [HEADERS.join(';'), ...rows.map(r => r.join(';'))].join('\n');

  const link = document.createElement('a');
  link.setAttribute('href', encodeURI(csv));
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToXLSX = async (data: MovimentacaoEntry[], filename: string) => {
  const XLSX = await import('xlsx');

  const worksheetData = [HEADERS, ...data.map(toRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook  = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório');

  worksheet['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 10 },
    { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 25 }, { wch: 15 },
  ];

  XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
};

export const exportToPDF = async (data: MovimentacaoEntry[], filename: string) => {
  const { default: jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF('l', 'mm', 'a4');
  doc.setFontSize(16);
  doc.text('Relatório de Movimentações', 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);

  const totalEntradas = data
    .filter(e => e.tipoOperacao === 'Crédito')
    .reduce((s, e) => s + Math.abs(e.valor), 0);
  const totalSaidas = data
    .filter(e => e.tipoOperacao === 'Débito')
    .reduce((s, e) => s + Math.abs(e.valor), 0);

  doc.text(`Registros: ${data.length}`, 14, 30);
  doc.text(`Entradas: R$ ${totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 80, 30);
  doc.text(`Saídas: R$ ${totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 180, 30);
  doc.text(`Saldo: R$ ${(totalEntradas - totalSaidas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 260, 30);

  (doc as any).autoTable({
    head: [['Data', 'Descrição', 'Tipo', 'Conta', 'Valor', 'Categoria', 'Centro']],
    body: data.map(e => [
      e.dataMovimento,
      e.descricao.substring(0, 45),
      e.tipoOperacao,
      e.contaBancaria,
      `R$ ${Math.abs(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      e.categoria || '-',
      e.centroCusto,
    ]),
    startY: 38,
    theme: 'striped',
    headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 60 }, 2: { cellWidth: 18 },
      3: { cellWidth: 40 }, 4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 30 }, 6: { cellWidth: 20 },
    },
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
};
