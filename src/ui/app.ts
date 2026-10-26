import { Session, SESSION_LENGTH, type LevelStore, type Mode, type TaskRecord } from '../session.ts';
import { maxLevel, templateById } from '../tasks/registry.ts';
import { AREAS, type AreaId, type Level } from '../tasks/types.ts';
import { checkCalcLine, checkLine, markupToPlain } from '../tasks/workpad.ts';
import { createMathInput, mathLiveReady, setUseMathLive, usingMathLive, type MathInput } from './input.ts';
import { esc, math, rich } from './math.ts';
import { mountWorkshop } from './workshop.ts';

/**
 * Gränssnittet: en lärobok med kapitel i egna färger och ett tumregister i
 * kanten, och ett räknehäfte med rutat papper där Samuel skriver.
 * Ingen inloggning ännu – nivåerna sparas bara i webbläsaren.
 */

const LEVEL_KEY = 'summax.levels.v1';
const AREA_IDS = Object.keys(AREAS) as AreaId[];

function browserLevels(): LevelStore {
  let data: Partial<Record<AreaId, Level>> = {};
  try {
    data = JSON.parse(localStorage.getItem(LEVEL_KEY) ?? '{}') as typeof data;
  } catch {
    data = {};
  }
  return {
    get: (a) => data[a],
    set: (a, l) => {
      data[a] = l;
      try {
        localStorage.setItem(LEVEL_KEY, JSON.stringify(data));
      } catch {
        /* privat läge: nivåerna gäller bara passet */
      }
    },
  };
}

const levels = browserLevels();
const root = document.getElementById('app')!;
let session: Session | null = null;

const levelOf = (area: AreaId): Level => Math.min(levels.get(area) ?? 2, maxLevel(area)) as Level;
const chColor = (mode: Mode): string => `var(--ch-${mode})`;

/** Tumregistret: en flik per kapitel i sidans kant, som i en tryckt lärobok. */
function thumbIndex(active?: AreaId): string {
  return `<nav class="thumbs" aria-label="Kapitel">${AREA_IDS.map((id) => {
    const a = AREAS[id];
    const on = active === undefined || active === id;
    return `<button class="thumb${on ? '' : ' dim'}" data-mode="${id}" style="--ch:${chColor(id)}" ${active ? 'tabindex="-1"' : ''}
      aria-label="Kapitel ${a.chapter}, ${esc(a.title)}"><span>${esc(a.tab)}</span></button>`;
  }).join('')}</nav>`;
}

// ------------------------------------------------------------ Innehåll

function renderStart(): void {
  session = null;
  root.innerHTML = `
    <div class="desk">
      <main class="sheet start">
        ${thumbIndex()}
        <header class="cover">
          <p class="wordmark">Summa<span>X</span></p>
          <h1>Innehåll</h1>
        </header>

        <button class="mixed" data-mode="blandat">
          <span class="mixed-title">Blandat pass</span>
          <span class="mixed-sub">${SESSION_LENGTH} uppgifter från alla kapitel</span>
        </button>

        <ol class="chapters">
          ${AREA_IDS.map((id) => {
            const a = AREAS[id];
            const lvl = levelOf(id);
            const max = maxLevel(id);
            const boxes = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
            return `<li><button class="chapter" data-mode="${id}" style="--ch:${chColor(id)}">
              <span class="ch-no">${a.chapter}</span>
              <span class="ch-text">
                <span class="ch-title">${esc(a.title)}</span>
                <span class="ch-about">${esc(a.about)}</span>
              </span>
              <span class="ch-level">
                <span class="boxes" aria-hidden="true">${boxes}</span>
                <span class="ch-level-text">nivå ${lvl} av ${max}</span>
              </span>
            </button></li>`;
          }).join('')}
        </ol>

        <p class="colophon">Prototyp. Ingen inloggning ännu, och nivåerna sparas bara i den här webbläsaren.</p>
      </main>
    </div>`;
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => void startSession(b.dataset.mode as Mode)),
  );
}

async function startSession(mode: Mode): Promise<void> {
  setUseMathLive(await mathLiveReady());
  session = new Session(mode, levels);
  session.next();
  renderTask();
}

// ------------------------------------------------------------ Uppgift

function progress(s: Session): string {
  const cells = Array.from({ length: SESSION_LENGTH }, (_, i) => {
    const r = s.records[i];
    const cls = !r ? '' : r.outcome ? 'done' : 'now';
    return `<i class="${cls}"></i>`;
  }).join('');
  return `<span class="progress" aria-label="Uppgift ${s.records.length} av ${SESSION_LENGTH}">
    <span class="cells" aria-hidden="true">${cells}</span>
    <span class="count">${s.records.length} / ${SESSION_LENGTH}</span>
  </span>`;
}

function renderTask(): void {
  if (!session) return renderStart();
  const s = session;
  const rec = s.current!;
  const t = rec.task;
  const index = s.records.length;
  const mixed = s.mode === 'blandat';
  const area = AREAS[t.area];
  /** Ekvationer: varje rad är en ekvation, svaret skrivs som x = … */
  const equations = t.area === 'ekvationer';
  const givenEq = /^Lös ekvationen \$(.+)\$$/.exec(t.prompt)?.[1];
  const givenCalc = /^Beräkna \$(.+)\$$/.exec(t.prompt)?.[1];
  const given = givenEq ?? givenCalc;

  const workshop = t.work !== undefined;
  const howto = workshop
    ? 'Arbeta direkt i bråken här ovanför, eller skriv egna rader. Svaret skrivs på svarsraden.'
    : equations
    ? `Skriv ett steg per rad och tryck Enter. Varje rad kontrolleras. Skriv <span class="math">${math('x =')}</span> … när du är klar.`
    : `Räkna på raderna och tryck Enter för en ny rad. Varje likhetstecken kontrolleras. Skriv svaret på svarsraden.`;

  root.innerHTML = `
    <div class="desk">
      <main class="sheet task" style="--ch:${chColor(t.area)}">
        ${thumbIndex(t.area)}
        <header class="runhead">
          <button class="link" data-action="home">Innehåll</button>
          <span class="chapter-name" data-where>${mixed ? 'Blandat pass' : esc(area.title)}</span>
          ${progress(s)}
        </header>

        <article class="exercise">
          <span class="exno" aria-hidden="true">${index}</span>
          <div class="exbody">
            <p class="prompt">${rich(t.prompt)}</p>
            ${t.figure ? `<div class="figure-wrap">${t.figure}</div>` : ''}
            ${t.instruction ? `<p class="instruction">${esc(t.instruction)}</p>` : ''}
          </div>
        </article>

        <section class="notebook" aria-label="Räknehäfte">
          ${workshop ? '<div data-workshop></div>' : `<p class="howto">${howto}</p>`}
          <ol class="lines" data-lines>
            ${given ? `<li class="line given"><span class="mark"></span><span class="given-eq math">${math(given)}</span></li>` : ''}
          </ol>
          ${workshop ? '<button class="link add-line" data-add-line>Skriv en egen rad</button>' : ''}
          ${equations ? '' : '<div class="answer-row" data-answer></div>'}
          <p class="feedback" role="status" data-feedback></p>
        </section>

        <ol class="hints" data-hints></ol>
        <div class="actions">
          <button class="link" data-action="hint">Visa ledtråd</button>
          <button class="primary" data-action="next" hidden>${index >= SESSION_LENGTH ? 'Avsluta passet' : 'Nästa uppgift'}</button>
        </div>
      </main>
    </div>`;

  const linesEl = root.querySelector<HTMLOListElement>('[data-lines]')!;
  const answerRow = root.querySelector<HTMLDivElement>('[data-answer]');
  const fb = root.querySelector<HTMLElement>('[data-feedback]')!;
  const hintList = root.querySelector<HTMLOListElement>('[data-hints]')!;
  const hintBtn = root.querySelector<HTMLButtonElement>('[data-action="hint"]')!;
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-action="next"]')!;
  const inputs: MathInput[] = [];
  const scratch: Array<{ input: MathInput; li: HTMLLIElement; last?: string }> = [];

  const say = (text: string, cls = ''): void => {
    fb.textContent = text;
    fb.className = `feedback ${cls}`;
  };

  const updateHintButton = (): void => {
    const n = rec.hintsShown;
    hintBtn.textContent = n === 0 ? 'Visa ledtråd' : n === 3 ? 'Visa lösningen' : `Visa ledtråd ${n + 1}`;
    hintBtn.hidden = n >= 4 || rec.outcome !== undefined;
  };

  const finish = (): void => {
    ws?.disable();
    root.querySelector<HTMLButtonElement>('[data-add-line]')?.setAttribute('hidden', '');
    inputs.forEach((i) => i.setReadOnly(true));
    root.querySelectorAll<HTMLButtonElement>('.line-btn').forEach((b) => (b.hidden = true));
    hintBtn.hidden = true;
    nextBtn.hidden = false;
    root.querySelector('.progress')!.outerHTML = progress(s);
    if (mixed) root.querySelector('[data-where]')!.textContent = area.title;
    nextBtn.focus();
  };

  const addHint = (text: string, i: number): void => {
    const li = document.createElement('li');
    li.className = i === 3 ? 'hint solution' : 'hint';
    li.innerHTML = `<span class="hint-label">${i === 3 ? 'Lösning' : `Ledtråd ${i + 1}`}</span><span>${rich(text)}</span>`;
    hintList.append(li);
  };

  const showSolution = (): void => {
    for (let i = rec.hintsShown; i < 4; i++) addHint(t.hints[i]!, i);
    rec.hintsShown = 4;
  };

  const setMark = (line: HTMLElement, kind: 'right' | 'ok' | 'wrong' | ''): void => {
    line.dataset.mark = kind;
    line.querySelector('.mark')!.textContent = kind === 'right' || kind === 'ok' ? '✓' : kind === 'wrong' ? '?' : '';
  };

  /** Rättar ett svar och visar resultatet på raden. */
  const submitAnswer = (text: string, line: HTMLElement): void => {
    const r = s.submit(text);
    if (r.result.verdict === 'unreadable' || r.result.verdict === 'needs-form') {
      say(r.feedback, 'info');
      return;
    }
    setMark(line, r.result.verdict === 'correct' ? 'right' : 'wrong');
    say(r.feedback, r.result.verdict);
    if (r.done) {
      if (r.outcome === 'not-solved') showSolution();
      finish();
    }
  };

  const makeRow = (tag: 'li' | 'div', input: MathInput, label: string | null, button: string, primary: boolean): { row: HTMLElement; btn: HTMLButtonElement } => {
    const row = document.createElement(tag);
    row.className = 'line';
    row.innerHTML = `<span class="mark" aria-hidden="true"></span>${label ? `<span class="line-label">${label}</span>` : ''}`;
    const slot = document.createElement('div');
    slot.className = 'line-input';
    slot.append(input.el);
    const btn = document.createElement('button');
    btn.className = primary ? 'line-btn primary' : 'line-btn link';
    btn.textContent = button;
    row.append(slot, btn);
    return { row, btn };
  };

  /** Previous line's last expression, for lines that begin with "=". */
  const previousLast = (li: HTMLLIElement): string | undefined => {
    const i = scratch.findIndex((x) => x.li === li);
    for (let k = i - 1; k >= 0; k--) if (scratch[k]!.last) return scratch[k]!.last;
    return givenCalc ? markupToPlain(givenCalc) : undefined;
  };

  const addScratchLine = (): MathInput => {
    const n = scratch.length + 1;
    const input = createMathInput({
      id: `rad-${n}`,
      label: `Rad ${n}`,
      kind: 'equation',
      ...(n === 1 ? { placeholder: equations ? 'nästa steg' : given ? '= …' : 'uträkning' } : {}),
    });
    inputs.push(input);
    const { row, btn } = makeRow('li', input, null, 'Kontrollera', false);
    const li = row as HTMLLIElement;
    const entry: { input: MathInput; li: HTMLLIElement; last?: string } = { input, li };
    scratch.push(entry);
    linesEl.append(li);

    const act = (): void => {
      if (rec.outcome) return;
      const isLast = scratch[scratch.length - 1] === entry;
      if (input.incomplete()) return say('Någon ruta är tom. Fyll i den först.', 'info');

      if (!equations) {
        const res = checkCalcLine(input.plain('equation'), previousLast(li));
        switch (res.kind) {
          case 'empty':
            if (answerRow) answer?.focus();
            return;
          case 'unreadable':
            setMark(li, '');
            return say(res.message, 'info');
          case 'wrong':
            entry.last = res.last;
            setMark(li, 'wrong');
            s.noteWrongStep();
            return say(res.message, 'incorrect');
          case 'ok':
          case 'noted':
            entry.last = res.last;
            setMark(li, res.kind === 'ok' ? 'ok' : '');
            say('');
            if (isLast) addScratchLine().focus();
            return;
        }
      }

      const res = checkLine(input.plain('equation'), t.answer.value);
      switch (res.kind) {
        case 'empty':
          return say('Skriv något på raden först.', 'info');
        case 'unreadable':
          setMark(li, '');
          return say(res.message, 'info');
        case 'step-wrong':
          setMark(li, 'wrong');
          s.noteWrongStep();
          return say(res.message, 'incorrect');
        case 'step-ok':
          setMark(li, 'ok');
          say('');
          if (isLast) addScratchLine().focus();
          return;
        case 'answer': {
          // "x = 2 2/5" rättas som det eleven skrev efter likhetstecknet.
          const answerText = input.plain('answer').replace(/^\s*x\s*=\s*|\s*=\s*x\s*$/gi, '');
          submitAnswer(answerText, li);
          if (!rec.outcome && li.dataset.mark === 'wrong') input.focus();
          return;
        }
      }
    };
    input.onEnter(act);
    btn.addEventListener('click', act);
    input.onInput(() => {
      if (li.dataset.mark && !rec.outcome) setMark(li, '');
    });
    return input;
  };

  let answer: MathInput | null = null;
  if (answerRow) {
    answer = createMathInput({ id: 'svar', label: 'Svar', kind: 'answer' });
    inputs.push(answer);
    const { row, btn } = makeRow('div', answer, 'Svar:', 'Svara', true);
    row.classList.add('answer-line');
    answerRow.append(row);
    const act = (): void => {
      if (rec.outcome) return;
      if (answer!.incomplete()) return say('Någon ruta är tom. Fyll i den först.', 'info');
      submitAnswer(answer!.plain('answer'), row);
    };
    answer.onEnter(act);
    btn.addEventListener('click', act);
    answer.onInput(() => {
      if (row.dataset.mark && !rec.outcome) setMark(row, '');
    });
  }

  const workshopHost = root.querySelector<HTMLElement>('[data-workshop]');
  const stepLines: HTMLLIElement[] = [];
  const ws = workshopHost
    ? mountWorkshop(workshopHost, t, {
        onStep: (markup) => {
          const li = document.createElement('li');
          li.className = 'line given';
          li.dataset.mark = 'ok';
          li.innerHTML = `<span class="mark" aria-hidden="true">✓</span><span class="given-eq math">${math(`= ${markup}`)}</span>`;
          linesEl.append(li);
          stepLines.push(li);
        },
        onUndoStep: () => stepLines.pop()?.remove(),
        onMistake: () => s.noteWrongStep(),
        onAnswer: (text) => {
          const row = root.querySelector<HTMLElement>('.answer-line')!;
          const shown = row.querySelector<HTMLElement>('.answer-from-workshop') ?? document.createElement('span');
          shown.className = 'answer-from-workshop math';
          shown.innerHTML = math(text.includes('/') ? `{${text}}` : text);
          row.querySelector('.line-input')!.prepend(shown);
          answer?.el.setAttribute('hidden', '');
          submitAnswer(text, row);
        },
      })
    : null;

  hintBtn.addEventListener('click', () => {
    const i = rec.hintsShown;
    const h = s.showHint();
    if (h === undefined) return;
    addHint(h, i);
    updateHintButton();
    if (rec.outcome) {
      say('');
      finish();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (s.finished) return renderSummary();
    s.next();
    renderTask();
  });

  root.querySelector('[data-action="home"]')!.addEventListener('click', renderStart);
  root.querySelectorAll<HTMLButtonElement>('.thumb').forEach((b) =>
    b.addEventListener('click', () => void startSession(b.dataset.mode as Mode)),
  );
  updateHintButton();
  if (workshop) {
    root.querySelector('[data-add-line]')!.addEventListener('click', () => addScratchLine().focus());
  } else {
    addScratchLine().focus();
  }
}

// ------------------------------------------------------------ Sammanfattning

function renderSummary(): void {
  if (!session) return renderStart();
  const s = session;
  const sum = s.summary();
  const rows = s.records
    .map((r: TaskRecord, i) => {
      const how = r.outcome === 'strong' ? 'utan hjälp' : r.outcome === 'with-help' ? 'med hjälp' : 'lösningen visad';
      const a = AREAS[r.task.area];
      return `<li style="--ch:${chColor(r.task.area)}"><span class="sum-no">${i + 1}</span><span class="sum-ch">${esc(a.title)}</span><span class="sum-how ${r.outcome}">${how}</span></li>`;
    })
    .join('');
  root.innerHTML = `
    <div class="desk">
      <main class="sheet summary">
        ${thumbIndex()}
        <header class="cover">
          <p class="wordmark">Summa<span>X</span></p>
          <h1>Passet är klart</h1>
          <p class="lede">${sum.strong} av ${sum.total} uppgifter utan hjälp.</p>
        </header>
        <ol class="sum-list">${rows}</ol>
        <div class="actions">
          <button class="primary" data-action="again">Ett pass till</button>
          <button class="link" data-action="home">Innehåll</button>
        </div>
      </main>
    </div>`;
  const mode = s.mode;
  root.querySelector('[data-action="again"]')!.addEventListener('click', () => void startSession(mode));
  root.querySelector('[data-action="home"]')!.addEventListener('click', renderStart);
  root.querySelectorAll<HTMLButtonElement>('.thumb').forEach((b) =>
    b.addEventListener('click', () => void startSession(b.dataset.mode as Mode)),
  );
  root.querySelector<HTMLButtonElement>('[data-action="again"]')!.focus();
}

// ------------------------------------------------------------ Start

/** #uppgift=<mall>:<frö> öppnar en bestämd uppgift, för felsökning. */
async function fromHash(): Promise<boolean> {
  const m = /^#uppgift=([^:]+):(\d+)$/.exec(location.hash);
  if (!m) return false;
  const tpl = templateById(decodeURIComponent(m[1]!));
  if (!tpl) return false;
  setUseMathLive(await mathLiveReady());
  session = new Session(tpl.area, levels);
  session.records.push({ task: tpl.instantiate(Number(m[2])), attempts: [], hintsShown: 0 });
  renderTask();
  return true;
}

document.documentElement.dataset.input = 'loading';
void mathLiveReady().then((ok) => {
  document.documentElement.dataset.input = ok ? 'mathlive' : 'text';
});
void fromHash().then((shown) => {
  if (!shown) renderStart();
});

/** För felsökning i konsolen. */
(globalThis as Record<string, unknown>).summax = { usingMathLive };
