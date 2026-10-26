import { Q } from '../core/rational.ts';
import { fmt } from '../core/format.ts';
import { lShape, rectangle, triangle } from './figures.ts';
import { check, defineTemplate, mis, misconceptions, type Template } from './types.ts';

/** G2 Omkrets och area. Svaren kräver enhet, och rätt slags enhet. */

const AREA_CM2 = { type: 'quantity', unit: 'cm2', accept: ['integer', 'decimal'], allowConversion: true, requireUnit: true } as const;
const LENGTH_CM = { type: 'quantity', unit: 'cm', accept: ['integer', 'decimal'], allowConversion: true, requireUnit: true } as const;

// ---------------------------------------------------------------- G2.1, nivå 1

interface Rect {
  w: number;
  h: number;
}

const rectangleArea = defineTemplate<Rect>({
  id: 'G2.1-1-rektangelns-area',
  skill: 'G2.1',
  area: 'geometri',
  level: 1,
  title: 'Rektangelns area',
  generate(rng) {
    const w = rng.int(3, 15);
    let h = rng.int(2, 12);
    while (h === w) h = rng.int(2, 12);
    return { w, h };
  },
  build({ w, h }) {
    const facit = Q.int(w * h);
    return {
      prompt: 'Beräkna rektangelns area.',
      figure: rectangle(w, h, `${w} cm`, `${h} cm`),
      instruction: 'Svara med enhet.',
      answer: { ...AREA_CM2, value: facit },
      hints: [
        'Arean är hur många rutor på 1 cm × 1 cm som får plats i rektangeln.',
        `Det får plats ${w} rutor i varje rad, och det finns ${h} rader.`,
        'Arean av en rektangel är basen gånger höjden.',
        `$${w} · ${h} = ${w * h}$. Arean är ${w * h} cm².`,
      ],
      misconceptions: misconceptions(facit, [
        mis('omkrets', () => Q.int(2 * (w + h)), 'Du har räknat ut omkretsen – sträckan runt figuren. Arean är ytan inuti.'),
        mis('adderat-sidor', () => Q.int(w + h), 'Du har adderat sidorna. Arean får man genom att multiplicera.'),
      ]),
      facitText: `${w * h} cm²`,
    };
  },
  verify: ({ w, h }) => Q.int(h).mul(Q.int(w)),
  constraints: ({ w, h }) => check({ 'olika sidor': w !== h, 'sidor 2–15': w >= 2 && h >= 2 && w <= 15 && h <= 15 }),
});

// ---------------------------------------------------------------- G2.1, nivå 2

interface MixedUnits {
  wMm: number;
  h: number;
}

const perimeterMixedUnits = defineTemplate<MixedUnits>({
  id: 'G2.1-2-omkrets-olika-enheter',
  skill: 'G2.1',
  area: 'geometri',
  level: 2,
  title: 'Omkrets med olika enheter',
  generate(rng) {
    // Bredden i dm med en decimal, t.ex. 1,4 dm = 14 cm. Höjden i hela cm.
    let wCm = rng.int(11, 29);
    while (wCm % 10 === 0) wCm = rng.int(11, 29);
    let h = rng.int(4, 15);
    while (h === wCm) h = rng.int(4, 15);
    return { wMm: wCm * 10, h };
  },
  build({ wMm, h }) {
    const wCm = wMm / 10;
    const wDm = Q.of(wMm, 100);
    const facit = Q.int(2 * (wCm + h));
    return {
      prompt: 'Beräkna rektangelns omkrets i centimeter.',
      figure: rectangle(wCm, h, `${fmt(wDm)} dm`, `${h} cm`),
      instruction: 'Svara med enhet.',
      answer: { ...LENGTH_CM, value: facit },
      hints: [
        'Titta på enheterna. Är alla sidor angivna i samma enhet?',
        `1 dm = 10 cm, så ${fmt(wDm)} dm = ${wCm} cm.`,
        'Omkretsen är summan av alla fyra sidor.',
        `$${wCm} + ${h} + ${wCm} + ${h} = ${2 * (wCm + h)}$. Omkretsen är ${2 * (wCm + h)} cm.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('blandat-enheter', () => wDm.add(Q.int(h)).mul(Q.int(2)), `Sidorna har olika enheter. Gör om ${fmt(wDm)} dm till centimeter först.`),
        mis('halva-omkretsen', () => Q.int(wCm + h), 'Du har lagt ihop två sidor. Omkretsen är sträckan runt hela figuren – fyra sidor.'),
        mis('area', () => Q.int(wCm * h), 'Du har multiplicerat sidorna, som för arean. Omkretsen är sträckan runt figuren.'),
      ]),
      facitText: `${2 * (wCm + h)} cm`,
    };
  },
  verify: ({ wMm, h }) => Q.of(wMm, 10).mul(Q.int(2)).add(Q.int(2 * h)),
  constraints: ({ wMm }) => check({ 'bredden har en decimal i dm': wMm % 100 !== 0 && wMm % 10 === 0 }),
});

// ---------------------------------------------------------------- G2.2, nivå 2

const TRIPLES = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [8, 6, 10],
  [9, 12, 15],
  [12, 5, 13],
  [4, 3, 5],
] as const;

interface Tri {
  left: number;
  right: number;
  height: number;
  side: number;
}

const triangleArea = defineTemplate<Tri>({
  id: 'G2.2-2-triangelns-area',
  skill: 'G2.2',
  area: 'geometri',
  level: 2,
  title: 'Triangelns area',
  generate(rng) {
    const [right, height, side] = rng.pick(TRIPLES);
    const left = rng.int(2, 9);
    return { left, right, height, side };
  },
  build({ left, right, height, side }) {
    const base = left + right;
    const facit = Q.of(base * height, 2);
    return {
      prompt: 'Beräkna triangelns area.',
      figure: triangle(left, right, height, { base: `${base} cm`, height: `${height} cm`, side: `${side} cm` }),
      instruction: 'Svara med enhet.',
      answer: { ...AREA_CM2, value: facit },
      hints: [
        'Vilka mått behövs för arean? Alla tre mått i figuren behövs inte.',
        `Höjden är den streckade linjen, ${height} cm. Den står vinkelrätt mot basen.`,
        'En triangel är hälften av en rektangel med samma bas och höjd: $A = {b · h/2}$.',
        `$A = {${base} · ${height}/2} = ${fmt(facit)}$. Arean är ${fmt(facit)} cm².`,
      ],
      misconceptions: misconceptions(facit, [
        mis('glomt-halvera', () => Q.int(base * height), 'Du har räknat ut arean av en hel rektangel. Triangeln är hälften av den.'),
        mis('sned-sida', () => Q.of(base * side, 2), `${side} cm är en sida, inte höjden. Höjden står vinkelrätt mot basen.`),
        mis('sned-sida-hel', () => Q.int(base * side), `${side} cm är en sida, inte höjden. Och glöm inte att triangeln är en halv rektangel.`),
      ]),
      facitText: `${fmt(facit)} cm²`,
    };
  },
  verify: ({ left, right, height }) => Q.int(left).add(Q.int(right)).mul(Q.int(height)).div(Q.int(2)),
  constraints: ({ right, height, side }) =>
    check({ 'sidan stämmer med Pythagoras': right * right + height * height === side * side, 'sidan längre än höjden': side > height }),
});

// ---------------------------------------------------------------- G2.4, nivå 3

interface LShape {
  W: number;
  H: number;
  cutW: number;
  cutH: number;
}

const compositeArea = defineTemplate<LShape>({
  id: 'G2.4-3-sammansatt-figur',
  skill: 'G2.4',
  area: 'geometri',
  level: 3,
  title: 'Sammansatta figurer',
  generate(rng) {
    const W = rng.int(8, 16);
    const H = rng.int(6, 12);
    return { W, H, cutW: rng.int(2, W - 3), cutH: rng.int(2, H - 3) };
  },
  build({ W, H, cutW, cutH }) {
    const top = W - cutW;
    const right = H - cutH;
    // Dela figuren i två rektanglar: en vänster del (top × H) och en höger del (cutW × right).
    const leftPart = top * H;
    const rightPart = cutW * right;
    const facit = Q.int(leftPart + rightPart);
    return {
      prompt: 'Beräkna figurens area. Alla hörn är räta.',
      figure: lShape(W, H, cutW, cutH, { bottom: `${W} cm`, left: `${H} cm`, top: `${top} cm`, right: `${right} cm` }),
      instruction: 'Svara med enhet.',
      answer: { ...AREA_CM2, value: facit },
      hints: [
        'Dela upp figuren i två rektanglar, eller tänk dig en stor rektangel där en bit fattas.',
        `Med en lodrät linje blir det en rektangel på ${top} cm × ${H} cm och en på ${cutW} cm × ${right} cm.`,
        `Den högra rektangelns bredd är $${W} - ${top} = ${cutW}$ cm.`,
        `$${top} · ${H} + ${cutW} · ${right} = ${leftPart} + ${rightPart} = ${leftPart + rightPart}$. Arean är ${leftPart + rightPart} cm².`,
      ],
      misconceptions: misconceptions(facit, [
        mis('hel-rektangel', () => Q.int(W * H), 'Du har räknat ut arean av hela rektangeln. Ett hörn saknas i figuren.'),
        mis('omkrets', () => Q.int(2 * (W + H)), 'Du har räknat ut omkretsen. Arean är ytan inuti figuren.'),
        mis('overlapp', () => Q.int(top * H + W * right), 'Du har räknat en del av figuren två gånger. Rita in hur du delar den.'),
      ]),
      facitText: `${leftPart + rightPart} cm²`,
    };
  },
  verify: ({ W, H, cutW, cutH }) => Q.int(W * H).sub(Q.int(cutW).mul(Q.int(cutH))),
  constraints: ({ W, H, cutW, cutH }) =>
    check({ 'urtaget mindre än figuren': cutW < W - 1 && cutH < H - 1, 'urtaget minst 2': cutW >= 2 && cutH >= 2 }),
});

// ---------------------------------------------------------------- G2.1, nivå 4

interface Reverse {
  a: number;
  b: number;
}

const perimeterFromArea = defineTemplate<Reverse>({
  id: 'G2.1-4-omkrets-fran-area',
  skill: 'G2.1',
  area: 'geometri',
  level: 4,
  title: 'Från area till omkrets',
  generate(rng) {
    const a = rng.int(3, 15);
    let b = rng.int(2, 15);
    while (b === a) b = rng.int(2, 15);
    return { a, b };
  },
  build({ a, b }) {
    const A = a * b;
    const facit = Q.int(2 * (a + b));
    return {
      prompt: `En rektangel har arean ${A} cm². En av sidorna är ${a} cm. Hur lång är rektangelns omkrets?`,
      instruction: 'Svara med enhet.',
      answer: { ...LENGTH_CM, value: facit },
      hints: [
        'För att räkna ut omkretsen behöver du båda sidorna. Vilken sida saknas?',
        `Arean är sida gånger sida: $${a} · ? = ${A}$.`,
        `Den andra sidan är $${A} / ${a} = ${b}$ cm.`,
        `$2 · ${a} + 2 · ${b} = ${2 * (a + b)}$. Omkretsen är ${2 * (a + b)} cm.`,
      ],
      misconceptions: misconceptions(facit, [
        mis('bara-sidan', () => Q.int(b), `${b} cm är den andra sidan. Frågan gäller omkretsen.`),
        mis('halva-omkretsen', () => Q.int(a + b), 'Du har lagt ihop två sidor. Omkretsen går runt hela rektangeln.'),
        mis('area-plus-sida', () => Q.int(2 * (A + a)), 'Arean är inte en sida. Räkna först ut den saknade sidan.'),
      ]),
      facitText: `${2 * (a + b)} cm`,
    };
  },
  verify: ({ a, b }) => Q.int(a * b).div(Q.int(a)).add(Q.int(a)).mul(Q.int(2)),
  constraints: ({ a, b }) => check({ 'olika sidor': a !== b }),
});

export const geometryTemplates: Template[] = [rectangleArea, perimeterMixedUnits, triangleArea, compositeArea, perimeterFromArea];
