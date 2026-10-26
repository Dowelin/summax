import { Q } from './rational.ts';

/**
 * Formatering för uppgiftstexter. Matematik skrivs inom $…$ i en liten
 * egen notation som vyn ritar som boktypografi:
 *   {3/4}     ett staplat bråk
 *   2{1/3}    blandad form
 *   - · ÷ =   ritas som riktiga matematiska tecken
 */

/** Ett tal som det skrivs i en svensk lärobok: 0,75 · 3/4 · 1 1/2 · 12 000. */
export function fmt(q: Q, prefer: 'auto' | 'fraction' | 'mixed' = 'auto'): string {
  if (q.isInteger()) return groupThousands(q.n.toString());
  if (prefer === 'auto' && q.isTerminatingDecimal()) {
    const s = q.toDecimalString();
    const [w, f] = s.split(',') as [string, string];
    return `${groupThousands(w)},${f}`;
  }
  if (prefer === 'mixed' || (prefer === 'auto' && q.cmp(Q.ONE) > 0 && !q.isNegative())) {
    const m = q.toMixed();
    if (m.whole > 0n) return `${m.negative ? '-' : ''}${m.whole}{${m.num}/${m.den}}`;
  }
  return frac(q);
}

/** Alltid bråkform, även för oäkta bråk: {7/4}. */
export function frac(q: Q): string {
  if (q.isInteger()) return q.n.toString();
  return q.isNegative() ? `-{${-q.n}/${q.d}}` : `{${q.n}/${q.d}}`;
}

/** Bråk med valfri (ej förkortad) täljare och nämnare. */
export function rawFrac(n: bigint | number, d: bigint | number): string {
  return `{${n}/${d}}`;
}

/** Kronor med öre när det behövs: "127,50". */
export function kr(q: Q): string {
  if (q.isInteger()) return groupThousands(q.n.toString());
  const s = fmt(q);
  const [w, f = ''] = s.split(',');
  return `${w},${f.padEnd(2, '0')}`;
}

function groupThousands(s: string): string {
  const negative = s.startsWith('-');
  const digits = negative ? s.slice(1) : s;
  if (digits.length < 5) return s;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return negative ? `-${grouped}` : grouped;
}
