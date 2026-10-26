/**
 * Exakta rationella tal med bigint. All rättning går via den här typen:
 * 0,1 + 0,2 blir exakt 3/10, aldrig ett flyttalsnärmevärde.
 *
 * Ett Q är alltid normaliserat: nämnaren är positiv och bråket förkortat.
 */
export class Q {
  readonly n: bigint;
  readonly d: bigint;

  private constructor(n: bigint, d: bigint) {
    this.n = n;
    this.d = d;
  }

  static of(n: bigint | number, d: bigint | number = 1n): Q {
    const nn = toBig(n);
    const dd = toBig(d);
    if (dd === 0n) throw new RangeError('Nämnaren får inte vara 0');
    const sign = dd < 0n ? -1n : 1n;
    const g = gcd(abs(nn), abs(dd)) || 1n;
    return new Q((sign * nn) / g, (sign * dd) / g);
  }

  static int(n: bigint | number): Q {
    return Q.of(n, 1n);
  }

  static readonly ZERO = Q.of(0n);
  static readonly ONE = Q.of(1n);

  add(o: Q): Q {
    return Q.of(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Q): Q {
    return Q.of(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Q): Q {
    return Q.of(this.n * o.n, this.d * o.d);
  }
  div(o: Q): Q {
    if (o.n === 0n) throw new RangeError('Division med 0');
    return Q.of(this.n * o.d, this.d * o.n);
  }
  neg(): Q {
    return Q.of(-this.n, this.d);
  }

  eq(o: Q): boolean {
    return this.n === o.n && this.d === o.d;
  }
  cmp(o: Q): -1 | 0 | 1 {
    const l = this.n * o.d;
    const r = o.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  isNegative(): boolean {
    return this.n < 0n;
  }

  /** Avslutas decimalutvecklingen? (nämnaren har bara faktorerna 2 och 5) */
  isTerminatingDecimal(): boolean {
    let d = this.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n;
  }

  /** Heltalsdel och rest för blandad form, t.ex. 7/4 → 1 och 3/4. */
  toMixed(): { whole: bigint; num: bigint; den: bigint; negative: boolean } {
    const negative = this.n < 0n;
    const an = abs(this.n);
    return { whole: an / this.d, num: an % this.d, den: this.d, negative };
  }

  /** Bråkform utan blandning: "7/4", "-3", "1/2". */
  toFractionString(): string {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }

  /** Svensk decimalform, bara för avslutande decimaler: "0,75". */
  toDecimalString(): string {
    if (!this.isTerminatingDecimal()) {
      throw new RangeError(`${this.toFractionString()} har ingen ändlig decimalform`);
    }
    const negative = this.n < 0n;
    let n = abs(this.n);
    const whole = n / this.d;
    n = n % this.d;
    let digits = '';
    while (n !== 0n) {
      n *= 10n;
      digits += (n / this.d).toString();
      n %= this.d;
    }
    const s = digits ? `${whole},${digits}` : `${whole}`;
    return negative ? `-${s}` : s;
  }

  /** Ungefärligt värde, bara för visning och sortering – aldrig för rättning. */
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }

  toString(): string {
    return this.toFractionString();
  }
}

export function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function lcm(a: bigint, b: bigint): bigint {
  return (abs(a) / gcd(a, b)) * abs(b);
}

export function abs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function toBig(x: bigint | number): bigint {
  if (typeof x === 'bigint') return x;
  if (!Number.isSafeInteger(x)) throw new RangeError(`Inte ett heltal: ${x}`);
  return BigInt(x);
}
