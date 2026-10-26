import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Q } from '../src/core/rational.ts';
import {
  allBalanced,
  applyToPart,
  combine,
  imbalanceMessage,
  start,
  toAnswer,
  toMarkup,
  valueOf,
  whyNotCombine,
  type Result,
  type WorkState,
} from '../src/tasks/fractionWork.ts';

const ok = (r: Result<WorkState>): WorkState => {
  if (!r.ok) assert.fail(r.message);
  return r.state;
};

describe('bråkverkstaden', () => {
  it('4/5 − 1/4: förläng båda, slå ihop', () => {
    let s = start([{ n: 4, d: 5 }, { n: 1, d: 4 }], ['-']);
    s = ok(applyToPart(s, 0, 'd', 'mul', 4, 20));
    assert.equal(allBalanced(s), false);
    assert.match(imbalanceMessage(s.terms[0]!)!, /täljaren/);
    assert.ok(whyNotCombine(s));
    s = ok(applyToPart(s, 0, 'n', 'mul', 4, 16));
    s = ok(applyToPart(s, 1, 'n', 'mul', 5, 5));
    s = ok(applyToPart(s, 1, 'd', 'mul', 5, 20));
    assert.equal(toMarkup(s), '{16/20} - {5/20}');
    assert.equal(whyNotCombine(s), null);
    s = ok(combine(s, 11));
    assert.equal(toAnswer(s), '11/20');
    assert.ok(valueOf(s).eq(Q.of(11, 20)));
  });

  it('räknefel godtas inte och ändrar ingenting', () => {
    const s = start([{ n: 1, d: 4 }], []);
    const r = applyToPart(s, 0, 'd', 'mul', 3, 11);
    assert.equal(r.ok, false);
    assert.equal(s.terms[0]!.d, 4);
  });

  it('olika tal i täljare och nämnare ger ett ändrat bråk', () => {
    let s = start([{ n: 1, d: 4 }, { n: 1, d: 6 }], ['+']);
    s = ok(applyToPart(s, 0, 'd', 'mul', 3, 12));
    s = ok(applyToPart(s, 0, 'n', 'mul', 2, 2));
    assert.equal(allBalanced(s), false);
  });

  it('förkorta: division som inte går jämnt stoppas', () => {
    let s = start([{ n: 6, d: 8 }], []);
    assert.equal(applyToPart(s, 0, 'n', 'div', 4, 1).ok, false);
    s = ok(applyToPart(s, 0, 'n', 'div', 2, 3));
    s = ok(applyToPart(s, 0, 'd', 'div', 2, 4));
    assert.equal(allBalanced(s), true);
    assert.equal(toAnswer(s), '3/4');
  });

  it('fel summa när bråken slås ihop', () => {
    const s = start([{ n: 7, d: 14 }, { n: 6, d: 14 }], ['+']);
    const r = combine(s, 12);
    assert.equal(r.ok, false);
    assert.equal(ok(combine(s, 13)).terms[0]!.n, 13);
  });

  it('olika nämnare kan inte slås ihop', () => {
    const s = start([{ n: 1, d: 2 }, { n: 1, d: 3 }], ['+']);
    assert.match(whyNotCombine(s)!, /samma nämnare/);
  });

  it('subtraktion', () => {
    const s = start([{ n: 5, d: 9 }, { n: 2, d: 9 }], ['-']);
    assert.equal(toAnswer(ok(combine(s, 3))), '3/9');
  });
});
