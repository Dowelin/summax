import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseEquation, parseLinear, solve } from '../src/core/linear.ts';
import { Q } from '../src/core/rational.ts';
import { checkLine } from '../src/tasks/workpad.ts';
import { TEMPLATES } from '../src/tasks/registry.ts';
import { Rng } from '../src/core/rng.ts';

const sol = (s: string): string => {
  const r = solve(parseEquation(s));
  return r.kind === 'one' ? r.x.toString() : r.kind;
};

describe('linjära uttryck', () => {
  const cases: Array<[string, string, string]> = [
    ['3x + 2', '3', '2'],
    ['2(x + 3)', '2', '6'],
    ['-(x - 4)', '-1', '4'],
    ['x/3 + 1/2', '1/3', '1/2'],
    ['(x + 1)/4', '1/4', '1/4'],
    ['4x − 7', '4', '-7'],
    ['0,5x · 4', '2', '0'],
    ['3 · 4 : 6', '0', '2'],
    ['2^3x', '8', '0'],
    ['x - -2', '1', '2'],
  ];
  for (const [src, a, b] of cases) {
    it(src, () => {
      const e = parseLinear(src);
      assert.equal(e.a.toString(), a);
      assert.equal(e.b.toString(), b);
    });
  }

  it('avvisar det som inte är linjärt eller inte går att läsa', () => {
    for (const s of ['x · x', 'x^2', '3/x', '2y', '3 +', '(x + 1', '4/0', '']) {
      assert.throws(() => parseLinear(s), s);
    }
  });
});

describe('lösningar', () => {
  it('en, alla eller ingen', () => {
    assert.equal(sol('4x - 7 = 29'), '9');
    assert.equal(sol('3(x + 2) = 2x - 1'), '-7');
    assert.equal(sol('x/2 + 1/3 = 1'), '4/3');
    assert.equal(sol('2x + 1 = 2x + 1'), 'all');
    assert.equal(sol('2x + 1 = 2x + 3'), 'none');
  });
});

describe('räknerader', () => {
  const nine = Q.int(9);
  it('korrekta och felaktiga steg', () => {
    assert.equal(checkLine('4x = 36', nine).kind, 'step-ok');
    assert.equal(checkLine('8x - 14 = 58', nine).kind, 'step-ok');
    assert.equal(checkLine('4x = 22', nine).kind, 'step-wrong');
    assert.equal(checkLine('4x = 4x', nine).kind, 'step-wrong');
    assert.equal(checkLine('0 = 5', nine).kind, 'step-wrong');
  });

  it('svarsrader', () => {
    assert.deepEqual(checkLine('x = 9', nine), { kind: 'answer', text: '9' });
    assert.deepEqual(checkLine('9 = x', nine), { kind: 'answer', text: '9' });
    assert.deepEqual(checkLine('x = 18/2', nine), { kind: 'answer', text: '18/2' });
    assert.deepEqual(checkLine('7', nine), { kind: 'answer', text: '7' });
  });

  it('oläsliga rader', () => {
    assert.equal(checkLine('4x', nine).kind, 'unreadable');
    assert.equal(checkLine('4x = 36 = 4 · 9', nine).kind, 'unreadable');
    assert.equal(checkLine('x² = 81', nine).kind, 'unreadable');
    assert.equal(checkLine('', nine).kind, 'empty');
  });

  it('typiska lösningsgångar för alla ekvationsmallar ger bara bockar', () => {
    const rng = new Rng(3);
    for (const tpl of TEMPLATES.filter((t) => t.area === 'ekvationer')) {
      for (let k = 0; k < 300; k++) {
        const task = tpl.instantiate(rng.int(1, 1_000_000));
        // Ledtråd 4 innehåller lösningsgången; varje ekvation i den ska stämma.
        const eqs = [...task.hints[3].matchAll(/\$([^$]*=[^$]*)\$/g)].flatMap((m) => m[1]!.split(/,\s*/));
        for (const raw of eqs) {
          const plain = raw.replace(/\{([^{}/]+)\/([^{}]+)\}/g, '($1)/($2)');
          if (!/x/.test(plain) || plain.split('=').length !== 2) continue;
          const r = checkLine(plain, task.answer.value);
          assert.ok(r.kind === 'step-ok' || r.kind === 'answer', `${tpl.id}: "${plain}" gav ${r.kind}`);
        }
      }
    }
  });
});

import { checkCalcLine, markupToPlain, toArithmetic } from '../src/tasks/workpad.ts';

describe('uträkningsrader', () => {
  it('kedjor av likhetstecken kontrolleras exakt', () => {
    assert.equal(checkCalcLine('4/5 - 1/4 = 16/20 - 5/20 = 11/20').kind, 'ok');
    assert.equal(checkCalcLine('4/5 - 1/4 = 3/1').kind, 'wrong');
    assert.equal(checkCalcLine('16/20 - 5/20 = 11/25').kind, 'wrong');
  });

  it('en rad som börjar med = fortsätter från förra raden', () => {
    const first = checkCalcLine('(4)/(5) - (1)/(4)');
    assert.equal(first.kind, 'noted');
    const next = checkCalcLine('= 16/20 - 5/20', first.kind === 'noted' ? first.last : undefined);
    assert.equal(next.kind, 'ok');
    assert.equal(checkCalcLine('= 11/20').kind, 'unreadable');
  });

  it('enheter, procent och "av"', () => {
    assert.equal(toArithmetic('10 cm · 11 cm'), '10 · 11');
    assert.equal(checkCalcLine('10 cm · 11 cm + 4 cm · 5 cm = 130 cm2').kind, 'ok');
    assert.equal(checkCalcLine('25 % av 480 kr = 120 kr').kind, 'ok');
    assert.equal(checkCalcLine('480 - 96 = 384').kind, 'ok');
    assert.equal(checkCalcLine('1,2 · 1200 = 1440').kind, 'ok');
    assert.equal(checkCalcLine('2x = 4').kind, 'unreadable');
  });

  it('uppgiftens uttryck som första rad', () => {
    assert.equal(markupToPlain('{4/5} - {1/4}'), '(4)/(5) - (1)/(4)');
    assert.equal(markupToPlain('1{3/8}'), '(1+3/8)');
  });

  it('lösningarna i alla mallar utan x består av sanna likheter', () => {
    for (const tpl of TEMPLATES.filter((t) => t.area !== 'ekvationer')) {
      for (let seed = 1; seed <= 300; seed++) {
        const task = tpl.instantiate(seed);
        for (const m of task.hints[3].matchAll(/\$([^$]*=[^$]*)\$/g)) {
          const r = checkCalcLine(markupToPlain(m[1]!).replace(/,(?=\s)/g, ''));
          assert.ok(r.kind === 'ok' || r.kind === 'unreadable', `${tpl.id} frö ${seed}: "${m[1]}" gav ${r.kind}`);
        }
      }
    }
  });
});
