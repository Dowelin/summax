import { Q } from './rational.ts';

/**
 * Exakt tolkning av linjära uttryck och ekvationer i x, med bråktal.
 * Används för räkneraderna: en rad är korrekt om den har samma lösning
 * som uppgiftens ekvation. För linjära ekvationer kan det avgöras säkert.
 *
 * Ett uttryck blir a·x + b. Allt som inte är linjärt (x·x, division med x,
 * x²) avvisas med ett tydligt meddelande i stället för att gissas.
 */

export interface Linear {
  a: Q; // koefficient för x
  b: Q; // konstant
}

export class LinearError extends Error {}

type Tok =
  | { t: 'num'; v: Q }
  | { t: 'x' }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | '^' }
  | { t: '(' }
  | { t: ')' };

export function tokenize(src: string): Tok[] {
  const s = src
    .replace(/[−–—]/g, '-')
    .replace(/[·×⋅]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[   ]/g, ' ')
    .toLowerCase();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;
    if (ch === ' ') {
      i++;
      continue;
    }
    const num = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (num) {
      const [w, f = ''] = num[0].replace(',', '.').split('.') as [string, string?];
      out.push({ t: 'num', v: Q.of(BigInt(w + f), 10n ** BigInt(f.length)) });
      i += num[0].length;
      continue;
    }
    if (ch === 'x') out.push({ t: 'x' });
    else if (ch === '(' || ch === '[') out.push({ t: '(' });
    else if (ch === ')' || ch === ']') out.push({ t: ')' });
    else if ('+-*/^'.includes(ch)) out.push({ t: 'op', v: ch as '+' });
    else if (/[a-zåäö]/.test(ch)) throw new LinearError(`Bara x kan vara obekant, inte ${ch}.`);
    else throw new LinearError(`Tecknet ${ch} kan jag inte läsa.`);
    i++;
  }
  return out;
}

const lin = (a: Q, b: Q): Linear => ({ a, b });
const isConst = (e: Linear): boolean => e.a.n === 0n;

class Parser {
  private i = 0;
  private readonly toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  parseAll(): Linear {
    if (this.toks.length === 0) throw new LinearError('Ena sidan är tom.');
    const e = this.expr();
    if (this.i < this.toks.length) throw new LinearError('Uttrycket är inte färdigskrivet.');
    return e;
  }

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }

  private expr(): Linear {
    let left = this.term();
    for (;;) {
      const t = this.peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) {
        this.i++;
        const right = this.term();
        left = t.v === '+' ? lin(left.a.add(right.a), left.b.add(right.b)) : lin(left.a.sub(right.a), left.b.sub(right.b));
      } else return left;
    }
  }

  private term(): Linear {
    let left = this.unary();
    for (;;) {
      const t = this.peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) {
        this.i++;
        const right = this.unary();
        left = t.v === '*' ? mul(left, right) : div(left, right);
      } else if (t && (t.t === 'num' || t.t === 'x' || t.t === '(')) {
        // Underförstådd multiplikation: 3x, 2(x + 1), (x + 1)(2)
        left = mul(left, this.power());
      } else return left;
    }
  }

  private unary(): Linear {
    const t = this.peek();
    if (t?.t === 'op' && (t.v === '-' || t.v === '+')) {
      this.i++;
      const e = this.unary();
      return t.v === '-' ? lin(e.a.neg(), e.b.neg()) : e;
    }
    return this.power();
  }

  private power(): Linear {
    const base = this.primary();
    const t = this.peek();
    if (t?.t === 'op' && t.v === '^') {
      this.i++;
      const ex = this.peek();
      if (ex?.t !== 'num' || !ex.v.isInteger() || ex.v.n < 0n || ex.v.n > 12n) {
        throw new LinearError('Exponenten måste vara ett litet heltal.');
      }
      this.i++;
      const n = Number(ex.v.n);
      if (n === 1) return base;
      if (n === 0) return lin(Q.ZERO, Q.ONE);
      if (!isConst(base)) throw new LinearError('Ekvationer med x² kan jag inte kontrollera än.');
      let v = Q.ONE;
      for (let k = 0; k < n; k++) v = v.mul(base.b);
      return lin(Q.ZERO, v);
    }
    return base;
  }

  private primary(): Linear {
    const t = this.peek();
    if (!t) throw new LinearError('Uttrycket är inte färdigskrivet.');
    this.i++;
    if (t.t === 'num') return lin(Q.ZERO, t.v);
    if (t.t === 'x') return lin(Q.ONE, Q.ZERO);
    if (t.t === '(') {
      const e = this.expr();
      if (this.peek()?.t !== ')') throw new LinearError('En parentes är inte stängd.');
      this.i++;
      return e;
    }
    throw new LinearError('Uttrycket är inte färdigskrivet.');
  }
}

function mul(p: Linear, q: Linear): Linear {
  if (!isConst(p) && !isConst(q)) throw new LinearError('Ekvationer med x · x kan jag inte kontrollera än.');
  if (isConst(p)) return lin(q.a.mul(p.b), q.b.mul(p.b));
  return lin(p.a.mul(q.b), p.b.mul(q.b));
}

function div(p: Linear, q: Linear): Linear {
  if (!isConst(q)) throw new LinearError('Division med x kan jag inte kontrollera än.');
  if (q.b.n === 0n) throw new LinearError('Division med 0 går inte.');
  return lin(p.a.div(q.b), p.b.div(q.b));
}

export function parseLinear(src: string): Linear {
  return new Parser(tokenize(src)).parseAll();
}

export type Solutions = { kind: 'one'; x: Q } | { kind: 'all' } | { kind: 'none' };

export interface ParsedEquation {
  left: Linear;
  right: Linear;
  /** Råtexten på varje sida, för att kunna rätta svarsformen. */
  leftText: string;
  rightText: string;
}

export function parseEquation(src: string): ParsedEquation {
  const parts = src.split('=');
  if (parts.length !== 2) throw new LinearError(parts.length < 2 ? 'Raden saknar likhetstecken.' : 'Skriv bara ett likhetstecken per rad.');
  const [l, r] = parts as [string, string];
  return { left: parseLinear(l), right: parseLinear(r), leftText: l.trim(), rightText: r.trim() };
}

export function solve(eq: { left: Linear; right: Linear }): Solutions {
  const a = eq.left.a.sub(eq.right.a);
  const b = eq.right.b.sub(eq.left.b);
  if (a.n !== 0n) return { kind: 'one', x: b.div(a) };
  return b.n === 0n ? { kind: 'all' } : { kind: 'none' };
}
