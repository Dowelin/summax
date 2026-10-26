/**
 * Deterministisk slump (mulberry32). Samma frö ger alltid samma uppgift,
 * så att varje uppgift Samuel fått kan återskapas och felsökas.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Flyttal i [0, 1). Används bara för att välja – aldrig i facit. */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Heltal i [min, max], båda inklusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Tom lista');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  bool(): boolean {
    return this.next() < 0.5;
  }
}

/** Ett nytt slumpfrö för en uppgift. */
export function newSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  return Math.floor(Math.random() * 2 ** 32);
}
