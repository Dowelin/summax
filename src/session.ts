import { grade, type GradeResult } from './core/grade.ts';
import { Rng, newSeed } from './core/rng.ts';
import { classify, feedbackFor, type ErrorClass } from './tasks/classify.ts';
import { maxLevel, templatesFor } from './tasks/registry.ts';
import { AREAS, type AreaId, type Level, type Task } from './tasks/types.ts';

/**
 * Ett träningspass om ett antal uppgifter. Nivåstyrningen här är medvetet
 * enkel och gäller bara prototypen: två säkra svar i rad höjer nivån, två
 * misslyckade sänker den. Den riktiga nivåmodellen (4 av 5 på två dagar,
 * osäker, avtagande) kommer när data sparas i Firebase.
 */

export const MAX_ATTEMPTS = 3;
export const SESSION_LENGTH = 10;

export type Outcome = 'strong' | 'with-help' | 'not-solved';

export interface AttemptLog {
  answer: string;
  verdict: GradeResult['verdict'];
  errorClass?: ErrorClass['kind'];
}

export interface TaskRecord {
  task: Task;
  attempts: AttemptLog[];
  hintsShown: number;
  /** Antal räknerader som inte stämde. Räknas som hjälp, inte som försök. */
  wrongSteps?: number;
  outcome?: Outcome;
}

export interface SubmitResult {
  result: GradeResult;
  /** Text till Samuel. */
  feedback: string;
  /** Uppgiften är avslutad (rätt, eller för många försök). */
  done: boolean;
  outcome?: Outcome;
}

export type Mode = AreaId | 'blandat';

export interface LevelStore {
  get(area: AreaId): Level | undefined;
  set(area: AreaId, level: Level): void;
}

export class Session {
  readonly mode: Mode;
  readonly records: TaskRecord[] = [];
  private readonly levels: LevelStore;
  private readonly streak: Partial<Record<AreaId, number>> = {};
  private readonly rng: Rng;

  constructor(mode: Mode, levels: LevelStore, seed = newSeed()) {
    this.mode = mode;
    this.levels = levels;
    this.rng = new Rng(seed);
  }

  get current(): TaskRecord | undefined {
    return this.records[this.records.length - 1];
  }

  get finished(): boolean {
    return this.records.length >= SESSION_LENGTH && this.current?.outcome !== undefined;
  }

  levelFor(area: AreaId): Level {
    return this.levels.get(area) ?? 2;
  }

  /** Nästa uppgift. Undviker samma mall två gånger i rad när det går. */
  next(): TaskRecord {
    const area = this.mode === 'blandat' ? this.nextMixedArea() : this.mode;
    let level = Math.min(this.levelFor(area), maxLevel(area)) as Level;
    let candidates = templatesFor(area, level);
    while (candidates.length === 0 && level > 1) {
      level = (level - 1) as Level;
      candidates = templatesFor(area, level);
    }
    const last = this.current?.task.templateId;
    const fresh = candidates.filter((t) => t.id !== last);
    const template = this.rng.pick(fresh.length > 0 ? fresh : candidates);
    const record: TaskRecord = { task: template.instantiate(newSeed()), attempts: [], hintsShown: 0 };
    this.records.push(record);
    return record;
  }

  private nextMixedArea(): AreaId {
    const areas = Object.keys(AREAS) as AreaId[];
    const recent = this.records.slice(-2).map((r) => r.task.area);
    const options = areas.filter((a) => !recent.includes(a));
    return this.rng.pick(options.length > 0 ? options : areas);
  }

  showHint(): string | undefined {
    const rec = this.current;
    if (!rec || rec.outcome || rec.hintsShown >= 4) return undefined;
    const hint = rec.task.hints[rec.hintsShown];
    rec.hintsShown++;
    // Ledtråd 4 är hela lösningen: då räknas uppgiften som inte löst.
    if (rec.hintsShown === 4) this.finish(rec, 'not-solved');
    return hint;
  }

  /** En räknerad som inte stämde: appen visade var det gick fel, alltså hjälp. */
  noteWrongStep(): void {
    const rec = this.current;
    if (rec && !rec.outcome) rec.wrongSteps = (rec.wrongSteps ?? 0) + 1;
  }

  submit(raw: string): SubmitResult {
    const rec = this.current;
    if (!rec || rec.outcome) throw new Error('Ingen aktiv uppgift');

    const result = grade(rec.task.answer, raw);
    if (result.verdict === 'unreadable' || result.verdict === 'needs-form') {
      // Räknas inte som försök.
      return { result, feedback: result.message, done: false };
    }

    const errorClass = result.verdict === 'incorrect' ? classify(rec.task, result) : undefined;
    rec.attempts.push({ answer: raw, verdict: result.verdict, ...(errorClass ? { errorClass: errorClass.kind } : {}) });

    if (result.verdict === 'correct') {
      const strong = rec.attempts.length === 1 && rec.hintsShown === 0 && !rec.wrongSteps;
      const outcome: Outcome = strong ? 'strong' : 'with-help';
      this.finish(rec, outcome);
      return { result, feedback: strong ? 'Rätt.' : 'Rätt – bra att du höll i.', done: true, outcome };
    }

    const wrong = rec.attempts.filter((a) => a.verdict === 'incorrect').length;
    if (wrong >= MAX_ATTEMPTS) {
      this.finish(rec, 'not-solved');
      return {
        result,
        feedback: `${feedbackFor(errorClass!)} Här är lösningen.`,
        done: true,
        outcome: 'not-solved',
      };
    }
    return { result, feedback: feedbackFor(errorClass!), done: false };
  }

  private finish(rec: TaskRecord, outcome: Outcome): void {
    if (rec.outcome) return;
    rec.outcome = outcome;
    const area = rec.task.area;
    const s = this.streak[area] ?? 0;
    if (outcome === 'strong') {
      const next = s >= 0 ? s + 1 : 1;
      if (next >= 2 && this.levelFor(area) < maxLevel(area)) {
        this.levels.set(area, (this.levelFor(area) + 1) as Level);
        this.streak[area] = 0;
      } else {
        this.streak[area] = next;
      }
    } else if (outcome === 'not-solved') {
      const next = s <= 0 ? s - 1 : -1;
      if (next <= -2 && this.levelFor(area) > 1) {
        this.levels.set(area, (this.levelFor(area) - 1) as Level);
        this.streak[area] = 0;
      } else {
        this.streak[area] = next;
      }
    } else {
      this.streak[area] = 0;
    }
  }

  summary(): { total: number; strong: number; withHelp: number; notSolved: number } {
    const done = this.records.filter((r) => r.outcome);
    return {
      total: done.length,
      strong: done.filter((r) => r.outcome === 'strong').length,
      withHelp: done.filter((r) => r.outcome === 'with-help').length,
      notSolved: done.filter((r) => r.outcome === 'not-solved').length,
    };
  }
}

/** Nivåer i minnet, för tester. */
export function memoryLevels(initial: Partial<Record<AreaId, Level>> = {}): LevelStore {
  const m = new Map(Object.entries(initial) as Array<[AreaId, Level]>);
  return { get: (a) => m.get(a), set: (a, l) => void m.set(a, l) };
}
