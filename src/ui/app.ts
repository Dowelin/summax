import { Session, SESSION_LENGTH, type LevelStore, type Mode } from '../session.ts';
import { maxLevel, templateById } from '../tasks/registry.ts';
import { AREAS, type AreaId, type Level } from '../tasks/types.ts';
import { esc, rich } from './math.ts';
import { preview } from './preview.ts';

/**
 * Prototypens gränssnitt: startsida som innehållsförteckning och en
 * uppgiftsvy. Ingen inloggning ännu – nivåerna sparas bara i webbläsaren.
 */

const LEVEL_KEY = 'summax.levels.v1';

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

function levelOf(area: AreaId): Level {
  return Math.min(levels.get(area) ?? 2, maxLevel(area)) as Level;
}

// ------------------------------------------------------------ Startsidan

function renderStart(): void {
  session = null;
  const areas = Object.entries(AREAS) as Array<[AreaId, (typeof AREAS)[AreaId]]>;
  root.innerHTML = `
    <main class="page start">
      <header class="masthead">
        <h1>SummaX</h1>
        <p class="lede">Välj var du vill börja. Ett pass är ${SESSION_LENGTH} uppgifter.</p>
      </header>
      <nav aria-label="Innehåll">
        <ol class="toc">
          <li><button class="toc-row toc-main" data-mode="blandat">
            <span class="toc-title">Blandat pass</span><span class="leader" aria-hidden="true"></span>
            <span class="toc-meta">alla områden</span>
          </button></li>
          ${areas
            .map(
              ([id, a]) => `<li><button class="toc-row" data-mode="${id}">
                <span class="toc-title">${esc(a.title)}</span><span class="leader" aria-hidden="true"></span>
                <span class="toc-meta">nivå ${levelOf(id)}</span>
              </button></li>`,
            )
            .join('')}
        </ol>
      </nav>
      <footer class="colophon">
        Prototyp. Ingen inloggning ännu, och inget sparas utanför den här webbläsaren.
      </footer>
    </main>`;
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => startSession(b.dataset.mode as Mode)),
  );
}

function startSession(mode: Mode): void {
  session = new Session(mode, levels);
  session.next();
  renderTask();
}

// ------------------------------------------------------------ Uppgiftsvyn

function renderTask(): void {
  if (!session) return renderStart();
  const rec = session.current!;
  const t = rec.task;
  const index = session.records.length;
  const mixed = session.mode === 'blandat';

  root.innerHTML = `
    <main class="page task">
      <header class="runhead">
        <button class="link back" data-action="home">Innehåll</button>
        <span class="where" data-where>${mixed ? '' : esc(AREAS[t.area].title)}</span>
        <span class="count">${index} / ${SESSION_LENGTH}</span>
      </header>

      <article class="exercise">
        <span class="exno" aria-hidden="true">${index}</span>
        <p class="prompt">${rich(t.prompt)}</p>
        ${t.figure ? `<div class="figure-wrap">${t.figure}</div>` : ''}
        ${t.instruction ? `<p class="instruction">${esc(t.instruction)}</p>` : ''}

        <form class="answer" autocomplete="off">
          <label for="svar">Svar</label>
          <input id="svar" name="svar" inputmode="text" spellcheck="false" autocapitalize="off" />
          <button type="submit" class="primary">Svara</button>
        </form>
        <p class="preview" aria-live="polite" data-preview></p>
        <p class="feedback" role="status" data-feedback></p>

        <ol class="hints" data-hints></ol>
        <div class="actions">
          <button class="link" data-action="hint">Visa ledtråd</button>
          <button class="primary next" data-action="next" hidden>${index >= SESSION_LENGTH ? 'Avsluta passet' : 'Nästa uppgift'}</button>
        </div>
      </article>
    </main>`;

  const form = root.querySelector<HTMLFormElement>('form.answer')!;
  const input = root.querySelector<HTMLInputElement>('#svar')!;
  const prev = root.querySelector<HTMLElement>('[data-preview]')!;
  const fb = root.querySelector<HTMLElement>('[data-feedback]')!;
  const hintList = root.querySelector<HTMLOListElement>('[data-hints]')!;
  const hintBtn = root.querySelector<HTMLButtonElement>('[data-action="hint"]')!;
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-action="next"]')!;

  const updateHintButton = (): void => {
    const n = rec.hintsShown;
    hintBtn.textContent = n === 0 ? 'Visa ledtråd' : n === 3 ? 'Visa lösningen' : `Visa ledtråd ${n + 1}`;
    hintBtn.hidden = n >= 4 || rec.outcome !== undefined;
  };

  const finish = (): void => {
    input.readOnly = true;
    form.querySelector('button')!.hidden = true;
    hintBtn.hidden = true;
    nextBtn.hidden = false;
    if (mixed) root.querySelector('[data-where]')!.textContent = AREAS[t.area].title;
    nextBtn.focus();
  };

  const addHint = (text: string, i: number): void => {
    const li = document.createElement('li');
    li.className = i === 3 ? 'hint solution' : 'hint';
    li.innerHTML = `<span class="hint-label">${i === 3 ? 'Lösning' : `Ledtråd ${i + 1}`}</span> ${rich(text)}`;
    hintList.append(li);
  };

  input.addEventListener('input', () => {
    const p = preview(input.value);
    prev.innerHTML = p.html;
    prev.classList.toggle('unreadable', !p.ok && input.value.trim() !== '');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (rec.outcome) return;
    const r = session!.submit(input.value);
    fb.textContent = r.feedback;
    fb.className = `feedback ${r.result.verdict}`;
    if (r.result.verdict === 'incorrect' && !r.done) {
      input.select();
    }
    if (r.done) {
      if (r.outcome === 'not-solved') {
        for (let i = rec.hintsShown; i < 4; i++) addHint(t.hints[i]!, i);
        rec.hintsShown = 4;
      }
      finish();
    }
  });

  hintBtn.addEventListener('click', () => {
    const i = rec.hintsShown;
    const h = session!.showHint();
    if (h === undefined) return;
    addHint(h, i);
    updateHintButton();
    if (rec.outcome) {
      fb.textContent = '';
      finish();
    } else {
      input.focus();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (session!.finished) return renderSummary();
    session!.next();
    renderTask();
  });

  root.querySelector('[data-action="home"]')!.addEventListener('click', renderStart);
  updateHintButton();
  input.focus();
}

// ------------------------------------------------------------ Sammanfattning

function renderSummary(): void {
  if (!session) return renderStart();
  const s = session.summary();
  const parts = [
    `${s.strong} utan hjälp`,
    s.withHelp ? `${s.withHelp} med ledtråd eller fler försök` : '',
    s.notSolved ? `${s.notSolved} där du fick se lösningen` : '',
  ].filter(Boolean);
  root.innerHTML = `
    <main class="page summary">
      <h1>Passet är klart</h1>
      <p class="lede">${s.total} uppgifter: ${esc(parts.join(', '))}.</p>
      <div class="actions">
        <button class="primary" data-action="again">Ett pass till</button>
        <button class="link" data-action="home">Innehåll</button>
      </div>
    </main>`;
  const mode = session.mode;
  root.querySelector('[data-action="again"]')!.addEventListener('click', () => startSession(mode));
  root.querySelector('[data-action="home"]')!.addEventListener('click', renderStart);
  root.querySelector<HTMLButtonElement>('[data-action="again"]')!.focus();
}

// ------------------------------------------------------------ Start

/** #uppgift=<mall>:<frö> öppnar en bestämd uppgift, för felsökning. */
function fromHash(): boolean {
  const m = /^#uppgift=([^:]+):(\d+)$/.exec(location.hash);
  if (!m) return false;
  const tpl = templateById(decodeURIComponent(m[1]!));
  if (!tpl) return false;
  session = new Session(tpl.area, levels);
  session.records.push({ task: tpl.instantiate(Number(m[2])), attempts: [], hintsShown: 0 });
  renderTask();
  return true;
}

if (!fromHash()) renderStart();
