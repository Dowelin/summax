import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { grade, type AnswerSpec } from '../src/core/grade.ts';
import { parseAnswer } from '../src/core/parse.ts';
import { Q } from '../src/core/rational.ts';

const verdict = (spec: AnswerSpec, raw: string): string => grade(spec, raw).verdict;

describe('tolkning av svar (tabellen i Fas 3)', () => {
  const cases: Array<[string, string]> = [
    ['3/4', 'number:3/4:fraction'],
    ['1 1/2', 'number:3/2:mixed'],
    ['0,75', 'number:3/4:decimal'],
    ['0.75', 'number:3/4:decimal'],
    ['-12', 'number:-12:integer'],
    ['−12', 'number:-12:integer'],
    ['12 000', 'number:12000:integer'],
    ['-1 1/2', 'number:-3/2:mixed'],
    ['15 %', 'percent:15'],
    ['15%', 'percent:15'],
    ['15 procent', 'percent:15'],
    ['24 cm2', 'quantity:24:cm2'],
    ['24 cm²', 'quantity:24:cm2'],
    ['24cm^2', 'quantity:24:cm2'],
    ['2,5dm', 'quantity:5/2:dm'],
    ['360 kr', 'quantity:360:kr'],
    ['360 kronor', 'quantity:360:kr'],
    ['x = 9', 'solution:x:9'],
    ['x=-3/4', 'solution:x:-3/4'],
    ['9', 'number:9:integer'],
  ];
  for (const [raw, expected] of cases) {
    it(`"${raw}"`, () => {
      const p = parseAnswer(raw);
      let got = p.kind as string;
      if (p.kind === 'number') got = `number:${p.num.value}:${p.num.form}`;
      if (p.kind === 'percent') got = `percent:${p.num.value}`;
      if (p.kind === 'quantity') got = `quantity:${p.num.value}:${p.unit.id}`;
      if (p.kind === 'solution') got = `solution:${p.variable}:${p.num.value}`;
      assert.equal(got, expected);
    });
  }

  it('gissar aldrig', () => {
    for (const raw of ['3//4', '1/0', '1,2,3', 'tre', '3 / ', 'x = ', '5 fot', '0 1/2', '1 0/4']) {
      assert.equal(parseAnswer(raw).kind, 'invalid', raw);
    }
    assert.equal(parseAnswer('   ').kind, 'empty');
  });
});

describe('rättning', () => {
  const half: AnswerSpec = { type: 'number', value: Q.of(1, 2), accept: ['fraction', 'decimal'], requireReduced: false };
  const reduced: AnswerSpec = { type: 'number', value: Q.of(11, 8), accept: ['fraction', 'mixed'], requireReduced: true };

  it('godtar alla likvärdiga skrivsätt som uppgiften tillåter', () => {
    assert.equal(verdict(half, '1/2'), 'correct');
    assert.equal(verdict(half, '2/4'), 'correct');
    assert.equal(verdict(half, '0,5'), 'correct');
    assert.equal(verdict(half, ' 1 / 2 '), 'correct');
  });

  it('rätt värde i fel form är inte fel', () => {
    assert.equal(verdict(reduced, '22/16'), 'needs-form');
    assert.equal(verdict(reduced, '1,375'), 'needs-form');
    assert.equal(verdict(reduced, '11/8'), 'correct');
    assert.equal(verdict(reduced, '1 3/8'), 'correct');
  });

  it('fel värde är fel, oläsligt är oläsligt', () => {
    assert.equal(verdict(reduced, '8/12'), 'incorrect');
    assert.equal(verdict(reduced, 'elva åttondelar'), 'unreadable');
    assert.equal(verdict(reduced, ''), 'unreadable');
  });

  it('1/3 kan inte skrivas exakt som decimaltal', () => {
    const third: AnswerSpec = { type: 'number', value: Q.of(1, 3), accept: ['fraction', 'decimal'] };
    assert.equal(verdict(third, '0,33'), 'incorrect');
    assert.equal(verdict(third, '0,333333'), 'incorrect');
    assert.equal(verdict(third, '2/6'), 'correct');
  });

  it('procent', () => {
    const spec: AnswerSpec = { type: 'percent', value: Q.int(15), acceptShare: true };
    assert.equal(verdict(spec, '15 %'), 'correct');
    assert.equal(verdict(spec, '0,15'), 'correct');
    assert.equal(verdict(spec, '15/100'), 'correct');
    assert.equal(verdict(spec, '15'), 'needs-form');
    assert.equal(verdict(spec, '20 %'), 'incorrect');
  });

  it('enheter: rätt slag krävs, omräkning när det är tillåtet', () => {
    const area: AnswerSpec = { type: 'quantity', value: Q.int(24), unit: 'cm2', accept: ['integer', 'decimal'], allowConversion: true, requireUnit: true };
    assert.equal(verdict(area, '24 cm2'), 'correct');
    assert.equal(verdict(area, '0,24 dm2'), 'correct');
    assert.equal(verdict(area, '2400 mm²'), 'correct');
    assert.equal(verdict(area, '24'), 'needs-form');
    assert.equal(verdict(area, '24 cm'), 'incorrect');
    assert.equal(grade(area, '24 cm').reason, 'wrong-dimension');
    assert.equal(verdict(area, '25 cm2'), 'incorrect');

    const len: AnswerSpec = { type: 'quantity', value: Q.int(25), unit: 'cm', accept: ['integer', 'decimal'], allowConversion: false, requireUnit: false };
    assert.equal(verdict(len, '2,5 dm'), 'needs-form');
    assert.equal(verdict(len, '25'), 'correct');
    assert.equal(verdict(len, '3 dm'), 'incorrect');
  });

  it('ekvationslösningar', () => {
    const spec: AnswerSpec = { type: 'solution', variable: 'x', value: Q.int(9), accept: ['integer'] };
    assert.equal(verdict(spec, 'x = 9'), 'correct');
    assert.equal(verdict(spec, '9'), 'correct');
    assert.equal(verdict(spec, 'y = 9'), 'unreadable');
    assert.equal(verdict(spec, 'x = 8'), 'incorrect');
  });
});
