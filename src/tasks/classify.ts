import type { GradeResult } from '../core/grade.ts';
import { Q, abs } from '../core/rational.ts';
import type { Misconception, Task } from './types.ts';

/**
 * Klassning av ett fel svar (Fas 3, "Kunskapsfel, slarvfel eller okänt").
 * Slarvfel är alltid bara en sannolik gissning och visas aldrig med det
 * ordet för Samuel – han ombeds bara kontrollera sin uträkning.
 */
export type ErrorClass =
  | { kind: 'knowledge'; misconception: Misconception }
  | { kind: 'unit' }
  | { kind: 'careless'; pattern: 'sign' | 'power-of-ten' | 'one-digit' | 'off-by-one' }
  | { kind: 'unknown' };

export function classify(task: Task, result: GradeResult): ErrorClass {
  if (result.verdict !== 'incorrect') return { kind: 'unknown' };
  if (result.reason === 'wrong-dimension') return { kind: 'unit' };

  const v = result.value;
  if (!v) return { kind: 'unknown' };

  const m = task.misconceptions.find((x) => x.value.eq(v));
  if (m) return { kind: 'knowledge', misconception: m };

  const facit = task.answer.value;
  if (facit.n !== 0n && v.eq(facit.neg())) return { kind: 'careless', pattern: 'sign' };
  for (const k of [10n, 100n, 1000n]) {
    if (v.eq(facit.mul(Q.int(k))) || v.eq(facit.div(Q.int(k)))) {
      return { kind: 'careless', pattern: 'power-of-ten' };
    }
  }
  // Samma nämnare: jämför täljarna. Heltal har nämnaren 1.
  if (v.d === facit.d) {
    const diff = abs(v.n - facit.n);
    if (diff === 1n && abs(facit.n) >= 10n) return { kind: 'careless', pattern: 'off-by-one' };
    if (differsInOneDigit(v.n, facit.n)) return { kind: 'careless', pattern: 'one-digit' };
  }
  return { kind: 'unknown' };
}

function differsInOneDigit(a: bigint, b: bigint): boolean {
  if (a < 0n !== b < 0n) return false;
  const x = abs(a).toString();
  const y = abs(b).toString();
  if (x.length !== y.length || x.length < 2) return false;
  let diffs = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) diffs++;
  return diffs === 1;
}

/** Vad Samuel får se efter ett fel svar. Aldrig facit, aldrig ordet "slarvfel". */
export function feedbackFor(c: ErrorClass): string {
  switch (c.kind) {
    case 'knowledge':
      return c.misconception.feedback;
    case 'unit':
      return 'Titta på enheten. Frågar uppgiften efter en längd eller en area?';
    case 'careless':
      return 'Nästan – kontrollera din uträkning en gång till.';
    case 'unknown':
      return 'Inte riktigt. Försök igen, eller öppna en ledtråd.';
  }
}
