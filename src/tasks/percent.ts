import { Q } from '../core/rational.ts';
import { fmt, kr } from '../core/format.ts';
import { check, defineTemplate, mis, misconceptions, type Template } from './types.ts';

/** F2.1 Rabatt och påslag, nivå 1–4. Svar i kronor. */

const ITEMS = [
  ['jacka', 'jackan'],
  ['cykel', 'cykeln'],
  ['ryggsäck', 'ryggsäcken'],
  ['hörlurar', 'hörlurarna'],
  ['skridskor', 'skridskorna'],
  ['brädspel', 'brädspelet'],
  ['fotboll', 'fotbollen'],
] as const;
const plural = (item: string): boolean => item === 'hörlurar' || item === 'skridskor';
const costs = (item: string): string => (plural(item) ? 'Ett par' : /spel$/.test(item) ? 'Ett' : 'En');
const pronoun = (item: string): string => (plural(item) ? 'De' : /spel$/.test(item) ? 'Det' : 'Den');

const pct = (p: number, r: number): Q => Q.of(p * r, 100);
const KR = { type: 'quantity', unit: 'kr', accept: ['integer', 'decimal'], allowConversion: false, requireUnit: false } as const;

/** "1 % av 480 kr är 4,80 kr" */
const onePercent = (p: number): string => `1 % av ${p} kr är ${kr(Q.of(p, 100))} kr`;

function percentAsFraction(r: number): string | null {
  const m: Record<number, string> = { 10: '{1/10}', 20: '{1/5}', 25: '{1/4}', 50: '{1/2}', 75: '{3/4}' };
  return m[r] ?? null;
}

// ---------------------------------------------------------------- Nivå 1

interface Discount {
  item: number;
  p: number;
  r: number;
}

const discountAmount = defineTemplate<Discount>({
  id: 'F2.1-1-rabatt-kronor',
  skill: 'F2.1',
  area: 'procent',
  level: 1,
  title: 'Hur stor är rabatten?',
  generate: (rng) => ({ item: rng.int(0, ITEMS.length - 1), p: 20 * rng.int(5, 60), r: rng.pick([10, 20, 25, 50]) }),
  build({ item, p, r }) {
    const [name] = ITEMS[item]!;
    const d = (p * r) / 100;
    const facit = Q.int(d);
    const asFrac = percentAsFraction(r);
    return {
      prompt: `${costs(name)} ${name} kostar ${p} kr. ${pronoun(name)} är ${plural(name) ? 'nedsatta' : 'nedsatt'} med ${r} %. Hur många kronor är rabatten?`,
      answer: { ...KR, value: facit },
      hints: [
        `Procent betyder hundradelar. Hur mycket är 1 % av ${p} kr?`,
        `${onePercent(p)}.${asFrac ? ` Det går också att tänka att ${r} % är $${asFrac}$.` : ''}`,
        `${r} % är ${r} gånger så mycket som 1 %.`,
        `$${r} · ${kr(Q.of(p, 100))} = ${d}$. Rabatten är ${d} kr.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('nytt-pris', () => Q.int(p - d), 'Du har räknat ut det nya priset. Frågan gäller hur många kronor rabatten är.'),
        mis('procent-som-kronor', () => Q.int(r), `${r} % betyder inte ${r} kronor. Procent är hundradelar av priset.`),
      ]),
      facitText: `${d} kr`,
    };
  },
  verify: ({ p, r }) => Q.int(p).mul(Q.of(r, 100)),
  constraints: ({ p, r }) => check({ 'rabatten är hela kronor': (p * r) % 100 === 0, 'pris 100–1200 kr': p >= 100 && p <= 1200 }),
});

// ---------------------------------------------------------------- Nivå 2

const priceAfterDiscount = defineTemplate<Discount>({
  id: 'F2.1-2-pris-efter-rabatt',
  skill: 'F2.1',
  area: 'procent',
  level: 2,
  title: 'Pris efter rabatt',
  generate: (rng) => ({
    item: rng.int(0, ITEMS.length - 1),
    p: 20 * rng.int(5, 75),
    r: rng.pick([5, 15, 30, 35, 40, 60, 75]),
  }),
  build({ item, p, r }) {
    const [name, def] = ITEMS[item]!;
    const d = (p * r) / 100;
    const facit = Q.int(p - d);
    return {
      prompt: `${costs(name)} ${name} kostar ${p} kr. Under rean är ${pronoun(name).toLowerCase()} ${plural(name) ? 'nedsatta' : 'nedsatt'} med ${r} %. Vad kostar ${def} under rean?`,
      answer: { ...KR, value: facit },
      hints: [
        'Räkna först ut hur många kronor rabatten är.',
        `${onePercent(p)}. Rabatten är ${r} gånger så mycket.`,
        `Rabatten är ${d} kr. Dra bort den från ordinarie pris. (Eller: efter ${r} % rabatt betalar man ${100 - r} % av priset.)`,
        `$${p} - ${d} = ${p - d}$. ${def[0]!.toUpperCase() + def.slice(1)} kostar ${p - d} kr.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('svarat-rabatt', () => Q.int(d), 'Du har räknat ut rabatten. Frågan gäller vad det kostar efter rabatten.'),
        mis('procent-som-kronor', () => Q.int(p - r), `${r} % betyder inte ${r} kronor. Procent är hundradelar av priset.`),
        mis('lagt-till', () => Q.int(p + d), 'Du har lagt till rabatten. Blir det billigare eller dyrare på rea?'),
      ]),
      facitText: `${p - d} kr`,
    };
  },
  verify: ({ p, r }) => Q.int(p).mul(Q.ONE.sub(Q.of(r, 100))),
  constraints: ({ p, r }) => check({ 'priset är hela kronor': (p * r) % 100 === 0, 'nytt pris positivt': r < 100 }),
});

// ---------------------------------------------------------------- Nivå 3

interface UpDown {
  p: number;
  up: number;
  down: number;
}

const raiseThenLower = defineTemplate<UpDown>({
  id: 'F2.1-3-hojning-och-sankning',
  skill: 'F2.1',
  area: 'procent',
  level: 3,
  title: 'Först upp, sedan ner',
  generate: (rng) => ({ p: 100 * rng.int(2, 15), up: rng.pick([10, 20, 25, 50]), down: rng.pick([10, 20, 25, 50]) }),
  build({ p, up, down }) {
    const p1 = Q.int(p).add(pct(p, up));
    const cut = p1.mul(Q.of(down, 100));
    const facit = p1.sub(cut);
    return {
      prompt: `En vara kostar ${p} kr. Priset höjs först med ${up} %. Några veckor senare sänks det nya priset med ${down} %. Vad kostar varan efter sänkningen?`,
      instruction: 'Svara i kronor.',
      answer: { ...KR, value: facit },
      hints: [
        'Ta ett steg i taget. Räkna först ut priset efter höjningen.',
        `Efter höjningen kostar varan ${kr(p1)} kr.`,
        `Sänkningen räknas på ${kr(p1)} kr, inte på ${p} kr. ${down} % av ${kr(p1)} kr är ${kr(cut)} kr.`,
        `$${kr(p1)} - ${kr(cut)} = ${kr(facit)}$. Varan kostar ${kr(facit)} kr.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('procent-tar-ut-varandra', () => Q.int(p).mul(Q.ONE.add(Q.of(up - down, 100))), 'Höjningen och sänkningen räknas på olika belopp, så procenten kan inte bara räknas ihop. Ta ett steg i taget.'),
        mis('sankning-pa-gamla', () => p1.sub(pct(p, down)), `Sänkningen ska räknas på det nya priset, ${kr(p1)} kr.`),
        mis('bara-hojning', () => p1, 'Du har räknat ut priset efter höjningen. Glöm inte sänkningen.'),
      ]),
      facitText: `${kr(facit)} kr`,
    };
  },
  verify: ({ p, up, down }) => Q.int(p).mul(Q.of(100 + up, 100)).mul(Q.of(100 - down, 100)),
  constraints: ({ p, up, down }) => {
    const v = Q.int(p).mul(Q.of(100 + up, 100)).mul(Q.of(100 - down, 100));
    return check({ 'högst två decimaler (öre)': v.mul(Q.int(100)).isInteger() });
  },
});

// ---------------------------------------------------------------- Nivå 4

const originalPrice = defineTemplate<Discount>({
  id: 'F2.1-4-ursprungligt-pris',
  skill: 'F2.1',
  area: 'procent',
  level: 4,
  title: 'Priset före rabatten',
  generate: (rng) => ({ item: rng.int(0, ITEMS.length - 1), p: 20 * rng.int(5, 60), r: rng.pick([10, 15, 20, 25, 30, 40, 60]) }),
  build({ item, p, r }) {
    const [name, def] = ITEMS[item]!;
    const n = (p * (100 - r)) / 100;
    const facit = Q.int(p);
    const one = Q.of(n, 100 - r);
    return {
      prompt: `Efter ${r} % rabatt kostar ${def} ${n} kr. Vad kostade ${def} före rabatten?`,
      answer: { ...KR, value: facit },
      hints: [
        `Hur många procent av det gamla priset betalar man efter ${r} % rabatt?`,
        `${n} kr är ${100 - r} % av det gamla priset.`,
        `Om ${100 - r} % är ${n} kr, så är 1 % $${n} / ${100 - r} = ${fmt(one)}$ kr.`,
        `Det gamla priset är 100 % $= 100 · ${fmt(one)} = ${p}$. ${def[0]!.toUpperCase() + def.slice(1)} kostade ${p} kr.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('procent-pa-nya-priset', () => Q.int(n).mul(Q.of(100 + r, 100)), `Rabatten räknades på det gamla priset, inte på ${n} kr. Det går därför inte att lägga på ${r} % av ${n} kr.`),
        mis('procent-som-kronor', () => Q.int(n + r), `${r} % betyder inte ${r} kronor.`),
        mis('svarat-rabatt', () => Q.int(p - n), 'Du har räknat ut rabatten i kronor. Frågan gäller priset före rabatten.'),
      ]),
      facitText: `${p} kr`,
    };
  },
  verify: ({ p, r }) => Q.of(p * (100 - r), 100).div(Q.of(100 - r, 100)),
  constraints: ({ p, r }) => check({ 'reapriset är hela kronor': (p * (100 - r)) % 100 === 0 }),
});

export const percentTemplates: Template[] = [discountAmount, priceAfterDiscount, raiseThenLower, originalPrice];
