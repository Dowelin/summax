import { Q, gcd, lcm } from '../core/rational.ts';
import { fmt, rawFrac } from '../core/format.ts';
import type { Rng } from '../core/rng.ts';
import { check, defineTemplate, mis, misconceptions, type Template } from './types.ts';

/** T3.5 Addera och subtrahera bråk, nivå 1–4. */

const PART_NAMES: Record<number, [string, string]> = {
  2: ['halv', 'halvor'],
  3: ['tredjedel', 'tredjedelar'],
  4: ['fjärdedel', 'fjärdedelar'],
  5: ['femtedel', 'femtedelar'],
  6: ['sjättedel', 'sjättedelar'],
  7: ['sjundedel', 'sjundedelar'],
  8: ['åttondel', 'åttondelar'],
  9: ['niondel', 'niondelar'],
  10: ['tiondel', 'tiondelar'],
  11: ['elftedel', 'elftedelar'],
  12: ['tolftedel', 'tolftedelar'],
};

function parts(count: number, den: number): string {
  const names = PART_NAMES[den];
  if (!names) return `${count} st ${den}-delar`;
  return `${count} ${count === 1 ? names[0] : names[1]}`;
}

const sign = (op: '+' | '-'): string => (op === '+' ? '+' : '-');
const apply = (op: '+' | '-', x: number, y: number): number => (op === '+' ? x + y : x - y);

/** Ett äkta, förkortat bråk med nämnare i [lo, hi]. */
function properFraction(rng: Rng, lo: number, hi: number): { n: number; d: number } {
  for (;;) {
    const d = rng.int(lo, hi);
    const n = rng.int(1, d - 1);
    if (gcd(BigInt(n), BigInt(d)) === 1n) return { n, d };
  }
}

/** Visa förkortningssteget om bråket kan förkortas. */
function reduceStep(num: number, den: number): string {
  const q = Q.of(num, den);
  let s = '';
  if (gcd(BigInt(num), BigInt(den)) > 1n) s += q.isInteger() ? ` = ${q.n}` : ` = ${rawFrac(q.n, q.d)}`;
  if (!q.isInteger() && q.cmp(Q.ONE) > 0) s += ` = ${fmt(q, 'mixed')}`;
  return s;
}

// ---------------------------------------------------------------- Nivå 1

const sameDenominator = defineTemplate<{ n: number; a: number; b: number; op: '+' | '-' }>({
  id: 'T3.5-1-samma-namnare',
  skill: 'T3.5',
  area: 'brak',
  level: 1,
  title: 'Bråk med samma nämnare',
  generate(rng) {
    const n = rng.int(3, 12);
    const op = rng.pick(['+', '-'] as const);
    if (op === '+') {
      const a = rng.int(1, n - 2);
      return { n, op, a, b: rng.int(1, n - 1 - a) };
    }
    const a = rng.int(2, n - 1);
    return { n, op, a, b: rng.int(1, a - 1) };
  },
  build({ n, a, b, op }) {
    const num = apply(op, a, b);
    const facit = Q.of(num, n);
    const what = op === '+' ? 'lägger ihop' : 'tar bort';
    return {
      prompt: `Beräkna $${rawFrac(a, n)} ${sign(op)} ${rawFrac(b, n)}$`,
      work: { terms: [{ n: a, d: n }, { n: b, d: n }], ops: [op] },
      answer: { type: 'number', value: facit, accept: ['fraction', 'mixed', 'integer', 'decimal'] },
      hints: [
        `Båda bråken har nämnaren ${n}. Vad händer med nämnaren när man ${what} ${PART_NAMES[n]?.[1] ?? `${n}-delar`}?`,
        `$${rawFrac(a, n)}$ är ${parts(a, n)} och $${rawFrac(b, n)}$ är ${parts(b, n)}.`,
        `${op === '+' ? 'Addera' : 'Subtrahera'} täljarna och behåll nämnaren ${n}.`,
        `$${rawFrac(a, n)} ${sign(op)} ${rawFrac(b, n)} = ${rawFrac(num, n)}${reduceStep(num, n)}$`,
      ],
      misconceptions: misconceptions(facit, [
        op === '+'
          ? mis('adderar-namnare', () => Q.of(a + b, 2 * n), `Du har lagt ihop nämnarna också. Nämnaren säger vilken sorts delar det är – ${PART_NAMES[n]?.[1] ?? `${n}-delar`} plus ${PART_NAMES[n]?.[1] ?? `${n}-delar`} blir fortfarande ${PART_NAMES[n]?.[1] ?? `${n}-delar`}.`)
          : mis('adderar-i-stallet', () => Q.of(a + b, n), 'Du har adderat. Titta på tecknet en gång till.'),
      ]),
      facitText: fmt(facit, 'mixed'),
    };
  },
  verify: ({ n, a, b, op }) => (op === '+' ? Q.of(a, n).add(Q.of(b, n)) : Q.of(a, n).sub(Q.of(b, n))),
  constraints: ({ n, a, b, op }) => {
    const v = apply(op, a, b);
    return check({ 'svaret är positivt': v > 0, 'svaret är mindre än 1': v < n, 'nämnare 3–12': n >= 3 && n <= 12 });
  },
});

// ---------------------------------------------------------------- Nivå 2

interface TwoFractions {
  a: number;
  b: number;
  c: number;
  d: number;
  op: '+' | '-';
}

const differentDenominators = defineTemplate<TwoFractions>({
  id: 'T3.5-2-olika-namnare',
  skill: 'T3.5',
  area: 'brak',
  level: 2,
  title: 'Bråk med olika nämnare',
  generate(rng) {
    for (;;) {
      let x = properFraction(rng, 2, 12);
      let y = properFraction(rng, 2, 12);
      if (x.d === y.d || lcm(BigInt(x.d), BigInt(y.d)) > 24n) continue;
      const op = rng.pick(['+', '-'] as const);
      const cmp = Q.of(x.n, x.d).cmp(Q.of(y.n, y.d));
      if (op === '-' && cmp === 0) continue;
      if (op === '-' && cmp < 0) [x, y] = [y, x];
      const r = Q.of(x.n, x.d)[op === '+' ? 'add' : 'sub'](Q.of(y.n, y.d));
      if (r.isInteger()) continue;
      return { a: x.n, b: x.d, c: y.n, d: y.d, op };
    }
  },
  build({ a, b, c, d, op }) {
    const L = Number(lcm(BigInt(b), BigInt(d)));
    const a2 = (a * L) / b;
    const c2 = (c * L) / d;
    const num = apply(op, a2, c2);
    const facit = Q.of(num, L);
    const expand = (n: number, dd: number, n2: number): string =>
      dd === L ? `$${rawFrac(n, dd)}$ har redan nämnaren ${L}` : `$${rawFrac(n, dd)} = ${rawFrac(n2, L)}$`;
    return {
      prompt: `Beräkna $${rawFrac(a, b)} ${sign(op)} ${rawFrac(c, d)}$`,
      work: { terms: [{ n: a, d: b }, { n: c, d: d }], ops: [op] },
      instruction: 'Svara i enklaste form.',
      answer: { type: 'number', value: facit, accept: ['fraction', 'mixed', 'integer'], requireReduced: true },
      hints: [
        'Nämnarna är olika. Bråken behöver först få samma nämnare.',
        `Den minsta gemensamma nämnaren för ${b} och ${d} är ${L}.`,
        `Förläng: ${expand(a, b, a2)}, och ${expand(c, d, c2)}. ${op === '+' ? 'Addera' : 'Subtrahera'} sedan täljarna.`,
        `$${rawFrac(a2, L)} ${sign(op)} ${rawFrac(c2, L)} = ${rawFrac(num, L)}${reduceStep(num, L)}$`,
      ],
      misconceptions: misconceptions(facit, [
        mis('raknar-tvars', () => Q.of(apply(op, a, c), apply(op, b, d)), `Du har ${op === '+' ? 'adderat' : 'subtraherat'} både täljare och nämnare. Bråken måste ha samma nämnare innan man räknar med täljarna.`),
        mis('glomt-forlanga', () => Q.of(apply(op, a, c), L), `Du har bytt till nämnaren ${L} men inte förlängt täljarna. Täljaren ska multipliceras med samma tal som nämnaren.`),
        mis('multiplicerat-namnare', () => Q.of(apply(op, a, c), b * d), 'Du har multiplicerat nämnarna men inte förlängt täljarna. Täljaren ska multipliceras med samma tal som nämnaren.'),
      ]),
      facitText: fmt(facit, 'mixed'),
    };
  },
  verify: ({ a, b, c, d, op }) => (op === '+' ? Q.of(a, b).add(Q.of(c, d)) : Q.of(a, b).sub(Q.of(c, d))),
  constraints: ({ a, b, c, d, op }) => {
    const r = op === '+' ? Q.of(a, b).add(Q.of(c, d)) : Q.of(a, b).sub(Q.of(c, d));
    return check({
      'olika nämnare': b !== d,
      'gemensam nämnare högst 24': lcm(BigInt(b), BigInt(d)) <= 24n,
      'svaret positivt': !r.isNegative() && r.n !== 0n,
      'svaret inte ett heltal': !r.isInteger(),
    });
  },
});

// ---------------------------------------------------------------- Nivå 3

const NAMES = ['Ella', 'Omar', 'Saga', 'Leo', 'Maja', 'Noah', 'Alva', 'Elias'] as const;

interface StoryParams {
  variant: 'tank' | 'bok';
  name: string;
  p: number;
  q: number;
  r: number;
  s: number;
}

const storyFacit = ({ variant, p, q, r, s }: StoryParams): Q =>
  variant === 'tank' ? Q.of(p * s - r * q, q * s) : Q.of(q * s - p * s - r * q, q * s);

const fractionStory = defineTemplate<StoryParams>({
  id: 'T3.5-3-textuppgift',
  skill: 'T3.5',
  area: 'brak',
  level: 3,
  title: 'Bråk i textuppgift',
  generate(rng) {
    const variant = rng.pick(['tank', 'bok'] as const);
    const name = rng.pick(NAMES);
    for (;;) {
      const x = properFraction(rng, 2, 12);
      const y = properFraction(rng, 2, 12);
      if (x.d === y.d || lcm(BigInt(x.d), BigInt(y.d)) > 24n) continue;
      const params = { variant, name, p: x.n, q: x.d, r: y.n, s: y.d };
      const f = storyFacit(params);
      if (f.isNegative() || f.n === 0n) continue;
      return params;
    }
  },
  build(params) {
    const { variant, name, p, q, r, s } = params;
    const facit = storyFacit(params);
    const L = Number(lcm(BigInt(q), BigInt(s)));
    const P = (p * L) / q;
    const R = (r * L) / s;
    if (variant === 'tank') {
      return {
        prompt: `En vattentank är $${rawFrac(p, q)}$ full. Man tappar ur $${rawFrac(r, s)}$ av hela tanken. Hur stor del av tanken är full nu?`,
        instruction: 'Svara i bråkform, i enklaste form.',
        answer: { type: 'number', value: facit, accept: ['fraction'], requireReduced: true },
        hints: [
          'Rita en tank och dela in den. Vilka två bråk ska räknas ihop, och med vilket räknesätt?',
          `Det som är kvar är $${rawFrac(p, q)} - ${rawFrac(r, s)}$. Båda bråken är delar av hela tanken.`,
          `Skriv båda bråken med nämnaren ${L}: $${rawFrac(P, L)}$ och $${rawFrac(R, L)}$.`,
          `$${rawFrac(p, q)} - ${rawFrac(r, s)} = ${rawFrac(P, L)} - ${rawFrac(R, L)} = ${rawFrac(P - R, L)}${reduceStep(P - R, L)}$`,
        ],
        misconceptions: misconceptions(facit, [
          mis('del-av-delen', () => Q.of(p, q).mul(Q.ONE.sub(Q.of(r, s))), `Du har räknat bort $${rawFrac(r, s)}$ av det vatten som fanns. Läs igen: det är $${rawFrac(r, s)}$ av hela tanken som tappas ur.`),
          mis('raknar-tvars', () => Q.of(p - r, q - s), 'Du har subtraherat både täljare och nämnare. Bråken måste ha samma nämnare först.'),
          mis('glomt-forlanga', () => Q.of(p - r, L), `Du har bytt till nämnaren ${L} men inte förlängt täljarna.`),
          mis('adderat', () => Q.of(p, q).add(Q.of(r, s)), 'Du har adderat. Blir det mer eller mindre vatten när man tappar ur?'),
        ]),
        facitText: fmt(facit, 'fraction'),
      };
    }
    const read = P + R;
    return {
      prompt: `${name} läser $${rawFrac(p, q)}$ av en bok på måndagen och $${rawFrac(r, s)}$ av boken på tisdagen. Hur stor del av boken har ${name} kvar att läsa?`,
      instruction: 'Svara i bråkform, i enklaste form.',
      answer: { type: 'number', value: facit, accept: ['fraction'], requireReduced: true },
      hints: [
        'Börja med att räkna ut hur stor del som är läst. Hur stor är hela boken som bråk?',
        `Läst: $${rawFrac(p, q)} + ${rawFrac(r, s)}$. Hela boken är $1 = ${rawFrac(L, L)}$.`,
        `Med nämnaren ${L}: läst är $${rawFrac(P, L)} + ${rawFrac(R, L)} = ${rawFrac(read, L)}$. Ta sedan bort det från hela boken.`,
        `$${rawFrac(L, L)} - ${rawFrac(read, L)} = ${rawFrac(L - read, L)}${reduceStep(L - read, L)}$`,
      ],
      misconceptions: misconceptions(facit, [
        mis('svarat-last', () => Q.of(p, q).add(Q.of(r, s)), `Du har räknat ut hur mycket ${name} har läst. Frågan gäller hur mycket som är kvar.`),
        mis('raknar-tvars', () => Q.ONE.sub(Q.of(p + r, q + s)), 'Du har adderat både täljare och nämnare. Bråken måste ha samma nämnare först.'),
      ]),
      facitText: fmt(facit, 'fraction'),
    };
  },
  verify: ({ variant, p, q, r, s }) =>
    variant === 'tank' ? Q.of(p, q).sub(Q.of(r, s)) : Q.ONE.sub(Q.of(p, q)).sub(Q.of(r, s)),
  constraints: (params) => {
    const f = storyFacit(params);
    return check({
      'svaret positivt': !f.isNegative() && f.n !== 0n,
      'svaret mindre än 1': f.cmp(Q.ONE) < 0,
      'gemensam nämnare högst 24': lcm(BigInt(params.q), BigInt(params.s)) <= 24n,
    });
  },
});

// ---------------------------------------------------------------- Nivå 4

interface MissingTerm {
  a: number;
  b: number;
  w: number;
  c: number;
  d: number;
}

const missingTerm = defineTemplate<MissingTerm>({
  id: 'T3.5-4-saknad-term',
  skill: 'T3.5',
  area: 'brak',
  level: 4,
  title: 'Den saknade termen',
  generate(rng) {
    for (;;) {
      const x = properFraction(rng, 2, 12);
      const y = properFraction(rng, 2, 12);
      const w = rng.int(1, 2);
      if (x.d === y.d || lcm(BigInt(x.d), BigInt(y.d)) > 24n) continue;
      const f = Q.of(w * y.d + y.n, y.d).sub(Q.of(x.n, x.d));
      if (f.isInteger() || f.isNegative()) continue;
      return { a: x.n, b: x.d, w, c: y.n, d: y.d };
    }
  },
  build({ a, b, w, c, d }) {
    const L = Number(lcm(BigInt(b), BigInt(d)));
    const T = ((w * d + c) * L) / d; // summan som L-delar
    const A = (a * L) / b;
    const facit = Q.of(T - A, L);
    return {
      prompt: `Vilket bråk ska läggas till $${rawFrac(a, b)}$ för att summan ska bli $${w}${rawFrac(c, d)}$?`,
      instruction: 'Svara i enklaste form.',
      answer: { type: 'number', value: facit, accept: ['fraction', 'mixed'], requireReduced: true },
      hints: [
        'Om summan är känd och en term saknas – vilket räknesätt ger den saknade termen?',
        `Den saknade termen är $${w}${rawFrac(c, d)} - ${rawFrac(a, b)}$.`,
        `Skriv om till nämnaren ${L}: $${w}${rawFrac(c, d)} = ${rawFrac(T, L)}$ och $${rawFrac(a, b)} = ${rawFrac(A, L)}$.`,
        `$${rawFrac(T, L)} - ${rawFrac(A, L)} = ${rawFrac(T - A, L)}${reduceStep(T - A, L)}$. Kontroll: $${rawFrac(a, b)} + ${fmt(facit, 'mixed')} = ${w}${rawFrac(c, d)}$`,
      ],
      misconceptions: misconceptions(facit, [
        mis('adderat', () => Q.of(w * d + c, d).add(Q.of(a, b)), 'Du har adderat. Summan är redan given – det som saknas är en av termerna.'),
        mis('glomt-heltal', () => Q.of(c, d).sub(Q.of(a, b)), `Glöm inte heltalet ${w} i summan.`),
        Q.of(c, d).cmp(Q.of(a, b)) < 0
          ? mis('omvand-subtraktion', () => Q.int(w).add(Q.of(a, b).sub(Q.of(c, d))), `Du har räknat $${rawFrac(a, b)} - ${rawFrac(c, d)}$ i bråkdelen. När bråkdelen i summan är mindre behöver du först växla ett heltal till bråk.`)
          : null,
      ]),
      facitText: fmt(facit, 'mixed'),
    };
  },
  verify: ({ a, b, w, c, d }) => Q.int(w).add(Q.of(c, d)).sub(Q.of(a, b)),
  constraints: ({ a, b, w, c, d }) => {
    const f = Q.int(w).add(Q.of(c, d)).sub(Q.of(a, b));
    return check({ 'svaret positivt': !f.isNegative() && f.n !== 0n, 'svaret inte ett heltal': !f.isInteger() });
  },
});

export const fractionTemplates: Template[] = [sameDenominator, differentDenominators, fractionStory, missingTerm];
