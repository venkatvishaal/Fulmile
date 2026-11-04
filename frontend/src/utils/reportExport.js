// Client-side finance exports (.xlsx / .pdf). The libraries are imported on demand so nobody
// downloads them until they actually export.

// Single source of truth for who may export finance reports (mirrors the backend /reports/export guard).
export const FINANCE_EXPORT_ROLES = ['fleet_manager', 'financial_analyst'];
export const canExportFinance = (role) => FINANCE_EXPORT_ROLES.includes(role);

const INK = 'FF15171A';
const PAPER = 'FFF5F3EE';
const LINE = 'FFE2DED5';

export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const stamp = () => new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const fileDate = () => new Date().toISOString().slice(0, 10);

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * sheets: [{ name, title, columns: [{ header, key, width, numFmt }], rows: [{...}], totals?: {...} }]
 * numFmt examples: '₹#,##0' (money), '0.00' (litres, km/L), '0.0"%"' (ratio).
 */
export async function exportExcel({ fileName, sheets }) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fulmile';
  wb.created = new Date();

  sheets.forEach(({ name, title, columns, rows, totals }) => {
    const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 3 }] });
    ws.columns = columns.map(({ key, width = 16 }) => ({ key, width }));

    const titleRow = ws.addRow([title]);
    titleRow.font = { bold: true, size: 14 };
    ws.addRow([`Generated ${stamp()} · Fulmile`]).font = { italic: true, size: 9, color: { argb: 'FF6B6A65' } };

    const head = ws.addRow(columns.map((c) => c.header));
    head.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: PAPER } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
      cell.alignment = { vertical: 'middle' };
    });
    head.height = 20;

    rows.forEach((r) => {
      const row = ws.addRow(columns.map((c) => r[c.key]));
      row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: LINE } } }; });
    });

    if (totals) {
      const row = ws.addRow(columns.map((c) => totals[c.key] ?? ''));
      row.font = { bold: true };
      row.eachCell((cell) => { cell.border = { top: { style: 'thin', color: { argb: INK } } }; });
    }

    columns.forEach((c, i) => { if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt; });
    ws.getCell('A1').numFmt = '@';
    ws.getCell('A2').numFmt = '@';
  });

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

// jsPDF's built-in fonts have no ₹ glyph, so PDFs spell the currency out.
export const pdfMoney = (v) => `Rs. ${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/**
 * summary: [[label, value]]; sections: [{ heading, columns: [header], rows: [[cell]], totals?: [cell] }]
 */
export async function exportPdf({ fileName, title, subtitle, summary = [], sections }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const margin = 40;

  doc.setFillColor(21, 23, 26);
  doc.rect(0, 0, width, 64, 'F');
  doc.setFillColor(242, 169, 0);
  doc.rect(margin, 22, 18, 18, 'F');
  doc.setTextColor(245, 243, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Fulmile', margin + 28, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated ${stamp()}`, width - margin, 36, { align: 'right' });

  doc.setTextColor(21, 23, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, margin, 100);
  let y = 104;
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 106, 101);
    doc.text(subtitle, margin, 120);
    y = 124;
  }

  const base = {
    margin: { left: margin, right: margin },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 6, lineColor: [226, 222, 213], lineWidth: 0.5 },
    headStyles: { fillColor: [21, 23, 26], textColor: [245, 243, 238], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 243, 238], textColor: [21, 23, 26], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 249, 246] },
  };

  if (summary.length) {
    autoTable(doc, { ...base, startY: y + 12, body: summary, theme: 'grid', tableWidth: 360, columnStyles: { 0: { fontStyle: 'bold' } } });
    y = doc.lastAutoTable.finalY;
  }

  sections.forEach(({ heading, columns, rows, totals }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(21, 23, 26);
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = 40; }
    doc.text(heading, margin, y + 30);
    autoTable(doc, {
      ...base,
      startY: y + 38,
      head: [columns],
      body: rows.length ? rows : [[{ content: 'No entries', colSpan: columns.length, styles: { halign: 'center', textColor: [107, 106, 101] } }]],
      foot: totals ? [totals] : undefined,
      showFoot: 'lastPage',
    });
    y = doc.lastAutoTable.finalY;
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 106, 101);
    doc.text(`Fulmile · ${title}`, margin, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Page ${i} of ${pages}`, width - margin, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }

  doc.save(fileName);
}
