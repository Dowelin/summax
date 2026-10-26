import { Q } from '../core/rational.ts';
import { fmt, rawFrac } from '../core/format.ts';
import { check, defineTemplate, mis, misconceptions, type Template } from './types.ts';

/** A2.1 Ekvationer i ett steg, A2.2 i två steg, A2.3 från text. */

const SOLUTION = { type: 'solution', variable: 'x', accept: ['integer', 'fraction', 'mixed', 'decimal'] } as const;

// ---------------------------------------------------------------- A2.1, nivå 1

type OneStepKind = 'add' | 'sub' | 'mul' | 'div';
interface OneStep {
  kind: OneStepKind;
  a: number;
  x: number;
}

function oneStepRhs({ kind, a, x }: OneStep): number {
  switch (kind) {
    case 'add':
      return x + a;
    case 'sub':
      return x - a;
    case 'mul':
      return a * x;
    case 'div':
      return x / a;
  }
}

const oneStep = defineTemplate<OneStep>({
  id: 'A2.1-1-ett-steg',
  skill: 'A2.1',
  area: 'ekvationer',
  level: 1,
  title: 'Ekvationer i ett steg',
  generate(rng) {
    const kind = rng.pick(['add', 'sub', 'mul', 'div'] as const);
    switch (kind) {
      case 'add':
        return { kind, a: rng.int(2, 40), x: rng.int(2, 40) };
      case 'sub': {
        const a = rng.int(2, 40);
        return { kind, a, x: a + rng.int(1, 40) };
      }
      case 'mul':
        return { kind, a: rng.int(2, 12), x: rng.int(2, 12) };
      case 'div': {
        const a = rng.int(2, 10);
        return { kind, a, x: a * rng.int(2, 12) };
      }
    }
  },
  build(p) {
    const { kind, a, x } = p;
    const b = oneStepRhs(p);
    const facit = Q.int(x);
    const lhs = { add: `x + ${a}`, sub: `x - ${a}`, mul: `${a}x`, div: `{x/${a}}` }[kind];
    const undo = {
      add: [`subtrahera ${a}`, `x + ${a} - ${a} = ${b} - ${a}`],
      sub: [`addera ${a}`, `x - ${a} + ${a} = ${b} + ${a}`],
      mul: [`dividera med ${a}`, `{${a}x/${a}} = {${b}/${a}}`],
      div: [`multiplicera med ${a}`, `{x/${a}} · ${a} = ${b} · ${a}`],
    }[kind];
    const wrong = {
      add: mis('fel-raknesatt', () => Q.int(b + a), `Du har adderat ${a}. För att ta bort $+ ${a}$ ska du göra tvärtom.`),
      sub: mis('fel-raknesatt', () => Q.int(b - a), `Du har subtraherat ${a}. För att ta bort $- ${a}$ ska du göra tvärtom.`),
      mul: mis('subtraherat', () => Q.int(b - a), `$${a}x$ betyder $${a} · x$. Hur tar man bort "gånger ${a}"?`),
      div: mis('dividerat', () => Q.of(b, a), `Du har dividerat. $x$ delat med ${a} är ${b} – då måste $x$ vara större än ${b}.`),
    }[kind];
    return {
      prompt: `Lös ekvationen $${lhs} = ${b}$`,
      answer: { ...SOLUTION, value: facit },
      hints: [
        `Vilket tal ska $x$ vara för att vänster led ska bli ${b}?`,
        `Gör samma sak på båda sidor så att $x$ blir ensamt: ${undo[0]}.`,
        `$${undo[1]}$`,
        `$x = ${x}$. Kontroll: $${{ add: `${x} + ${a}`, sub: `${x} - ${a}`, mul: `${a} · ${x}`, div: `{${x}/${a}}` }[kind]} = ${b}$ stämmer.`,
      ],
      misconceptions: misconceptions(facit, [wrong]),
      facitText: `x = ${x}`,
    };
  },
  verify: (p) => {
    const b = Q.int(oneStepRhs(p));
    const a = Q.int(p.a);
    return { add: b.sub(a), sub: b.add(a), mul: b.div(a), div: b.mul(a) }[p.kind];
  },
  constraints: (p) => check({ 'lösningen är ett positivt heltal': p.x > 0, 'högerledet är positivt': oneStepRhs(p) > 0 }),
});

// ---------------------------------------------------------------- A2.2, nivå 2

interface TwoStep {
  a: number;
  b: number;
  x: number;
  flip: boolean;
}

const twoStep = defineTemplate<TwoStep>({
  id: 'A2.2-2-tva-steg',
  skill: 'A2.2',
  area: 'ekvationer',
  level: 2,
  title: 'Ekvationer i två steg',
  generate: (rng) => ({ a: rng.int(2, 9), b: rng.int(1, 30), x: rng.int(1, 12), flip: rng.next() < 0.25 }),
  build({ a, b, x, flip }) {
    const c = a * x + b;
    const facit = Q.int(x);
    const eq = flip ? `${c} = ${a}x + ${b}` : `${a}x + ${b} = ${c}`;
    return {
      prompt: `Lös ekvationen $${eq}$`,
      answer: { ...SOLUTION, value: facit },
      hints: [
        `Två saker har hänt med $x$: först gånger ${a}, sedan plus ${b}. Ta bort dem i omvänd ordning.`,
        `Subtrahera ${b} på båda sidor: $${a}x = ${c} - ${b} = ${c - b}$.`,
        `Dividera båda sidor med ${a}: $x = {${c - b}/${a}}$.`,
        `$${a}x + ${b} = ${c}$, $${a}x = ${c - b}$, $x = ${x}$. Kontroll: $${a} · ${x} + ${b} = ${c}$.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('fel-tecken', () => Q.of(c + b, a), `Du har lagt till ${b}. För att ta bort $+ ${b}$ ska du subtrahera.`),
        mis('fel-ordning', () => Q.of(c, a).sub(Q.int(b)), `Du har dividerat först. Då måste hela vänster led divideras, även ${b}. Ta bort $+ ${b}$ först.`),
        mis('glomt-dividera', () => Q.int(c - b), `Du har fått fram $${a}x = ${c - b}$. Ett steg kvar: $x$ ska stå ensamt.`),
      ]),
      facitText: `x = ${x}`,
    };
  },
  verify: ({ a, b, x }) => Q.int(a * x + b).sub(Q.int(b)).div(Q.int(a)),
  constraints: ({ a, x }) => check({ 'lösningen är ett positivt heltal': x > 0, 'koefficienten minst 2': a >= 2 }),
});

// ---------------------------------------------------------------- A2.2, nivå 3

interface Paren {
  a: number;
  b: number;
  x: number;
}

const parenthesis = defineTemplate<Paren>({
  id: 'A2.2-3-parentes',
  skill: 'A2.2',
  area: 'ekvationer',
  level: 3,
  title: 'Ekvationer med parentes',
  generate: (rng) => ({ a: rng.int(2, 9), b: rng.int(1, 12), x: rng.int(1, 15) }),
  build({ a, b, x }) {
    const c = a * (x + b);
    const facit = Q.int(x);
    return {
      prompt: `Lös ekvationen $${a}(x + ${b}) = ${c}$`,
      answer: { ...SOLUTION, value: facit },
      hints: [
        `Parentesen multipliceras med ${a}. Vad måste parentesen vara värd?`,
        `Dividera båda sidor med ${a}: $x + ${b} = {${c}/${a}} = ${x + b}$.`,
        `Subtrahera ${b} på båda sidor. (Det går också att multiplicera in ${a} först: $${a}x + ${a * b} = ${c}$.)`,
        `$x + ${b} = ${x + b}$, alltså $x = ${x}$. Kontroll: $${a}(${x} + ${b}) = ${a} · ${x + b} = ${c}$.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('fel-tecken', () => Q.of(c, a).add(Q.int(b)), `Du har lagt till ${b}. För att ta bort $+ ${b}$ ska du subtrahera.`),
        mis('bara-forsta-termen', () => Q.of(c - b, a), `${a} multipliceras med hela parentesen, även med ${b}.`),
        mis('glomt-b', () => Q.of(c, a), `Du har fått fram vad parentesen är värd, $x + ${b}$. Ett steg kvar.`),
      ]),
      facitText: `x = ${x}`,
    };
  },
  verify: ({ a, b, x }) => Q.int(a * (x + b)).div(Q.int(a)).sub(Q.int(b)),
  constraints: ({ x }) => check({ 'lösningen är ett positivt heltal': x > 0 }),
});

interface Riddle {
  a: number;
  b: number;
  x: number;
  op: '+' | '-';
}

const thinkOfNumber = defineTemplate<Riddle>({
  id: 'A2.3-3-tanker-pa-ett-tal',
  skill: 'A2.3',
  area: 'ekvationer',
  level: 3,
  title: 'Jag tänker på ett tal',
  generate(rng) {
    const a = rng.int(2, 9);
    const op = rng.pick(['+', '-'] as const);
    const x = rng.int(3, 20);
    const b = op === '+' ? rng.int(1, 40) : rng.int(1, a * x - 1);
    return { a, b, x, op };
  },
  build({ a, b, x, op }) {
    const c = op === '+' ? a * x + b : a * x - b;
    const facit = Q.int(x);
    const verb = op === '+' ? `lägger till ${b}` : `drar bort ${b}`;
    const back = op === '+' ? `${c} - ${b}` : `${c} + ${b}`;
    const ax = op === '+' ? c - b : c + b;
    return {
      prompt: `Jag tänker på ett tal. Om jag multiplicerar talet med ${a} och sedan ${verb}, så får jag ${c}. Vilket tal tänker jag på?`,
      answer: { type: 'number', value: facit, accept: ['integer'] },
      hints: [
        'Kalla talet för $x$ och skriv texten som en ekvation.',
        `Ekvationen är $${a}x ${op} ${b} = ${c}$.`,
        `Arbeta baklänges: ${op === '+' ? `dra bort ${b}` : `lägg tillbaka ${b}`}, dela sedan med ${a}.`,
        `$${back} = ${ax}$ och $${ax} / ${a} = ${x}$. Talet är ${x}. Kontroll: $${a} · ${x} ${op} ${b} = ${c}$.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('fel-tecken', () => Q.of(op === '+' ? c + b : c - b, a), `När man arbetar baklänges görs varje steg tvärtom. Hur tar man bort "${verb}"?`),
        mis('fel-ordning', () => (op === '+' ? Q.of(c, a).sub(Q.int(b)) : Q.of(c, a).add(Q.int(b))), 'Baklänges betyder att det sista som hände tas bort först.'),
        mis('glomt-dividera', () => Q.int(ax), `Du har fått fram ${a} gånger talet. Ett steg kvar.`),
      ]),
      facitText: `${x}`,
    };
  },
  verify: ({ a, b, x, op }) => {
    const c = Q.int(a).mul(Q.int(x)).add(Q.int(op === '+' ? b : -b));
    return c.sub(Q.int(op === '+' ? b : -b)).div(Q.int(a));
  },
  constraints: ({ a, b, x, op }) => check({ 'resultatet är positivt': (op === '+' ? a * x + b : a * x - b) > 0 }),
});

// ---------------------------------------------------------------- A2.2, nivå 4

interface FracSolution {
  a: number;
  p: number;
  b: number;
  flip: boolean;
}

const fractionalSolution = defineTemplate<FracSolution>({
  id: 'A2.2-4-losning-i-brakform',
  skill: 'A2.2',
  area: 'ekvationer',
  level: 4,
  title: 'När lösningen inte är ett heltal',
  generate(rng) {
    const a = rng.int(2, 9);
    let p = rng.int(1, 6 * a);
    while (p % a === 0) p = rng.int(1, 6 * a);
    return { a, p, b: rng.int(1, 25), flip: rng.next() < 0.25 };
  },
  build({ a, p, b, flip }) {
    const c = p + b;
    const facit = Q.of(p, a);
    const eq = flip ? `${c} = ${a}x + ${b}` : `${a}x + ${b} = ${c}`;
    const shown = facit.isTerminatingDecimal() ? ` = ${fmt(facit)}` : '';
    return {
      prompt: `Lös ekvationen $${eq}$`,
      instruction: 'Svara exakt, i enklaste form.',
      answer: { ...SOLUTION, value: facit, requireReduced: true },
      hints: [
        'Lös ekvationen som vanligt. Svaret behöver inte vara ett heltal.',
        `Subtrahera ${b} på båda sidor: $${a}x = ${p}$.`,
        `Dividera med ${a}: $x = ${rawFrac(p, a)}$. Kan bråket förkortas, eller skrivas i blandad form?`,
        `$x = ${rawFrac(p, a)}${facit.d !== BigInt(a) ? ` = ${rawFrac(facit.n, facit.d)}` : ''}${facit.cmp(Q.ONE) > 0 ? ` = ${fmt(facit, 'mixed')}` : ''}${shown}$`,
      ],
      misconceptions: misconceptions(facit, [
        mis('fel-tecken', () => Q.of(c + b, a), `För att ta bort $+ ${b}$ ska du subtrahera.`),
        mis('omvand-division', () => Q.of(a, p), `Du har dividerat ${a} med ${p}. Det är $${a}x$ som ska delas med ${a}.`),
        mis('glomt-dividera', () => Q.int(p), `Du har fått fram $${a}x = ${p}$. Ett steg kvar.`),
        mis('avrundat', () => Q.int(Math.round(p / a)), 'Svaret ska vara exakt. Skriv det i bråkform eller blandad form.'),
      ]),
      facitText: `x = ${fmt(facit, 'mixed')}`,
    };
  },
  verify: ({ a, p, b }) => Q.int(p + b).sub(Q.int(b)).div(Q.int(a)),
  constraints: ({ a, p }) => check({ 'lösningen är inte ett heltal': p % a !== 0, 'lösningen positiv': p > 0 }),
});

export const equationTemplates: Template[] = [oneStep, twoStep, parenthesis, thinkOfNumber, fractionalSolution];
