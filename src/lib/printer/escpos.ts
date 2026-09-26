import type { PaperWidth, PrinterEncoding } from '@/types';

// Comandos ESC/POS (compatibles con Epson y la mayoría de térmicas genéricas)
const ESC = '\x1B';
const GS = '\x1D';

/** Caracteres por línea con la fuente A (12×24). */
export const CHARS_PER_LINE: Record<PaperWidth, number> = { 58: 32, 80: 48 };

// Tipografía "linda" que la impresora no tiene → equivalente ASCII
const REPLACEMENTS: Record<string, string> = {
  '—': '-', '–': '-', '•': '*', '·': '-', '…': '...',
  '“': '"', '”': '"', '‘': "'", '’': "'", '×': 'x',
};

/**
 * Deja el texto imprimible: sin saltos/controles embebidos ni emojis.
 * - cp850: conserva tildes, ñ, ¿ ¡ (existen en la página de códigos 850).
 * - ascii: quita tildes (ñ → n) para impresoras que no soportan CP850.
 */
export function sanitizeText(input: string, encoding: PrinterEncoding): string {
  let text = input.replace(/[\r\n\t]+/g, ' ');
  text = text.replace(/[—–•·…“”‘’×]/g, (c) => REPLACEMENTS[c] ?? c);
  // Emojis y demás caracteres fuera del plano básico
  text = text.replace(/[\uD800-\uDFFF]/g, '');
  // Controles (incluido ESC/GS) que romperían los comandos
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\x00-\x1F\x7F]/g, '');
  if (encoding === 'ascii') {
    text = text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿¡]/g, '');
    text = text.replace(/[^\x20-\x7E]/g, '?');
  } else {
    // Latin-1 cubre lo que CP850 imprime en español; lo demás se marca con "?"
    text = text.replace(/[^\x20-\x7E -ÿ]/g, '?');
  }
  return text.replace(/ {2,}/g, ' ').trim();
}

/** Parte un texto en líneas de `width` caracteres sin cortar palabras (salvo palabras más largas que la línea). */
export function wrap(text: string, width: number): string[] {
  const words = text.split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) { lines.push(current); current = ''; }
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
      continue;
    }
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export type Align = 'left' | 'center' | 'right';

/** Builder encadenable de un ticket ESC/POS. `build()` devuelve el string listo para qz.print (flavor plain). */
export class EscPos {
  private out: string[] = [];
  readonly width: number;

  constructor(paperWidth: PaperWidth, private encoding: PrinterEncoding) {
    this.width = CHARS_PER_LINE[paperWidth];
  }

  /** Reinicia la impresora y selecciona la página de códigos (CP850 = ESC t 2). */
  init(): this {
    this.out.push(`${ESC}@`);
    if (this.encoding === 'cp850') this.out.push(`${ESC}t\x02`);
    return this;
  }

  align(a: Align): this {
    const n = a === 'center' ? 1 : a === 'right' ? 2 : 0;
    this.out.push(`${ESC}a${String.fromCharCode(n)}`);
    return this;
  }

  bold(on = true): this {
    this.out.push(`${ESC}E${on ? '\x01' : '\x00'}`);
    return this;
  }

  /** Doble ancho y doble alto (la línea útil queda a la mitad de caracteres). */
  doubleSize(on = true): this {
    this.out.push(`${GS}!${on ? '\x11' : '\x00'}`);
    return this;
  }

  /** Texto sin salto de línea. */
  text(value: string): this {
    this.out.push(sanitizeText(value, this.encoding));
    return this;
  }

  /**
   * Texto con ajuste de línea (usar `chars` menor si está en doble tamaño).
   * Conserva la sangría inicial en todas las líneas (ej: "  + Adicional").
   */
  line(value = '', chars = this.width): this {
    const indent = ' '.repeat(Math.min(value.length - value.trimStart().length, Math.floor(chars / 2)));
    const clean = sanitizeText(value, this.encoding);
    for (const l of wrap(clean, chars - indent.length)) this.out.push(`${indent}${l}\n`);
    return this;
  }

  /** Dos columnas: texto a la izquierda (con ajuste) y monto alineado a la derecha en la última línea. */
  lineLR(left: string, right: string): this {
    const r = sanitizeText(right, this.encoding);
    const lines = wrap(sanitizeText(left, this.encoding), Math.max(8, this.width - r.length - 1));
    lines.forEach((l, i) => {
      if (i < lines.length - 1) this.out.push(`${l}\n`);
      else this.out.push(`${l}${' '.repeat(Math.max(1, this.width - l.length - r.length))}${r}\n`);
    });
    return this;
  }

  divider(char = '-'): this {
    this.out.push(`${char.repeat(this.width)}\n`);
    return this;
  }

  feed(lines = 1): this {
    this.out.push(`${ESC}d${String.fromCharCode(Math.max(0, Math.min(255, lines)))}`);
    return this;
  }

  /** Avanza el papel y hace corte parcial (GS V 66 n). */
  cut(): this {
    this.out.push(`${GS}V\x42\x03`);
    return this;
  }

  /** Pulso para abrir el cajón monedero (pin 2). */
  openDrawer(): this {
    this.out.push(`${ESC}p\x00\x19\xFA`);
    return this;
  }

  build(): string {
    return this.out.join('');
  }
}
