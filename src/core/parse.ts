import { Q, gcd } from './rational.ts';
import { parseUnit, type Unit } from './units.ts';

/**
 * Tolkar det Samuel skriver i svarsfältet. Parsern gissar aldrig:
 * det som inte entydigt kan läsas blir { kind: 'invalid' }.
 */

export type NumberForm = 'integer' | 'decimal' | 'fraction' | 'mixed';

export interface ParsedNumber {
  value: Q;
  form: NumberForm;
  /**
   * Är talet skrivet i enklaste form? Heltal och decimaltal är alltid det.
   * Bråk: täljare och nämnare saknar gemensam faktor och nämnaren är inte 1.
   * Blandad form: bråkdelen är ett äkta, förkortat bråk.
   */
  reduced: boolean;
  /** Skrivet som ett oäkta bråk, t.ex. 7/4. */
  improper: boolean;
}

export type Parsed =
  | { kind: 'number'; num: ParsedNumber }
  | { kind: 'percent'; num: ParsedNumber }
  | { kind: 'quantity'; num: ParsedNumber; unit: Unit }
  | { kind: 'solution'; variable: string; num: ParsedNumber }
  | { kind: 'empty' }
  | { kind: 'invalid' };

export function normalize(raw: string): string {
  return raw
    .replace(/[−–—]/g, '-') // minustecken och tankstreck
    .replace(/[   ]/g, ' ') // hårda och smala mellanslag
    .replace(/⁄/g, '/') // bråkstreck
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseAnswer(raw: string): Parsed {
  const s = normalize(raw);
  if (s === '') return { kind: 'empty' };

  // Lösning till en ekvation: "x = 9", "x=-3/4"
  const sol = /^([a-z])\s*=\s*(.+)$/.exec(s);
  if (sol) {
    const num = parseNumber(sol[2]!);
    return num ? { kind: 'solution', variable: sol[1]!, num } : { kind: 'invalid' };
  }

  // Procent: "15 %", "15%", "15 procent"
  const pct = /^(.+?)\s*(%|procent)$/.exec(s);
  if (pct) {
    const num = parseNumber(pct[1]!);
    return num ? { kind: 'percent', num } : { kind: 'invalid' };
  }

  const num = parseNumber(s);
  if (num) return { kind: 'number', num };

  // Storhet med enhet: "24 cm2", "2,5dm", "360 kr"
  // Enheten börjar alltid med en bokstav eller ":" (":-" för kronor).
  const q = /^(.*[0-9])\s*([a-zåäö:][a-zåäö.²^:\-]*(?: ?2)?)$/.exec(s);
  if (q) {
    const unit = parseUnit(q[2]!);
    const n = parseNumber(q[1]!);
    if (unit && n) return { kind: 'quantity', num: n, unit };
  }

  return { kind: 'invalid' };
}

const INT = /^-?\d+$/;
const INT_GROUPED = /^-?\d{1,3}( \d{3})+$/;
const DEC = /^-?\d+[.,]\d+$/;
const DEC_GROUPED = /^-?\d{1,3}( \d{3})+[.,]\d+$/;
const FRAC = /^(-?)(\d+) ?\/ ?(\d+)$/;
const MIXED = /^(-?)(\d+) (\d+) ?\/ ?(\d+)$/;

export function parseNumber(raw: string): ParsedNumber | null {
  const s = normalize(raw);

  if (INT.test(s) || INT_GROUPED.test(s)) {
    return { value: Q.int(BigInt(s.replace(/ /g, ''))), form: 'integer', reduced: true, improper: false };
  }

  if (DEC.test(s) || DEC_GROUPED.test(s)) {
    const t = s.replace(/ /g, '').replace(',', '.');
    const negative = t.startsWith('-');
    const [w, f] = t.replace('-', '').split('.') as [string, string];
    const value = Q.of(BigInt(w + f), 10n ** BigInt(f.length));
    return { value: negative ? value.neg() : value, form: 'decimal', reduced: true, improper: false };
  }

  const mixed = MIXED.exec(s);
  if (mixed) {
    const [, sign, w, n, d] = mixed as unknown as [string, string, string, string, string];
    const whole = BigInt(w);
    const num = BigInt(n);
    const den = BigInt(d);
    if (den === 0n || num === 0n || whole === 0n) return null;
    let value = Q.int(whole).add(Q.of(num, den));
    if (sign === '-') value = value.neg();
    const reduced = num < den && gcd(num, den) === 1n;
    return { value, form: 'mixed', reduced, improper: num >= den };
  }

  const frac = FRAC.exec(s);
  if (frac) {
    const [, sign, n, d] = frac as unknown as [string, string, string, string];
    const num = BigInt(n);
    const den = BigInt(d);
    if (den === 0n) return null;
    let value = Q.of(num, den);
    if (sign === '-') value = value.neg();
    const reduced = den !== 1n && gcd(num, den) === 1n;
    return { value, form: 'fraction', reduced, improper: num >= den };
  }

  return null;
}
