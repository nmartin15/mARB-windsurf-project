import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  format?: 'currency' | 'percent' | 'date' | 'text';
}

function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return '--';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
  }
  if (format === 'percent') {
    return `${Math.round(Number(value) * 10) / 10}%`;
  }
  if (format === 'date' && typeof value === 'string') {
    try { return new Date(value).toLocaleDateString(); } catch { return String(value); }
  }
  return String(value);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  title: string,
  filename?: string,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title);

  sheet.columns = columns.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width || 15,
  }));

  // Style the header row
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8EDF5' },
  };

  data.forEach(row => {
    const rowData: Record<string, unknown> = {};
    columns.forEach(col => {
      rowData[col.key] = formatValue(row[col.key], col.format);
    });
    sheet.addRow(rowData);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportToCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  title: string,
  filename?: string,
) {
  const header = columns.map(c => `"${c.header}"`).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const val = formatValue(row[col.key], col.format);
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportToPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  title: string,
  filename?: string,
) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });

  doc.setFontSize(16);
  doc.text(title, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

  const tableHeaders = columns.map(c => c.header);
  const tableData = data.map(row =>
    columns.map(col => formatValue(row[col.key], col.format))
  );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const blob = doc.output('blob');
  triggerDownload(blob, filename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
}
