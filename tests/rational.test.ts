import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Q, gcd, lcm } from '../src/core/rational.ts';

describe('Q – exakta rationella tal', () => {
  it('0,1 + 0,2 är exakt 3/10', () => {
    assert.ok(Q.of(1, 10).add(Q.of(2, 10)).eq(Q.of(3, 10)));
  });

  it('normaliserar tecken och förkortar', () => {
    const q = Q.of(6, -8);
    assert.equal(q.n, -3n);
    assert.equal(q.d, 4n);
  });

  it('räknesätten', () => {
    assert.ok(Q.of(3, 4).add(Q.of(5, 8)).eq(Q.of(11, 8)));
    assert.ok(Q.of(3, 4).sub(Q.of(5, 8)).eq(Q.of(1, 8)));
    assert.ok(Q.of(3, 4).mul(Q.of(2, 3)).eq(Q.of(1, 2)));
    assert.ok(Q.of(3, 4).div(Q.of(3, 8)).eq(Q.int(2)));
  });

  it('nämnaren 0 och division med 0 ger fel', () => {
    assert.throws(() => Q.of(1, 0));
    assert.throws(() => Q.ONE.div(Q.ZERO));
  });

  it('decimalform bara när den är ändlig', () => {
    assert.equal(Q.of(3, 4).toDecimalString(), '0,75');
    assert.equal(Q.of(-1, 8).toDecimalString(), '-0,125');
    assert.equal(Q.of(1, 3).isTerminatingDecimal(), false);
    assert.throws(() => Q.of(1, 3).toDecimalString());
  });

  it('blandad form', () => {
    const m = Q.of(7, 4).toMixed();
    assert.deepEqual([m.whole, m.num, m.den, m.negative], [1n, 3n, 4n, false]);
  });

  it('sgd och mgm', () => {
    assert.equal(gcd(12n, 18n), 6n);
    assert.equal(lcm(4n, 6n), 12n);
  });
});
