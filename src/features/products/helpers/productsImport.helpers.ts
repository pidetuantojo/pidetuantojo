import * as XLSX from 'xlsx';

import type { Category, Product, CreateProductData } from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

export const PRODUCT_TAGS = [
  '🔥 El más pedido',
  '💝 El favorito de todos',
  '⭐ Recomendado hoy',
  '✨ Nuevo',
  '🏆 El clásico',
  '🌀 Edición especial',
] as const;

export const MAX_IMPORT_ROWS = 500;

// ─── Normalización ────────────────────────────────────────────────────────────

/** Quita tildes, pasa a minúsculas y recorta — para comparaciones fuzzy. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Convierte un encabezado de celda a clave interna: sin tildes, minúsculas, guión bajo. */
function normalizeKey(k: string): string {
  return norm(k).replace(/\s+/g, '_');
}

/** Precio desde string o número: limpia `$`, `.` (miles) y `,`. */
export function parsePrice(s: unknown): number {
  if (typeof s === 'number') return s;
  const str = String(s ?? '').replace(/[$\s]/g, '').replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

/** SI/NO/Sí/1/0/true/false → boolean con valor por defecto. */
function parseBool(s: unknown, defaultVal = true): boolean {
  if (typeof s === 'boolean') return s;
  const str = norm(String(s ?? ''));
  if (['si', 'si', '1', 'true', 'yes'].includes(str)) return true;
  if (['no', '0', 'false'].includes(str)) return false;
  return defaultVal;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface RawRow {
  nombre: string;
  categoria: string;
  precio: unknown;
  descripcion: string;
  etiqueta: string;
  disponible: unknown;
  activo: unknown;
  orden: unknown;
  imagen_url: string;
  _rowIndex: number; // número de fila en el Excel (base 1, empieza en 2)
}

export interface ValidatedRow {
  raw: RawRow;
  data?: Omit<CreateProductData, 'restaurantId'>;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
}

export interface ImportContext {
  categories: Category[];
  existingProducts: Product[];
}

// ─── Template ─────────────────────────────────────────────────────────────────

export function buildProductsTemplate(categories: Category[], restaurantSlug: string): void {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Productos ──
  const headers = ['nombre', 'categoria', 'precio', 'descripcion', 'etiqueta', 'disponible', 'activo', 'orden', 'imagen_url'];
  const exampleRow = [
    '#ejemplo — modifica esta fila o agrégala debajo',
    categories[0]?.name ?? 'Escribe la categoría aquí',
    15000,
    'Descripción del producto (opcional)',
    '🔥 El más pedido',
    'SI',
    'SI',
    1,
    '',
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  ws1['!cols'] = [
    { wch: 36 }, { wch: 22 }, { wch: 12 }, { wch: 42 },
    { wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 52 },
  ];
  ws1['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', sqref: 'A2' }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Productos');

  // ── Hoja 2: Categorías ──
  const catData: unknown[][] = [['Nombre de categoría']];
  if (categories.length === 0) {
    catData.push(['(No hay categorías — crea al menos una antes de importar)']);
  } else {
    categories.forEach((c) => catData.push([c.name]));
  }
  const ws2 = XLSX.utils.aoa_to_sheet(catData);
  ws2['!cols'] = [{ wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Categorías');

  // ── Hoja 3: Instrucciones ──
  const tagList = PRODUCT_TAGS.join(' | ');
  const instructions: unknown[][] = [
    ['Campo', 'Obligatorio', 'Descripción', 'Ejemplo'],
    ['nombre',      'Sí', '2–80 caracteres', 'Maracumango'],
    ['categoria',   'Sí', 'Debe coincidir con un nombre de la hoja Categorías (sin importar tildes ni mayúsculas)', 'Granizados'],
    ['precio',      'Sí', 'Número positivo. Se acepta: 15000, "15.000", "$15.000"', '15000'],
    ['descripcion', 'No', 'Máx. 300 caracteres', 'Frappé de mango y maracuyá…'],
    ['etiqueta',    'No', tagList + ' | (vacío = sin etiqueta)', '🔥 El más pedido'],
    ['disponible',  'No', 'SI o NO — Default: SI', 'SI'],
    ['activo',      'No', 'SI o NO — Default: SI', 'SI'],
    ['orden',       'No', 'Entero ≥ 1 — Default: siguiente disponible en la categoría', '1'],
    ['imagen_url',  'No', 'URL completa que empiece con https://', 'https://…'],
    [],
    ['Notas:'],
    ['• La fila que empieza con #ejemplo se ignora automáticamente.'],
    ['• Máximo 500 filas por archivo.'],
    ['• Los adicionales se asignan luego desde el formulario de cada producto.'],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(instructions);
  ws3['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 72 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Instrucciones');

  XLSX.writeFile(wb, `plantilla-productos-${restaurantSlug}.xlsx`);
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

export async function parseProductsSheet(file: File): Promise<RawRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const rows: RawRow[] = [];
  raw.forEach((row, i) => {
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[normalizeKey(k)] = v;
    }
    const nombre = String(normalized['nombre'] ?? '').trim();
    if (nombre.startsWith('#')) return; // fila de ejemplo
    rows.push({
      nombre,
      categoria:   String(normalized['categoria']   ?? '').trim(),
      precio:      normalized['precio'],
      descripcion: String(normalized['descripcion'] ?? '').trim(),
      etiqueta:    String(normalized['etiqueta']    ?? '').trim(),
      disponible:  normalized['disponible'],
      activo:      normalized['activo'],
      orden:       normalized['orden'],
      imagen_url:  String(normalized['imagen_url']  ?? '').trim(),
      _rowIndex:   i + 2,
    });
  });

  return rows;
}

// ─── Validación ───────────────────────────────────────────────────────────────

/**
 * Valida una fila y devuelve los datos listos para crear o los errores.
 * `batchKeys` se modifica in-place para detectar duplicados dentro del mismo archivo.
 */
export function validateProductRow(
  row: RawRow,
  ctx: ImportContext,
  batchKeys: Set<string>,
): ValidatedRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  let isDuplicate = false;

  // nombre
  if (!row.nombre) {
    errors.push('El nombre es obligatorio');
  } else if (row.nombre.length < 2) {
    errors.push('Nombre demasiado corto (mínimo 2 caracteres)');
  } else if (row.nombre.length > 80) {
    errors.push('Nombre demasiado largo (máximo 80 caracteres)');
  }

  // categoria
  const cat = ctx.categories.find((c) => norm(c.name) === norm(row.categoria));
  if (!row.categoria) {
    errors.push('La categoría es obligatoria');
  } else if (!cat) {
    errors.push(`La categoría "${row.categoria}" no existe. Revisá la hoja Categorías.`);
  }

  // precio
  const price = parsePrice(row.precio);
  if (price <= 0) errors.push('El precio debe ser mayor a 0');

  // descripcion
  if (row.descripcion.length > 300) errors.push('La descripción supera los 300 caracteres');

  // etiqueta
  const tag = row.etiqueta;
  if (tag && !(PRODUCT_TAGS as readonly string[]).includes(tag)) {
    warnings.push(`Etiqueta "${tag}" no reconocida — se ignorará`);
  }

  // imagen_url
  const imageUrl = row.imagen_url;
  if (imageUrl && !imageUrl.startsWith('https://')) {
    warnings.push('La URL de imagen no empieza con https:// — se ignorará');
  }

  // orden
  const ordenStr = String(row.orden ?? '').trim();
  const orden = ordenStr !== '' ? parseInt(ordenStr, 10) : null;
  if (orden !== null && (isNaN(orden) || orden < 1)) {
    errors.push('El orden debe ser un entero ≥ 1');
  }

  // duplicados
  if (cat && row.nombre) {
    const key = `${cat.id}::${row.nombre.trim().toLowerCase()}`;
    if (batchKeys.has(key)) {
      isDuplicate = true;
      warnings.push('Duplicado en el archivo: mismo nombre y categoría');
    } else {
      batchKeys.add(key);
    }
    const existing = ctx.existingProducts.find(
      (p) => p.categoryId === cat.id && p.name.trim().toLowerCase() === row.nombre.trim().toLowerCase(),
    );
    if (existing) {
      isDuplicate = true;
      warnings.push('Ya existe un producto con este nombre en esta categoría');
    }
  }

  if (errors.length > 0) return { raw: row, errors, warnings, isDuplicate };

  // sortOrder default: siguiente al máximo de esa categoría
  let sortOrder = orden ?? 1;
  if (orden === null && cat) {
    const inCat = ctx.existingProducts.filter((p) => p.categoryId === cat.id);
    sortOrder = inCat.length > 0 ? Math.max(...inCat.map((p) => p.sortOrder)) + 1 : 1;
  }

  const finalTag   = (PRODUCT_TAGS as readonly string[]).includes(tag) ? tag : undefined;
  const finalImage = imageUrl.startsWith('https://') ? imageUrl : undefined;

  const data: Omit<CreateProductData, 'restaurantId'> = {
    categoryId:   cat!.id,
    name:         row.nombre.trim(),
    price,
    ...(row.descripcion ? { description: row.descripcion } : {}),
    ...(finalTag         ? { tag: finalTag }                : {}),
    ...(finalImage       ? { image: finalImage }            : {}),
    adicionalIds: [],
    isActive:     parseBool(row.activo,     true),
    isAvailable:  parseBool(row.disponible, true),
    sortOrder,
  };

  return { raw: row, data, errors: [], warnings, isDuplicate };
}

// ─── Export errores ───────────────────────────────────────────────────────────

export function buildErrorsExcel(rows: ValidatedRow[]): void {
  const data = rows.map((r) => ({
    fila:        r.raw._rowIndex,
    nombre:      r.raw.nombre,
    categoria:   r.raw.categoria,
    precio:      r.raw.precio,
    descripcion: r.raw.descripcion,
    etiqueta:    r.raw.etiqueta,
    disponible:  r.raw.disponible ?? 'SI',
    activo:      r.raw.activo    ?? 'SI',
    orden:       r.raw.orden     ?? '',
    imagen_url:  r.raw.imagen_url,
    error:       [...r.errors, ...r.warnings].join(' | '),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 6 }, { wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 40 },
    { wch: 26 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 40 }, { wch: 60 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errores');
  XLSX.writeFile(wb, `errores-importacion-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
