import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { grade, type AnswerSpec } from '../src/core/grade.ts';
import { fmt, frac, kr } from '../src/core/format.ts';
import { Q } from '../src/core/rational.ts';
import { UNITS } from '../src/core/units.ts';
import { classify } from '../src/tasks/classify.ts';
import { TEMPLATES } from '../src/tasks/registry.ts';
import type { Task } from '../src/tasks/types.ts';
import { start, valueOf } from '../src/tasks/fractionWork.ts';

/**
 * Testerna från Fas 3, "Tester som måste gå igenom innan en mall släpps".
 * Varje mall körs med 10 000 olika frön. Antalet kan sänkas lokalt med
 * SUMMAX_VARIANTS=500 npm test.
 */
const VARIANTS = Number(globalThis.process?.env.SUMMAX_VARIANTS ?? 10_000);

/** Alla sätt att skriva värdet q som uppgiften säger att den godtar. */
function writtenForms(q: Q, spec: AnswerSpec): string[] {
  const accept = 'accept' in spec ? spec.accept : (['integer', 'decimal', 'fraction', 'mixed'] as const);
  const forms: string[] = [];
  if (q.isInteger()) {
    if (accept.includes('integer')) forms.push(q.n.toString());
  } else {
    if (accept.includes('fraction')) forms.push(q.toFractionString());
    if (accept.includes('mixed') && !q.isNegative() && q.cmp(Q.ONE) > 0) {
      const m = q.toMixed();
      forms.push(`${m.whole} ${m.num}/${m.den}`);
    }
  }
  if (accept.includes('decimal') && q.isTerminatingDecimal() && !q.isInteger()) {
    forms.push(q.toDecimalString(), q.toDecimalString().replace(',', '.'));
  }
  switch (spec.type) {
    case 'quantity': {
      const label = UNITS[spec.unit].label;
      const ascii = label.replace('²', '2');
      return forms.flatMap((f) => [`${f} ${label}`, `${f}${ascii}`, ...(spec.requireUnit ? [] : [f])]);
    }
    case 'solution':
      return forms.flatMap((f) => [f, `${spec.variable} = ${f}`, `${spec.variable}=${f}`]);
    case 'percent':
      return forms.map((f) => `${f} %`);
    default:
      return forms;
  }
}

/** Ett sätt att skriva ett felaktigt värde som parsern säkert kan läsa. */
function writeWrong(q: Q, spec: AnswerSpec): string {
  const s = q.isInteger() ? q.n.toString() : q.isTerminatingDecimal() ? q.toDecimalString() : q.toFractionString();
  if (spec.type === 'quantity') return `${s} ${UNITS[spec.unit].label}`;
  if (spec.type === 'percent') return `${s} %`;
  return s;
}

function balanced(s: string): boolean {
  if ((s.match(/\$/g) ?? []).length % 2 !== 0) return false;
  let depth = 0;
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function facitAppearsIn(text: string, q: Q): boolean {
  const variants = new Set([fmt(q), fmt(q, 'mixed'), frac(q), kr(q)]);
  return [...variants].some((v) => text.includes(v));
}

describe(`uppgiftsmallar (${VARIANTS} varianter per mall)`, () => {
  it('det finns mallar på flera nivåer i alla fyra områden', () => {
    for (const area of ['brak', 'procent', 'ekvationer', 'geometri'] as const) {
      const levels = new Set(TEMPLATES.filter((t) => t.area === area).map((t) => t.level));
      assert.ok(levels.size >= 3, `${area} har bara nivåerna ${[...levels].join(', ')}`);
    }
  });

  it('mall-id:n är unika', () => {
    assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  });

  for (const template of TEMPLATES) {
    it(template.id, () => {
      const problems = new Map<string, number>();
      const note = (what: string, seed: number): void => {
        if (!problems.has(what)) problems.set(what, seed);
      };

      for (let seed = 1; seed <= VARIANTS; seed++) {
        let audit: ReturnType<typeof template.audit>;
        try {
          audit = template.audit(seed);
        } catch (e) {
          note(`kastar fel: ${(e as Error).message}`, seed);
          continue;
        }
        const { task, verified, violations } = audit;
        const facit = task.answer.value;

        // 1. Villkor som ibland bryts
        for (const v of violations) note(`villkor brutet: ${v}`, seed);

        // 2. Facit räknat med en andra, oberoende metod
        if (!verified.eq(facit)) note(`facit ${facit} men oberoende beräkning ger ${verified}`, seed);

        // 3. Facit i alla tillåtna skrivsätt ska godkännas
        const forms = writtenForms(facit, task.answer);
        if (forms.length === 0) note('facit kan inte skrivas i någon tillåten form', seed);
        for (const f of forms) {
          const r = grade(task.answer, f);
          if (r.verdict !== 'correct') note(`"${f}" bedöms ${r.verdict} (${r.reason ?? ''})`, seed);
        }

        // 4–5. Felmönstrens svar ska underkännas, klassas rätt och inte vara lika med facit
        for (const m of task.misconceptions) {
          if (m.value.eq(facit)) note(`felmönstret ${m.id} ger facit`, seed);
          const r = grade(task.answer, writeWrong(m.value, task.answer));
          if (r.verdict !== 'incorrect') {
            note(`felmönstret ${m.id} bedöms ${r.verdict}`, seed);
            continue;
          }
          const c = classify(task as Task, r);
          if (c.kind !== 'knowledge' || c.misconception.id !== m.id) note(`felmönstret ${m.id} klassas som ${c.kind}`, seed);
        }

        // Bråkverkstadens uttryck har samma värde som facit
        if (task.work) {
          const v = valueOf(start(task.work.terms, task.work.ops));
          if (!v.eq(facit)) note(`bråkverkstaden ger ${v}, facit ${facit}`, seed);
        }

        // 7. Ledtråd 4 slutar med facit
        if (!facitAppearsIn(task.hints[3], facit)) note('ledtråd 4 innehåller inte facit', seed);

        // Texterna går att rita
        for (const t of [task.prompt, ...task.hints, ...task.misconceptions.map((m) => m.feedback)]) {
          if (!balanced(t)) note(`obalanserad notation: ${t}`, seed);
          if (/NaN|undefined|Infinity/.test(t)) note(`trasig text: ${t}`, seed);
        }
        if (task.figure !== undefined && (!task.figure.startsWith('<svg') || /NaN|undefined/.test(task.figure))) {
          note('trasig figur', seed);
        }
      }

      if (problems.size > 0) {
        const list = [...problems].map(([what, seed]) => `  ${what} (frö ${seed})`).join('\n');
        assert.fail(`${template.id}:\n${list}`);
      }
    });
  }
});

describe('samma frö ger samma uppgift', () => {
  for (const template of TEMPLATES) {
    it(template.id, () => {
      const a = template.instantiate(42);
      const b = template.instantiate(42);
      assert.equal(a.prompt, b.prompt);
      assert.ok(a.answer.value.eq(b.answer.value));
    });
  }
});
