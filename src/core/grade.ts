import { Q } from './rational.ts';
import { parseAnswer, type NumberForm, type ParsedNumber } from './parse.ts';
import { UNITS, convert, type UnitId } from './units.ts';

/**
 * Rättning. Grundregel från Fas 3: godkänn bara det som bevisligen är rätt,
 * underkänn bara det som bevisligen är fel. Rätt värde i fel form räknas
 * aldrig som fel – då ber appen om en annan form.
 */

export type AnswerSpec =
  | {
      type: 'number';
      value: Q;
      accept: readonly NumberForm[];
      /** Bråk och blandad form måste vara förkortade. */
      requireReduced?: boolean;
    }
  | {
      type: 'quantity';
      value: Q;
      unit: UnitId;
      accept: readonly NumberForm[];
      /** Godta svar i en annan enhet av samma slag, t.ex. dm i stället för cm. */
      allowConversion: boolean;
      /** Kräv att enheten skrivs ut. */
      requireUnit: boolean;
    }
  | {
      type: 'percent';
      /** Procenttalet, t.ex. 15 för 15 %. */
      value: Q;
      /** Godta även andel i decimal- eller bråkform (0,15 eller 15/100). */
      acceptShare: boolean;
    }
  | {
      type: 'solution';
      variable: string;
      value: Q;
      accept: readonly NumberForm[];
      requireReduced?: boolean;
    };

export type Verdict = 'correct' | 'incorrect' | 'needs-form' | 'unreadable';

export type Reason =
  | 'empty'
  | 'unparsable'
  | 'not-reduced'
  | 'form-not-accepted'
  | 'missing-unit'
  | 'unit-not-accepted'
  | 'unexpected-unit'
  | 'wrong-dimension'
  | 'missing-percent'
  | 'wrong-variable'
  | 'unexpected-kind';

export interface GradeResult {
  verdict: Verdict;
  /** Elevens värde uttryckt som facit (samma enhet). Saknas om det inte gick att avgöra. */
  value?: Q;
  reason?: Reason;
  /** Kort text till Samuel. Tom vid rätt svar. */
  message: string;
}

const FORM_NAMES: Record<NumberForm, string> = {
  integer: 'heltal',
  decimal: 'decimalform',
  fraction: 'bråkform',
  mixed: 'blandad form',
};

export function grade(spec: AnswerSpec, raw: string): GradeResult {
  const p = parseAnswer(raw);

  if (p.kind === 'empty') {
    return { verdict: 'unreadable', reason: 'empty', message: 'Skriv ett svar först.' };
  }
  if (p.kind === 'invalid') {
    return {
      verdict: 'unreadable',
      reason: 'unparsable',
      message: 'Jag förstår inte svaret – skriv det på ett annat sätt.',
    };
  }

  switch (spec.type) {
    case 'number': {
      if (p.kind === 'number') return gradeNumber(p.num, spec.value, spec.accept, spec.requireReduced ?? false);
      if (p.kind === 'quantity') {
        return { verdict: 'unreadable', reason: 'unexpected-unit', message: 'Svara med bara ett tal, utan enhet.' };
      }
      return unexpected();
    }

    case 'solution': {
      if (p.kind === 'solution' && p.variable !== spec.variable) {
        return {
          verdict: 'unreadable',
          reason: 'wrong-variable',
          message: `Uppgiften frågar efter ${spec.variable}.`,
        };
      }
      if (p.kind === 'solution' || p.kind === 'number') {
        return gradeNumber(p.num, spec.value, spec.accept, spec.requireReduced ?? false);
      }
      return unexpected();
    }

    case 'percent': {
      if (p.kind === 'percent') return gradeNumber(p.num, spec.value, ['integer', 'decimal', 'fraction', 'mixed'], false);
      if (p.kind === 'number') {
        const asPercent = p.num.value.mul(Q.int(100));
        if (spec.acceptShare && asPercent.eq(spec.value)) {
          return { verdict: 'correct', value: asPercent, message: '' };
        }
        if (p.num.value.eq(spec.value)) {
          return {
            verdict: 'needs-form',
            value: spec.value,
            reason: 'missing-percent',
            message: 'Skriv svaret i procent, med procenttecken.',
          };
        }
        return { verdict: 'incorrect', value: spec.acceptShare ? asPercent : p.num.value, message: '' };
      }
      return unexpected();
    }

    case 'quantity': {
      const target = UNITS[spec.unit];
      if (p.kind === 'number') {
        const r = gradeNumber(p.num, spec.value, spec.accept, false);
        if (r.verdict === 'correct' && spec.requireUnit) {
          return { verdict: 'needs-form', value: spec.value, reason: 'missing-unit', message: `Skriv enheten också (${target.label}).` };
        }
        return r;
      }
      if (p.kind === 'quantity') {
        if (p.unit.dimension !== target.dimension) {
          return { verdict: 'incorrect', reason: 'wrong-dimension', message: '' };
        }
        if (p.unit.id !== target.id && !spec.allowConversion) {
          const value = convert(p.num.value, p.unit, target);
          if (!value.eq(spec.value)) return { verdict: 'incorrect', value, message: '' };
          return {
            verdict: 'needs-form',
            value,
            reason: 'unit-not-accepted',
            message: `Svara i ${target.label}.`,
          };
        }
        const converted: ParsedNumber = { ...p.num, value: convert(p.num.value, p.unit, target) };
        return gradeNumber(converted, spec.value, spec.accept, false);
      }
      return unexpected();
    }
  }
}

function gradeNumber(num: ParsedNumber, correct: Q, accept: readonly NumberForm[], requireReduced: boolean): GradeResult {
  if (!num.value.eq(correct)) return { verdict: 'incorrect', value: num.value, message: '' };

  if (!accept.includes(num.form)) {
    // Ett bråk med nämnaren 1 eller ett decimaltal som är ett heltal (6/1, 6,0) är bara en annan form.
    const names = accept.map((f) => FORM_NAMES[f]);
    return {
      verdict: 'needs-form',
      value: num.value,
      reason: 'form-not-accepted',
      message: `Rätt värde! Skriv det i ${joinOr(names)}.`,
    };
  }
  if (requireReduced && !num.reduced && (num.form === 'fraction' || num.form === 'mixed')) {
    return {
      verdict: 'needs-form',
      value: num.value,
      reason: 'not-reduced',
      message: 'Rätt värde! Förkorta svaret så långt det går.',
    };
  }
  return { verdict: 'correct', value: num.value, message: '' };
}

function unexpected(): GradeResult {
  return {
    verdict: 'unreadable',
    reason: 'unexpected-kind',
    message: 'Jag förstår inte svaret – skriv det på ett annat sätt.',
  };
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} eller ${items[items.length - 1]}`;
}
