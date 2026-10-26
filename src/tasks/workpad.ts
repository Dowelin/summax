import { LinearError, parseEquation, parseLinear, solve } from '../core/linear.ts';
import type { Q } from '../core/rational.ts';

/**
 * Räknerader för ekvationsuppgifter. Varje rad Samuel skriver bedöms för sig:
 *
 * - En ekvation som har samma lösning som uppgiften: raden stämmer.
 * - En ekvation med en annan lösning (eller ingen, eller alla x): raden stämmer inte.
 * - "x = tal", "tal = x" eller bara ett tal: det är hans svar, som rättas som vanligt.
 *
 * Bedömningen är exakt eftersom alla ekvationer i åk 6–9 som appen ger är linjära.
 */

export type LineResult =
  | { kind: 'empty' }
  | { kind: 'step-ok' }
  | { kind: 'step-wrong'; message: string }
  | { kind: 'answer'; text: string }
  | { kind: 'unreadable'; message: string };

// ------------------------------------------------------------ Uträkningsrader

/**
 * Uträkningsrader för uppgifter utan x (bråk, procent, geometri).
 * Samuel räknar som på papper: 4/5 − 1/4 = 16/20 − 5/20 = 11/20.
 * Varje likhetstecken kontrolleras exakt: båda sidor ska ha samma värde.
 * En rad som börjar med = fortsätter från förra raden.
 * Svaret skrivs på svarsraden och rättas där, inte här.
 */
export type CalcResult =
  | { kind: 'empty' }
  | { kind: 'ok'; last: string }
  | { kind: 'noted'; last: string }
  | { kind: 'wrong'; message: string; last: string }
  | { kind: 'unreadable'; message: string };

/** Enheter och procent skrivs om så att raden blir ren aritmetik. */
export function toArithmetic(plain: string): string {
  return plain
    .replace(/(\d|\))\s*(?:mm|cm|dm|km|m)(?:\s?\^?\s?2|²)?(?![a-zåäö])/gi, '$1')
    .replace(/(\d|\))\s*(?:kronor|kr\.?)(?![a-zåäö])/gi, '$1')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:%|procent)/gi, '($1/100)')
    .replace(/\bav\b/gi, '·');
}

export function checkCalcLine(plain: string, previousLast?: string): CalcResult {
  let s = plain.trim();
  if (s === '') return { kind: 'empty' };
  if (s.startsWith('=')) {
    if (!previousLast) return { kind: 'unreadable', message: 'Raden börjar med = men det finns ingen rad ovanför.' };
    s = `${previousLast} ${s}`;
  }
  const parts = s.split('=').map((p) => p.trim());
  if (parts.some((p) => p === '')) return { kind: 'unreadable', message: 'Någon sida av ett likhetstecken är tom.' };
  const last = parts[parts.length - 1]!;

  try {
    const values = parts.map((p) => {
      const e = parseLinear(toArithmetic(p));
      if (e.a.n !== 0n) throw new LinearError('Här finns inget x att räkna med.');
      return e.b;
    });
    if (values.length === 1) return { kind: 'noted', last };
    for (let i = 1; i < values.length; i++) {
      if (!values[i]!.eq(values[i - 1]!)) {
        const where = values.length > 2 ? ` (likhetstecken nummer ${i})` : '';
        return { kind: 'wrong', message: `Det här likhetstecknet stämmer inte${where}: sidorna har olika värde.`, last };
      }
    }
    return { kind: 'ok', last };
  } catch (e) {
    if (e instanceof LinearError) return { kind: 'unreadable', message: e.message };
    throw e;
  }
}

/** Notationen från uppgiftstexten ({a/b}, 2{1/3}) som text för uträkningsraderna. */
export function markupToPlain(markup: string): string {
  return markup
    .replace(/(\d+)\{(\d+)\/(\d+)\}/g, '($1+$2/$3)')
    .replace(/\{([^{}/]+)\/([^{}]+)\}/g, '($1)/($2)')
    .replace(/[ ]/g, '');
}

// ------------------------------------------------------------ Ekvationsrader

export function checkLine(plain: string, facit: Q): LineResult {
  const s = plain.trim();
  if (s === '') return { kind: 'empty' };

  try {
    if (!s.includes('=')) {
      const e = parseLinear(s);
      if (e.a.n === 0n) return { kind: 'answer', text: s };
      return { kind: 'unreadable', message: 'Skriv en hel ekvation, med likhetstecken.' };
    }

    const eq = parseEquation(s);
    const loneX = (t: string): boolean => /^x$/i.test(t.replace(/\s/g, ''));
    if (loneX(eq.leftText) && eq.right.a.n === 0n) return { kind: 'answer', text: eq.rightText };
    if (loneX(eq.rightText) && eq.left.a.n === 0n) return { kind: 'answer', text: eq.leftText };

    const sol = solve(eq);
    if (sol.kind === 'one' && sol.x.eq(facit)) return { kind: 'step-ok' };
    if (sol.kind === 'all') {
      return { kind: 'step-wrong', message: 'Den här raden gäller för alla x. Någonstans har x försvunnit.' };
    }
    if (sol.kind === 'none') {
      return { kind: 'step-wrong', message: 'Den här raden kan inte stämma för något x. Kontrollera steget.' };
    }
    return { kind: 'step-wrong', message: 'Den här raden har en annan lösning än ekvationen ovanför. Kontrollera steget.' };
  } catch (e) {
    if (e instanceof LinearError) return { kind: 'unreadable', message: e.message };
    throw e;
  }
}
