import type { AnswerSpec } from '../core/grade.ts';
import { Q } from '../core/rational.ts';
import { Rng } from '../core/rng.ts';

export type Level = 1 | 2 | 3 | 4 | 5;

/** Prototypens fyra områden (Fas 1, punkt 5 i "Där jag ifrågasätter upplägget"). */
export type AreaId = 'brak' | 'procent' | 'ekvationer' | 'geometri';

export const AREAS: Record<AreaId, { title: string; skills: string }> = {
  brak: { title: 'Bråk', skills: 'T3.5 Addera och subtrahera bråk' },
  procent: { title: 'Procent', skills: 'F2.1 Rabatt och påslag' },
  ekvationer: { title: 'Ekvationer', skills: 'A2.1–A2.3 Ekvationer' },
  geometri: { title: 'Omkrets och area', skills: 'G2.1–G2.4 Omkrets och area' },
};

export interface Misconception {
  id: string;
  /** Det värde missförståndet ger, i facits enhet. */
  value: Q;
  /** Förklaring som visas när svaret matchar. Beskriver tanken, inte facit. */
  feedback: string;
}

export interface TaskBody {
  /** Uppgiftstext med matematik inom $…$ (se core/format.ts). */
  prompt: string;
  /** Teknisk figur som SVG, om uppgiften har en. */
  figure?: string;
  /** Kort instruktion om svarsformen, t.ex. "Svara i cm²." */
  instruction?: string;
  answer: AnswerSpec;
  /** Fyra ledtrådar: liten, konkret, metod, hela lösningen (slutar med facit). */
  hints: readonly [string, string, string, string];
  misconceptions: readonly Misconception[];
  /** Facit som text, för ledtråd 4 och föräldravyn. */
  facitText: string;
}

export interface TemplateDef<P> {
  id: string;
  skill: string;
  area: AreaId;
  level: Level;
  title: string;
  generate(rng: Rng): P;
  build(p: P): TaskBody;
  /** Facit räknat på ett annat sätt än i build(), för testerna. */
  verify(p: P): Q;
  /** Villkor som varje variant måste uppfylla. Returnerar brutna villkor. */
  constraints(p: P): string[];
}

export interface Task extends TaskBody {
  templateId: string;
  seed: number;
  skill: string;
  area: AreaId;
  level: Level;
}

/** En mall med typen för parametrarna dold, så att mallar kan ligga i samma lista. */
export interface Template {
  id: string;
  skill: string;
  area: AreaId;
  level: Level;
  title: string;
  instantiate(seed: number): Task;
  /** För testerna: facit, oberoende facit och brutna villkor för ett frö. */
  audit(seed: number): { task: Task; verified: Q; violations: string[] };
}

export function defineTemplate<P>(def: TemplateDef<P>): Template {
  const make = (seed: number): { p: P; task: Task } => {
    const p = def.generate(new Rng(seed));
    const body = def.build(p);
    return {
      p,
      task: { ...body, templateId: def.id, seed, skill: def.skill, area: def.area, level: def.level },
    };
  };
  return {
    id: def.id,
    skill: def.skill,
    area: def.area,
    level: def.level,
    title: def.title,
    instantiate: (seed) => make(seed).task,
    audit: (seed) => {
      const { p, task } = make(seed);
      return { task, verified: def.verify(p), violations: def.constraints(p) };
    },
  };
}

/** Hjälpare för villkor: samla de som inte håller. */
export function check(rules: Record<string, boolean>): string[] {
  return Object.entries(rules)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
}

/** Lägg bara till felmönster som ger ett giltigt och från facit skilt värde. */
export function misconceptions(facit: Q, list: Array<Misconception | null>): Misconception[] {
  const seen: Q[] = [facit];
  const out: Misconception[] = [];
  for (const m of list) {
    if (!m || seen.some((v) => v.eq(m.value))) continue;
    seen.push(m.value);
    out.push(m);
  }
  return out;
}

/** Ett felmönster vars värde kan vara odefinierat (t.ex. division med 0). */
export function mis(id: string, value: () => Q, feedback: string): Misconception | null {
  try {
    return { id, value: value(), feedback };
  } catch {
    return null;
  }
}
