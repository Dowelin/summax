/**
 * Översätter det MathLive-fältet ger (LaTeX) till den enkla textform som
 * svarstolkningen och räkneraderna läser: \frac{3}{4} → 3/4.
 *
 * Blandad form (1\frac{1}{2}) skrivs olika beroende på användning:
 *   'answer'   → "1 1/2"      så att rättningen ser att det är blandad form
 *   'equation' → "(1+1/2)"    så att ekvationstolken inte läser det som 1 · 1/2
 *
 * Okända kommandon lämnas kvar, så att tolkarna säger "kan inte läsa"
 * i stället för att något tyst försvinner.
 */

export type Mode = 'answer' | 'equation';

const SPACES = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'enspace', 'thinspace']);
const SYMBOLS: Record<string, string> = {
  cdot: '·',
  times: '·',
  div: ':',
  '%': '%',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  lt: '<',
  gt: '>',
  minus: '-',
  pi: 'π',
  degree: '°',
  circ: '°',
};
const WRAPPERS = new Set(['mathrm', 'text', 'textrm', 'mathit', 'mathbf', 'operatorname', 'mathord', 'mathbin', 'mathrel', 'mathnormal', 'textit', 'textbf', 'displaystyle', 'textstyle']);
const DROP = new Set(['left', 'right', 'displaystyle', 'textstyle', 'mleft', 'mright', 'bigl', 'bigr', 'Bigl', 'Bigr']);

export function latexToPlain(latex: string, mode: Mode = 'answer'): string {
  const r = new Reader(latex, mode);
  return r.read().replace(/\s+/g, ' ').trim();
}

/** Innehåller fältet tomma platser (t.ex. en nämnare som inte fyllts i)? */
export function hasPlaceholder(latex: string): boolean {
  return /\\placeholder|\{\s*\}/.test(latex.replace(/\\frac\{\s*\}\{\s*\}/g, '\\placeholder'));
}

class Reader {
  private i = 0;
  private readonly s: string;
  private readonly mode: Mode;

  constructor(s: string, mode: Mode) {
    this.s = s;
    this.mode = mode;
  }

  read(stopAt?: string): string {
    let out = '';
    while (this.i < this.s.length) {
      const ch = this.s[this.i]!;
      if (stopAt && ch === stopAt) return out;
      if (ch === '{') {
        // {,} är MathLives decimalkomma
        if (this.s.startsWith('{,}', this.i)) {
          out += ',';
          this.i += 3;
          continue;
        }
        out += this.group();
        continue;
      }
      if (ch === '}') {
        this.i++;
        continue;
      }
      if (ch === '\\') {
        out = this.command(out);
        continue;
      }
      if (ch === '^') {
        this.i++;
        out += '^' + this.arg();
        continue;
      }
      if (ch === '_') {
        this.i++;
        this.arg();
        continue;
      }
      if (ch === '~') {
        out += ' ';
        this.i++;
        continue;
      }
      out += ch;
      this.i++;
    }
    return out;
  }

  /** Läser {…} och returnerar innehållet. */
  private group(): string {
    this.i++; // {
    const inner = this.read('}');
    this.i++; // }
    return inner;
  }

  /** Ett argument: {…}, ett kommando eller ett enda tecken (\frac12). */
  private arg(): string {
    while (this.s[this.i] === ' ') this.i++;
    const ch = this.s[this.i];
    if (ch === undefined) return '';
    if (ch === '{') return this.group();
    if (ch === '\\') return this.command('');
    this.i++;
    return ch;
  }

  private command(out: string): string {
    this.i++; // backslash
    const m = /^([a-zA-Z]+|.)/.exec(this.s.slice(this.i));
    const name = m ? m[1]! : '';
    this.i += name.length;
    // Mellanslag efter ett kommandonamn (\cdot x) avslutar bara namnet.
    if (/^[a-zA-Z]+$/.test(name)) while (this.s[this.i] === ' ') this.i++;

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      const num = this.arg().trim();
      const den = this.arg().trim();
      return this.appendFraction(out, num, den);
    }
    if (name === 'placeholder') {
      this.arg();
      return out;
    }
    if (name === 'sqrt') return `${out}√(${this.arg()})`;
    if (WRAPPERS.has(name)) return out + this.arg();
    if (DROP.has(name)) return out;
    if (SPACES.has(name)) return `${out} `;
    if (name in SYMBOLS) return out + SYMBOLS[name]!;
    if (name === '{' || name === '}') return out;
    // Okänt kommando: lämna kvar så att tolken avvisar det.
    return `${out}\\${name}`;
  }

  private appendFraction(out: string, num: string, den: string): string {
    const simple = (t: string): boolean => /^\d+$/.test(t);
    const fraction = simple(num) && simple(den) ? `${num}/${den}` : `(${num})/(${den})`;

    // Blandad form: heltalssiffror direkt före bråket.
    const whole = /(^|[^\d,.\s])\s*(\d+)(\s*)$/.exec(out);
    if (whole && simple(num) && simple(den)) {
      out = out.slice(0, out.length - whole[3]!.length);
      const start = out.length - whole[2]!.length;
      const before = out.slice(0, start);
      if (this.mode === 'answer') return `${before}${whole[2]} ${fraction}`;
      return `${before}(${whole[2]}+${fraction})`;
    }
    return out + fraction;
  }
}
