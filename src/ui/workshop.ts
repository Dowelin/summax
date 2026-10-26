import {
  allBalanced,
  applyToPart,
  combine,
  imbalanceMessage,
  isBalanced,
  start,
  toAnswer,
  toMarkup,
  whyNotCombine,
  type Kind,
  type Part,
  type WorkState,
} from '../tasks/fractionWork.ts';
import type { Task } from '../tasks/types.ts';
import { esc } from './math.ts';

/**
 * Bråkverkstaden i gränssnittet. Samuel klickar på en täljare eller nämnare,
 * väljer · eller : och ett tal, och skriver själv vad det blir. Ett bråk som
 * bara ändrats på ena stället markeras tills han gjort samma sak på det andra.
 */

export interface WorkshopHooks {
  /** En korrekt omskrivning av hela uttrycket: skrivs som en rad i räknehäftet. */
  onStep(markup: string): void;
  /** Det senaste steget ångrades: ta bort dess rad. */
  onUndoStep(): void;
  /** Ett räknefel i verkstaden: räknas som hjälp, inte som försök. */
  onMistake(): void;
  /** Samuel vill lämna resultatet som svar. */
  onAnswer(text: string): void;
}

const PART_NAME: Record<Part, string> = { n: 'Täljaren', d: 'Nämnaren' };

export function mountWorkshop(host: HTMLElement, task: Task, hooks: WorkshopHooks): { disable(): void } {
  const work = task.work!;
  let state: WorkState = start(work.terms, work.ops);
  const history: Array<{ state: WorkState; wroteLine: boolean }> = [];
  let selected: { index: number; part: Part } | null = null;
  let kind: Kind = 'mul';
  let combining = false;
  let disabled = false;

  host.classList.add('workshop');
  host.innerHTML = `
    <p class="ws-howto">Klicka på en täljare eller nämnare för att multiplicera eller dividera den.</p>
    <div class="ws-expr" data-expr></div>
    <div class="ws-panel" data-panel hidden></div>
    <p class="ws-msg" role="status" data-msg></p>
    <div class="ws-actions">
      <button class="link" data-undo>Ångra</button>
      <button class="primary" data-use hidden>Använd som svar</button>
    </div>`;
  const exprEl = host.querySelector<HTMLElement>('[data-expr]')!;
  const panel = host.querySelector<HTMLElement>('[data-panel]')!;
  const msg = host.querySelector<HTMLElement>('[data-msg]')!;
  const undoBtn = host.querySelector<HTMLButtonElement>('[data-undo]')!;
  const useBtn = host.querySelector<HTMLButtonElement>('[data-use]')!;

  const say = (text: string, cls = ''): void => {
    msg.textContent = text;
    msg.className = `ws-msg ${cls}`;
  };

  const commit = (next: WorkState): void => {
    const wroteLine = allBalanced(next);
    history.push({ state, wroteLine });
    state = next;
    selected = null;
    combining = false;
    if (wroteLine) hooks.onStep(toMarkup(state));
    render();
  };

  const renderExpr = (): string => {
    const parts: string[] = [];
    state.terms.forEach((t, i) => {
      if (i > 0) parts.push(`<span class="ws-op">${state.ops[i - 1] === '+' ? '+' : '−'}</span>`);
      const changed = !isBalanced(t);
      const sel = (p: Part): string => (selected?.index === i && selected.part === p ? ' selected' : '');
      parts.push(`<span class="ws-frac${changed ? ' changed' : ''}">
        <button class="ws-part ws-n${sel('n')}" data-i="${i}" data-part="n" aria-label="Täljaren ${t.n} i bråk ${i + 1}">${t.n}</button>
        <span class="ws-bar" aria-hidden="true"></span>
        <button class="ws-part ws-d${sel('d')}" data-i="${i}" data-part="d" aria-label="Nämnaren ${t.d} i bråk ${i + 1}">${t.d}</button>
      </span>`);
    });
    if (state.terms.length > 1 && whyNotCombine(state) === null) {
      parts.push(`<button class="ws-combine" data-combine>Slå ihop</button>`);
    }
    return parts.join('');
  };

  const renderPanel = (): void => {
    if (combining) {
      const d = state.terms[0]!.d;
      const sum = state.terms.map((t, i) => (i === 0 ? `${t.n}` : `${state.ops[i - 1] === '+' ? '+' : '−'} ${t.n}`)).join(' ');
      panel.innerHTML = `
        <p class="ws-panel-title">Slå ihop bråken. Nämnaren är ${d}. Vad blir täljaren?</p>
        <div class="ws-row">
          <span class="ws-calc">${esc(sum)} =</span>
          <input id="ws-result" class="ws-num" inputmode="numeric" autocomplete="off" aria-label="Den nya täljaren" />
          <button class="primary" data-apply>Slå ihop</button>
          <button class="link" data-cancel>Avbryt</button>
        </div>`;
      panel.hidden = false;
      panel.querySelector<HTMLInputElement>('#ws-result')!.focus();
      return;
    }
    if (!selected) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    const t = state.terms[selected.index]!;
    const value = t[selected.part];
    panel.innerHTML = `
      <p class="ws-panel-title">${PART_NAME[selected.part]} ${value}</p>
      <div class="ws-row">
        <span class="ws-toggle" role="group" aria-label="Räknesätt">
          <button class="${kind === 'mul' ? 'on' : ''}" data-kind="mul" aria-pressed="${kind === 'mul'}">· multiplicera</button>
          <button class="${kind === 'div' ? 'on' : ''}" data-kind="div" aria-pressed="${kind === 'div'}">: dividera</button>
        </span>
      </div>
      <div class="ws-row">
        <span class="ws-calc">${value} <span data-sign>${kind === 'mul' ? '·' : ':'}</span></span>
        <input id="ws-k" class="ws-num" inputmode="numeric" autocomplete="off" aria-label="Med vilket tal" />
        <span class="ws-calc">=</span>
        <input id="ws-result" class="ws-num" inputmode="numeric" autocomplete="off" aria-label="Resultat" />
        <button class="primary" data-apply>Gör det</button>
        <button class="link" data-cancel>Avbryt</button>
      </div>`;
    panel.hidden = false;
    panel.querySelector<HTMLInputElement>('#ws-k')!.focus();
  };

  const render = (): void => {
    exprEl.innerHTML = renderExpr();
    renderPanel();
    undoBtn.hidden = history.length === 0 || disabled;
    useBtn.hidden = state.terms.length !== 1 || !allBalanced(state) || disabled;
    const unbalanced = state.terms.map(imbalanceMessage).find((m) => m !== null);
    if (unbalanced) say(unbalanced, 'warn');
    else if (!msg.classList.contains('incorrect')) say('');
    if (disabled) host.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
  };

  const readInt = (id: string): number | null => {
    const raw = panel.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? '';
    return /^-?\d+$/.test(raw) ? Number(raw) : null;
  };

  const apply = (): void => {
    if (combining) {
      const r = readInt('ws-result');
      if (r === null) return say('Skriv den nya täljaren som ett heltal.', 'info');
      const res = combine(state, r);
      if (!res.ok) {
        hooks.onMistake();
        return say(res.message, 'incorrect');
      }
      say('');
      return commit(res.state);
    }
    if (!selected) return;
    const k = readInt('ws-k');
    const r = readInt('ws-result');
    if (k === null) return say('Skriv med vilket tal.', 'info');
    if (r === null) return say('Skriv vad det blir.', 'info');
    const res = applyToPart(state, selected.index, selected.part, kind, k, r);
    if (!res.ok) {
      if (!/heltal|2 eller större|jämnt/.test(res.message)) hooks.onMistake();
      return say(res.message, 'incorrect');
    }
    say('');
    commit(res.state);
  };

  host.addEventListener('click', (e) => {
    if (disabled) return;
    const target = (e.target as HTMLElement).closest('button');
    if (!target) return;
    if (target.matches('.ws-part')) {
      selected = { index: Number(target.dataset.i), part: target.dataset.part as Part };
      combining = false;
      say(state.terms.map(imbalanceMessage).find((m) => m !== null) ?? '', 'warn');
      exprEl.innerHTML = renderExpr();
      renderPanel();
    } else if (target.matches('[data-combine]')) {
      selected = null;
      combining = true;
      renderPanel();
    } else if (target.matches('[data-kind]')) {
      kind = target.dataset.kind as Kind;
      const k = panel.querySelector<HTMLInputElement>('#ws-k')?.value ?? '';
      renderPanel();
      panel.querySelector<HTMLInputElement>('#ws-k')!.value = k;
    } else if (target.matches('[data-apply]')) {
      apply();
    } else if (target.matches('[data-cancel]')) {
      selected = null;
      combining = false;
      render();
    } else if (target === undoBtn) {
      const prev = history.pop();
      if (prev) {
        state = prev.state;
        if (prev.wroteLine) hooks.onUndoStep();
      }
      selected = null;
      combining = false;
      say('');
      render();
    } else if (target === useBtn) {
      const a = toAnswer(state);
      if (a) hooks.onAnswer(a);
    }
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const k = panel.querySelector<HTMLInputElement>('#ws-k');
      if (document.activeElement === k) panel.querySelector<HTMLInputElement>('#ws-result')!.focus();
      else apply();
    } else if (e.key === 'Escape') {
      selected = null;
      combining = false;
      render();
    }
  });

  panel.addEventListener('input', (e) => {
    if ((e.target as HTMLElement).id === 'ws-k' && msg.classList.contains('incorrect')) say('');
  });

  render();
  return {
    disable: () => {
      disabled = true;
      selected = null;
      combining = false;
      render();
    },
  };
}
