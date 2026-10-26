import { Q } from '../core/rational.ts';

/**
 * Bråkverkstaden: Samuel arbetar direkt i bråken.
 *
 * Han väljer en täljare eller nämnare, väljer att multiplicera eller dividera
 * med ett tal och räknar själv ut resultatet. Appen kontrollerar uträkningen
 * exakt men gör den aldrig åt honom. Ett bråk vars täljare och nämnare har
 * ändrats olika har bytt värde: det markeras tills han gjort samma sak med
 * den andra delen. När alla bråk har samma nämnare kan de slås ihop.
 *
 * Allt här är rena funktioner, så att reglerna går att testa utan gränssnitt.
 */

export type Op = '+' | '-';
export type Part = 'n' | 'd';
export type Kind = 'mul' | 'div';

export interface Term {
  n: number;
  d: number;
  /** Bråkets värde när det skrevs. Om n/d skiljer sig från det är bråket ändrat. */
  value: Q;
  /** Senaste ändringen, för att kunna säga vad som saknas. */
  last?: { part: Part; kind: Kind; k: number };
}

export interface WorkState {
  terms: Term[];
  ops: Op[];
}

export type Result<T> = { ok: true; state: T } | { ok: false; message: string };

export function start(terms: Array<{ n: number; d: number }>, ops: Op[]): WorkState {
  return { terms: terms.map((t) => ({ n: t.n, d: t.d, value: Q.of(t.n, t.d) })), ops: [...ops] };
}

export function isBalanced(t: Term): boolean {
  return Q.of(t.n, t.d).eq(t.value);
}

export function allBalanced(s: WorkState): boolean {
  return s.terms.every(isBalanced);
}

const PART = { n: 'täljaren', d: 'nämnaren' } as const;
const OTHER = { n: 'nämnaren', d: 'täljaren' } as const;

/** Multiplicera eller dividera en täljare eller nämnare. Samuel anger resultatet själv. */
export function applyToPart(s: WorkState, index: number, part: Part, kind: Kind, k: number, result: number): Result<WorkState> {
  const t = s.terms[index];
  if (!t) return { ok: false, message: 'Bråket finns inte.' };
  if (!Number.isInteger(k) || k < 2) return { ok: false, message: 'Välj ett heltal som är 2 eller större.' };
  if (!Number.isInteger(result)) return { ok: false, message: 'Skriv resultatet som ett heltal.' };
  const before = t[part];
  if (kind === 'div' && before % k !== 0) {
    return { ok: false, message: `${before} går inte att dela jämnt med ${k}.` };
  }
  const expected = kind === 'mul' ? before * k : before / k;
  const sign = kind === 'mul' ? '·' : ':';
  if (result !== expected) return { ok: false, message: `${before} ${sign} ${k} är inte ${result}. Räkna en gång till.` };

  const next: Term = { ...t, [part]: expected, last: { part, kind, k } };
  const terms = s.terms.map((x, i) => (i === index ? next : x));
  return { ok: true, state: { ...s, terms } };
}

/** Vad Samuel ska få veta om ett bråk som har bytt värde. */
export function imbalanceMessage(t: Term): string | null {
  if (isBalanced(t) || !t.last) return null;
  const { part, kind, k } = t.last;
  const verb = kind === 'mul' ? `multiplicerat ${PART[part]} med ${k}` : `dividerat ${PART[part]} med ${k}`;
  return `Du har ${verb}. Gör samma sak med ${OTHER[part]}, annars ändras bråkets värde.`;
}

export function commonDenominator(s: WorkState): number | null {
  const d = s.terms[0]?.d;
  return d !== undefined && s.terms.every((t) => t.d === d) ? d : null;
}

/** Varför bråken inte kan slås ihop än, eller null om de kan det. */
export function whyNotCombine(s: WorkState): string | null {
  if (s.terms.length < 2) return 'Det finns bara ett bråk.';
  if (!allBalanced(s)) return 'Något bråk har ändrats bara på ena stället. Gör klart det först.';
  if (commonDenominator(s) === null) return 'Bråken måste ha samma nämnare innan de kan slås ihop.';
  return null;
}

/** Den täljare som ska bli resultatet när bråken slås ihop. */
export function combinedNumerator(s: WorkState): number {
  return s.terms.reduce((acc, t, i) => (i === 0 ? t.n : s.ops[i - 1] === '+' ? acc + t.n : acc - t.n), 0);
}

/** Slå ihop bråk med samma nämnare. Samuel räknar ut den nya täljaren själv. */
export function combine(s: WorkState, numerator: number): Result<WorkState> {
  const why = whyNotCombine(s);
  if (why) return { ok: false, message: why };
  const expected = combinedNumerator(s);
  if (numerator !== expected) {
    const sum = s.terms.map((t, i) => (i === 0 ? `${t.n}` : `${s.ops[i - 1] === '+' ? '+' : '−'} ${t.n}`)).join(' ');
    return { ok: false, message: `${sum} är inte ${numerator}. Räkna en gång till.` };
  }
  const d = commonDenominator(s)!;
  const value = s.terms.reduce((acc, t, i) => (i === 0 ? t.value : s.ops[i - 1] === '+' ? acc.add(t.value) : acc.sub(t.value)), Q.ZERO);
  return { ok: true, state: { terms: [{ n: expected, d, value }], ops: [] } };
}

/** Hela uttryckets värde (bara meningsfullt när alla bråk är oförändrade i värde). */
export function valueOf(s: WorkState): Q {
  return s.terms.reduce(
    (acc, t, i) => (i === 0 ? Q.of(t.n, t.d) : s.ops[i - 1] === '+' ? acc.add(Q.of(t.n, t.d)) : acc.sub(Q.of(t.n, t.d))),
    Q.ZERO,
  );
}

/** Uttrycket i uppgiftsnotationen, för raderna i räknehäftet. */
export function toMarkup(s: WorkState): string {
  return s.terms.map((t, i) => `${i === 0 ? '' : ` ${s.ops[i - 1]} `}{${t.n}/${t.d}}`).join('');
}

/** Svaret som Samuel skulle ha skrivit det, för rättningen. */
export function toAnswer(s: WorkState): string | null {
  if (s.terms.length !== 1) return null;
  const t = s.terms[0]!;
  return t.d === 1 ? `${t.n}` : `${t.n}/${t.d}`;
}
