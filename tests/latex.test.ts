import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasPlaceholder, latexToPlain } from '../src/core/latex.ts';
import { parseAnswer } from '../src/core/parse.ts';
import { checkCalcLine, checkLine } from '../src/tasks/workpad.ts';
import { Q } from '../src/core/rational.ts';

describe('LaTeX från MathLive till text', () => {
  const cases: Array<[string, string, string]> = [
    ['\\frac{3}{4}', '3/4', '3/4'],
    ['\\frac34', '3/4', '3/4'],
    ['1\\frac{1}{2}', '1 1/2', '(1+1/2)'],
    ['-1\\frac{1}{2}', '-1 1/2', '-(1+1/2)'],
    ['1\\,\\frac{1}{2}', '1 1/2', '(1+1/2)'],
    ['x=2\\,\\frac{2}{5}', 'x=2 2/5', 'x=(2+2/5)'],
    ['3\\cdot\\frac{1}{2}', '3·1/2', '3·1/2'],
    ['0{,}75', '0,75', '0,75'],
    ['24\\,\\mathrm{cm}^2', '24 cm^2', '24 cm^2'],
    ['24cm^{2}', '24cm^2', '24cm^2'],
    ['15\\%', '15%', '15%'],
    ['x=9', 'x=9', 'x=9'],
    ['4x-7=29', '4x-7=29', '4x-7=29'],
    ['3\\left(x+2\\right)=2x-1', '3(x+2)=2x-1', '3(x+2)=2x-1'],
    ['\\frac{x}{3}+1=5', '(x)/(3)+1=5', '(x)/(3)+1=5'],
    ['\\frac{x+1}{4}=2', '(x+1)/(4)=2', '(x+1)/(4)=2'],
    ['2\\cdot x=18', '2·x=18', '2·x=18'],
    ['18\\div 2', '18:2', '18:2'],
    ['x=\\frac{12}{5}', 'x=12/5', 'x=12/5'],
    ['x=2\\frac{2}{5}', 'x=2 2/5', 'x=(2+2/5)'],
    ['3\\frac{x}{2}', '3(x)/(2)', '3(x)/(2)'],
  ];
  for (const [latex, answer, equation] of cases) {
    it(latex, () => {
      assert.equal(latexToPlain(latex, 'answer'), answer);
      assert.equal(latexToPlain(latex, 'equation'), equation);
    });
  }

  it('exakt det MathLive 0.101 gav vid riktig tangentbordsinmatning', () => {
    const typed: Array<[string, string, string]> = [
      ['\\frac45-\\frac14=\\frac{16}{20}-\\frac{5}{20}', '4/5-1/4=16/20-5/20', '4/5-1/4=16/20-5/20'],
      ['\\frac{x}{3}+1=5', '(x)/(3)+1=5', '(x)/(3)+1=5'],
      ['1\\,\\frac38', '1 3/8', '(1+3/8)'],
      ['24\\,cm^2', '24 cm^2', '24 cm^2'],
      ['\\frac{\\left(x+1\\right)}{4}=2', '((x+1))/(4)=2', '((x+1))/(4)=2'],
      ['0{,}75\\cdot480=360', '0,75·480=360', '0,75·480=360'],
    ];
    for (const [latex, answer, equation] of typed) {
      assert.equal(latexToPlain(latex, 'answer'), answer, latex);
      assert.equal(latexToPlain(latex, 'equation'), equation, latex);
    }
    assert.equal(checkCalcLine(latexToPlain(typed[0]![0], 'equation')).kind, 'ok');
    assert.equal(checkLine(latexToPlain(typed[4]![0], 'equation'), Q.int(7)).kind, 'step-ok');
    const q = parseAnswer(latexToPlain(typed[3]![0]));
    assert.ok(q.kind === 'quantity' && q.unit.id === 'cm2');
  });

  it('okända kommandon lämnas kvar och blir oläsliga', () => {
    assert.equal(parseAnswer(latexToPlain('\\alpha')).kind, 'invalid');
  });

  it('tomma platser upptäcks', () => {
    assert.equal(hasPlaceholder('\\frac{3}{}'), true);
    assert.equal(hasPlaceholder('\\frac{3}{\\placeholder{}}'), true);
    assert.equal(hasPlaceholder('\\frac{3}{4}'), false);
  });

  it('hela kedjan: MathLive → text → rättning', () => {
    const mixed = parseAnswer(latexToPlain('1\\frac{3}{8}'));
    assert.ok(mixed.kind === 'number' && mixed.num.form === 'mixed' && mixed.num.value.eq(Q.of(11, 8)));
    assert.equal(parseAnswer(latexToPlain('24\\,\\mathrm{cm}^2')).kind, 'quantity');
    assert.equal(checkLine(latexToPlain('3\\left(x+2\\right)=2x-1', 'equation'), Q.int(-7)).kind, 'step-ok');
    assert.equal(checkLine(latexToPlain('\\frac{x}{3}=\\frac{4}{3}', 'equation'), Q.int(4)).kind, 'step-ok');
    assert.deepEqual(checkLine(latexToPlain('x=2\\frac{2}{5}', 'equation'), Q.of(12, 5)).kind, 'answer');
  });
});
