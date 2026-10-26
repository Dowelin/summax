import { equationTemplates } from './equations.ts';
import { fractionTemplates } from './fractions.ts';
import { geometryTemplates } from './geometry.ts';
import { percentTemplates } from './percent.ts';
import type { AreaId, Level, Template } from './types.ts';

export const TEMPLATES: readonly Template[] = [
  ...fractionTemplates,
  ...percentTemplates,
  ...equationTemplates,
  ...geometryTemplates,
];

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export function templateById(id: string): Template | undefined {
  return byId.get(id);
}

export function templatesFor(area: AreaId, level: Level): Template[] {
  return TEMPLATES.filter((t) => t.area === area && t.level === level);
}

/** Högsta nivå som finns i ett område just nu. */
export function maxLevel(area: AreaId): Level {
  return Math.max(...TEMPLATES.filter((t) => t.area === area).map((t) => t.level)) as Level;
}
