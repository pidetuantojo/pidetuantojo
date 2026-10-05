'use client';

import { useCallback, useRef, useState } from 'react';
import { Download, Upload, X, CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/constants/query-keys';
import { useCategories } from '@/features/categories/hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import { productsService } from '../../services/products.service';
import {
  buildProductsTemplate,
  parseProductsSheet,
  validateProductRow,
  buildErrorsExcel,
  MAX_IMPORT_ROWS,
  type ValidatedRow,
  type ImportContext,
} from '../../helpers/productsImport.helpers';

const sg = 'var(--font-sans, sans-serif)';
const ORANGE = '#FF6A1A';

interface Props {
  restaurantId: string;
  restaurantSlug: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

const ACCEPT = '.xlsx,.xls,.csv';
const MAX_MB = 2;

// ─── Component ───────────────────────────────────────────────────────────────

export function ProductsImport({ restaurantId, restaurantSlug, onClose }: Props) {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(restaurantId);
  const { data: existingProducts = [] } = useProducts(restaurantId);

  const [step, setStep] = useState<Step>(1);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ─── derived ───────────────────────────────────────────────────────────────

  const validRows     = rows.filter((r) => r.errors.length === 0 && (!r.isDuplicate || !skipDuplicates));
  const errorRows     = rows.filter((r) => r.errors.length > 0);
  const duplicateRows = rows.filter((r) => r.errors.length === 0 && r.isDuplicate);
  const warnRows      = rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0 && !r.isDuplicate);
  const toImport      = validRows.length;

  // ─── file handling ─────────────────────────────────────────────────────────

  async function processFile(file: File) {
    setFileError('');
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setFileError('Solo se aceptan archivos .xlsx, .xls o .csv');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`El archivo supera los ${MAX_MB} MB`);
      return;
    }
    setParsing(true);
    try {
      const rawRows = await parseProductsSheet(file);
      if (rawRows.length === 0) { setFileError('El archivo no tiene filas de datos'); return; }
      if (rawRows.length > MAX_IMPORT_ROWS) { setFileError(`El archivo tiene más de ${MAX_IMPORT_ROWS} filas. Dividilo en varios archivos.`); return; }

      const ctx: ImportContext = { categories, existingProducts };
      const batchKeys = new Set<string>();
      const validated = rawRows.map((r) => validateProductRow(r, ctx, batchKeys));
      setRows(validated);
      setStep(2);
    } catch {
      setFileError('No se pudo leer el archivo. Verificá que sea un Excel válido.');
    } finally {
      setParsing(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [categories, existingProducts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    if (toImport === 0) return;
    setStep(3);
    setProgress(0);
    setProgressTotal(toImport);
    setImportError('');
    setImportResult(null);

    try {
      const products = validRows.map((r) => r.data!);
      await productsService.createMany(restaurantId, products, (done, total) => {
        setProgress(done);
        setProgressTotal(total);
      });
      await qc.invalidateQueries({ queryKey: QUERY_KEYS.products(restaurantId) });
      const skipped = (skipDuplicates ? duplicateRows.length : 0) + errorRows.length;
      setImportResult({ created: toImport, skipped });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Ocurrió un error al importar');
    }
  }

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: sg,
      }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--t-surface)',
        borderRadius: 20,
        width: '100%',
        maxWidth: step === 2 ? 900 : 560,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 60px -12px rgba(0,0,0,.4)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--t-border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--t-text-1)', letterSpacing: '-.02em' }}>
              {step === 1 ? 'Importar productos desde Excel' : step === 2 ? 'Vista previa de importación' : 'Importando…'}
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--t-text-3)' }}>
              {step === 1 && 'Descargá la plantilla, completala y subila.'}
              {step === 2 && `${rows.length} fila${rows.length !== 1 ? 's' : ''} leídas del archivo.`}
              {step === 3 && (importResult ? 'Importación completada.' : 'No cerrés esta ventana.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'var(--t-surface-2)', color: 'var(--t-text-3)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Download template */}
              <div style={{ background: 'var(--t-surface-2)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#d1fae5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <FileSpreadsheet size={22} color="#059669" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t-text-1)', marginBottom: 2 }}>Plantilla de productos</div>
                  <div style={{ fontSize: 13, color: 'var(--t-text-3)' }}>
                    Incluye hojas de Categorías e Instrucciones.
                    {categories.length === 0 && <span style={{ color: '#d97706', fontWeight: 600 }}> Creá al menos una categoría primero.</span>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={categories.length === 0}
                  onClick={() => buildProductsTemplate(categories, restaurantSlug)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                    borderRadius: 10, border: 'none', background: '#059669', color: '#fff',
                    fontFamily: sg, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: categories.length === 0 ? 0.5 : 1, flexShrink: 0,
                  }}
                >
                  <Download size={15} /> Descargar
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? ORANGE : 'var(--t-border)'}`,
                  borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                  background: dragging ? 'rgba(255,106,26,.05)' : 'var(--t-surface-2)',
                  cursor: 'pointer', transition: 'border-color .15s, background .15s',
                }}
              >
                <div style={{ marginBottom: 12, opacity: parsing ? .5 : 1 }}>
                  <Upload size={32} color={ORANGE} style={{ margin: '0 auto' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-1)', marginBottom: 4 }}>
                  {parsing ? 'Leyendo archivo…' : 'Arrastrá el archivo acá o hacé clic'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--t-text-3)' }}>.xlsx · .xls · .csv · máx. 2 MB</div>
                <input ref={fileRef} type="file" accept={ACCEPT} onChange={handleFileInput} style={{ display: 'none' }} />
              </div>

              {fileError && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px' }}>
                  <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#b91c1c' }}>{fileError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Preview ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Chip icon={<CheckCircle2 size={14} />} color="#059669" bg="#d1fae5" label={`${rows.filter(r => r.errors.length === 0 && !r.isDuplicate).length} válidos`} />
                {errorRows.length > 0 && <Chip icon={<XCircle size={14} />} color="#b91c1c" bg="#fee2e2" label={`${errorRows.length} con error`} />}
                {duplicateRows.length > 0 && <Chip icon={<AlertTriangle size={14} />} color="#b45309" bg="#fef3c7" label={`${duplicateRows.length} duplicados`} />}
                {warnRows.length > 0 && <Chip icon={<AlertTriangle size={14} />} color="#b45309" bg="#fef3c7" label={`${warnRows.length} con advertencia`} />}
              </div>

              {/* Skip duplicates toggle */}
              {duplicateRows.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, color: 'var(--t-text-1)', background: 'var(--t-surface-2)', padding: '10px 14px', borderRadius: 10 }}>
                  <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} style={{ width: 15, height: 15, accentColor: ORANGE }} />
                  Omitir los {duplicateRows.length} duplicados (recomendado)
                </label>
              )}

              {/* Table */}
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--t-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--t-surface-2)', borderBottom: '1px solid var(--t-border)' }}>
                      {['', 'Fila', 'Nombre', 'Categoría', 'Precio', 'Estado'].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--t-text-2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const hasError = row.errors.length > 0;
                      const isDup    = row.errors.length === 0 && row.isDuplicate;
                      const hasWarn  = row.errors.length === 0 && row.warnings.length > 0 && !isDup;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--t-border-2)', background: hasError ? '#fef2f2' : isDup ? '#fffbeb' : 'transparent' }}>
                          <td style={{ padding: '8px 10px', paddingLeft: 14 }}>
                            {hasError  && <XCircle size={15} color="#ef4444" />}
                            {isDup     && <AlertTriangle size={15} color="#d97706" />}
                            {hasWarn   && <AlertTriangle size={15} color="#d97706" />}
                            {!hasError && !isDup && !hasWarn && <CheckCircle2 size={15} color="#059669" />}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--t-text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.raw._rowIndex}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--t-text-1)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.raw.nombre || <em style={{ color: 'var(--t-text-4)' }}>(vacío)</em>}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--t-text-2)' }}>{row.raw.categoria || '—'}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--t-text-2)', whiteSpace: 'nowrap' }}>
                            {row.raw.precio !== '' && row.raw.precio !== undefined ? `$${Number(row.raw.precio).toLocaleString('es-CO')}` : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', maxWidth: 260 }}>
                            {hasError && <span style={{ color: '#b91c1c', fontSize: 12 }}>{row.errors.join(' · ')}</span>}
                            {!hasError && row.warnings.length > 0 && <span style={{ color: '#92400e', fontSize: 12 }}>{row.warnings.join(' · ')}</span>}
                            {!hasError && row.warnings.length === 0 && <span style={{ color: '#059669', fontSize: 12 }}>OK</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STEP 3: Progress / Result ── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
              {!importResult && !importError && (
                <>
                  <div style={{ fontSize: 14, color: 'var(--t-text-2)' }}>Creando productos en Firestore…</div>
                  <div style={{ width: '100%', height: 10, background: 'var(--t-surface-2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: ORANGE, borderRadius: 999, transition: 'width .3s', width: progressTotal > 0 ? `${(progress / progressTotal) * 100}%` : '0%' }} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t-text-3)', fontFamily: 'var(--font-mono)' }}>{progress} / {progressTotal}</div>
                </>
              )}
              {importResult && (
                <>
                  <CheckCircle2 size={48} color="#059669" />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t-text-1)', marginBottom: 4 }}>
                      {importResult.created} producto{importResult.created !== 1 ? 's' : ''} importados
                    </div>
                    {importResult.skipped > 0 && (
                      <div style={{ fontSize: 13, color: 'var(--t-text-3)' }}>{importResult.skipped} omitidos (errores o duplicados)</div>
                    )}
                  </div>
                  {(errorRows.length > 0 || (skipDuplicates && duplicateRows.length > 0)) && (
                    <button
                      type="button"
                      onClick={() => buildErrorsExcel([...errorRows, ...(skipDuplicates ? duplicateRows : [])])}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 10, border: `1.5px solid var(--t-border)`, background: 'var(--t-surface)', color: 'var(--t-text-2)', fontFamily: sg, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Download size={15} /> Descargar filas con error (.xlsx)
                    </button>
                  )}
                </>
              )}
              {importError && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', textAlign: 'left' }}>
                  <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: '#b91c1c' }}>{importError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--t-border)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button
            type="button"
            onClick={step === 2 ? () => { setStep(1); setRows([]); } : onClose}
            style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid var(--t-border)', background: 'var(--t-surface)', color: 'var(--t-text-2)', fontFamily: sg, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            {step === 2 ? '← Volver' : 'Cerrar'}
          </button>

          {step === 2 && (
            <button
              type="button"
              disabled={toImport === 0}
              onClick={handleImport}
              style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: toImport === 0 ? 'var(--t-surface-2)' : ORANGE, color: toImport === 0 ? 'var(--t-text-4)' : '#fff', fontFamily: sg, fontSize: 14, fontWeight: 700, cursor: toImport === 0 ? 'not-allowed' : 'pointer' }}
            >
              Importar {toImport} producto{toImport !== 1 ? 's' : ''}
            </button>
          )}

          {step === 3 && importResult && (
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 22px', borderRadius: 10, border: 'none', background: ORANGE, color: '#fff', fontFamily: sg, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chip helper ─────────────────────────────────────────────────────────────

function Chip({ icon, color, bg, label }: { icon: React.ReactNode; color: string; bg: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: bg, color, fontSize: 13, fontWeight: 600 }}>
      {icon}{label}
    </span>
  );
}
