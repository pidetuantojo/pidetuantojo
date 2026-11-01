// Exportación tabular en el navegador: CSV (UTF-8 con BOM) y Excel. Funciones puras + descarga.
import * as XLSX from 'xlsx';

export type Cell = string | number | null;
export type ExportRow = Record<string, Cell>;

const CSV_BOM = '﻿';
// Caracteres con los que una hoja de cálculo interpreta la celda como fórmula
const FORMULA_START = /^[=+\-@\t\r]/;

/** Texto que empieza como fórmula (`=`, `+`, `-`, `@`) se neutraliza con un apóstrofo. */
export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value;
}

/** Escapa una celda CSV. Los números (incluidos negativos) van tal cual: no son texto. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function headersOf(rows: readonly ExportRow[]): string[] {
  const headers: string[] = [];
  rows.forEach((row) =>
    Object.keys(row).forEach((key) => {
      if (!headers.includes(key)) headers.push(key);
    })
  );
  return headers;
}

/** CSV con BOM, separador coma y saltos CRLF. */
export function toCsv(rows: readonly ExportRow[]): string {
  const headers = headersOf(rows);
  const lines = [
    headers.map((h) => csvCell(h)).join(','),
    ...rows.map((row) => headers.map((h) => csvCell(row[h] ?? null)).join(',')),
  ];
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: readonly ExportRow[], filename: string): void {
  triggerDownload(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), filename);
}

export function downloadXlsx(
  rows: readonly ExportRow[],
  filename: string,
  sheet = 'Reporte'
): void {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([...rows]), sheet.slice(0, 31));
  XLSX.writeFile(workbook, filename);
}
