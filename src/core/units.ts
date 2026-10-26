import { Q } from './rational.ts';

export type Dimension = 'length' | 'area' | 'money';

export interface Unit {
  id: UnitId;
  dimension: Dimension;
  /** Faktor till dimensionens basenhet (meter, kvadratmeter, kronor). */
  factor: Q;
  /** Visningsform i uppgifter och förhandsvisning. */
  label: string;
}

export type UnitId = 'mm' | 'cm' | 'dm' | 'm' | 'km' | 'mm2' | 'cm2' | 'dm2' | 'm2' | 'km2' | 'kr';

const p10 = (e: number): Q => (e >= 0 ? Q.int(10n ** BigInt(e)) : Q.of(1n, 10n ** BigInt(-e)));

export const UNITS: Record<UnitId, Unit> = {
  mm: { id: 'mm', dimension: 'length', factor: p10(-3), label: 'mm' },
  cm: { id: 'cm', dimension: 'length', factor: p10(-2), label: 'cm' },
  dm: { id: 'dm', dimension: 'length', factor: p10(-1), label: 'dm' },
  m: { id: 'm', dimension: 'length', factor: p10(0), label: 'm' },
  km: { id: 'km', dimension: 'length', factor: p10(3), label: 'km' },
  mm2: { id: 'mm2', dimension: 'area', factor: p10(-6), label: 'mm²' },
  cm2: { id: 'cm2', dimension: 'area', factor: p10(-4), label: 'cm²' },
  dm2: { id: 'dm2', dimension: 'area', factor: p10(-2), label: 'dm²' },
  m2: { id: 'm2', dimension: 'area', factor: p10(0), label: 'm²' },
  km2: { id: 'km2', dimension: 'area', factor: p10(6), label: 'km²' },
  kr: { id: 'kr', dimension: 'money', factor: p10(0), label: 'kr' },
};

const ALIASES: Record<string, UnitId> = {
  kr: 'kr',
  'kr.': 'kr',
  kronor: 'kr',
  krona: 'kr',
  ':-': 'kr',
};
for (const base of ['mm', 'cm', 'dm', 'm', 'km'] as const) {
  ALIASES[base] = base;
  for (const sq of ['2', '²', '^2', ' 2']) ALIASES[base + sq] = `${base}2` as UnitId;
}

/** Tolka en enhet som eleven skrivit, t.ex. "cm2", "cm²" eller "kronor". */
export function parseUnit(raw: string): Unit | null {
  const id = ALIASES[raw.trim().toLowerCase()];
  return id ? UNITS[id] : null;
}

/** Räkna om ett värde från en enhet till en annan i samma dimension. */
export function convert(value: Q, from: Unit, to: Unit): Q {
  if (from.dimension !== to.dimension) {
    throw new RangeError(`Kan inte räkna om ${from.label} till ${to.label}`);
  }
  return value.mul(from.factor).div(to.factor);
}
