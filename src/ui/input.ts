import { hasPlaceholder, latexToPlain, type Mode } from '../core/latex.ts';
import { preview } from './preview.ts';
import { math } from './math.ts';

/**
 * Svarsfält. Med MathLive ritas matematiken medan Samuel skriver:
 * "/" ger ett staplat bråk, "^" en exponent. Om MathLive inte går att ladda
 * (till exempel om skolans nätverk blockerar det) används ett vanligt
 * textfält med förhandsvisning, så appen fungerar ändå.
 */

export interface InputOpts {
  id: string;
  label: string;
  kind: Mode;
  placeholder?: string;
}

export interface MathInput {
  readonly el: HTMLElement;
  /** Svaret som text för tolkarna. */
  plain(mode: Mode): string;
  /** Är något fält i bråk eller exponent lämnat tomt? */
  incomplete(): boolean;
  clear(): void;
  focus(): void;
  setReadOnly(on: boolean): void;
  onInput(cb: () => void): void;
  onEnter(cb: () => void): void;
}

type MathfieldLike = HTMLElement & {
  value: string;
  readOnly?: boolean;
  inlineShortcuts?: Record<string, string>;
  menuItems?: unknown[];
  smartMode?: boolean;
  mathModeSpace?: string;
  mathVirtualKeyboardPolicy?: string;
  placeholder?: string;
};

type MathfieldStatic = {
  decimalSeparator?: string;
  soundsDirectory?: string | null;
  keypressSound?: unknown;
  plonkSound?: unknown;
};

let ready: Promise<boolean> | null = null;

/** Väntar på att MathLive laddats. Ger false efter några sekunder om det inte går. */
export function mathLiveReady(timeoutMs = 4000): Promise<boolean> {
  if (ready) return ready;
  ready = new Promise<boolean>((resolve) => {
    if (new URLSearchParams(location.search).has('textfalt')) return resolve(false);
    const timer = setTimeout(() => resolve(false), timeoutMs);
    customElements.whenDefined('math-field').then(() => {
      clearTimeout(timer);
      const MF = customElements.get('math-field') as unknown as MathfieldStatic | undefined;
      if (MF) {
        try {
          MF.decimalSeparator = ',';
          MF.soundsDirectory = null;
          MF.keypressSound = null;
          MF.plonkSound = null;
        } catch {
          /* äldre versioner saknar någon inställning */
        }
      }
      resolve(true);
    });
  });
  return ready;
}

let useMathLive = false;
export function setUseMathLive(on: boolean): void {
  useMathLive = on;
}
export function usingMathLive(): boolean {
  return useMathLive;
}

export function createMathInput(opts: InputOpts): MathInput {
  return useMathLive ? mathfieldInput(opts) : textInput(opts);
}

function mathfieldInput(opts: InputOpts): MathInput {
  const mf = document.createElement('math-field') as MathfieldLike;
  mf.id = opts.id;
  mf.className = 'mathinput';
  mf.setAttribute('aria-label', opts.label);
  const set = (k: keyof MathfieldLike, v: unknown): void => {
    try {
      (mf as unknown as Record<string, unknown>)[k as string] = v;
    } catch {
      /* inställningen finns inte i den här versionen */
    }
  };
  set('smartMode', false);
  set('mathModeSpace', '\\,');
  set('mathVirtualKeyboardPolicy', 'auto');
  // Vissa inställningar kan bara sättas när fältet finns på sidan.
  const afterMount = (): void => {
    set('menuItems', []);
    set('inlineShortcuts', { '*': '\\cdot', '>=': '\\ge', '<=': '\\le' });
  };
  mf.addEventListener('mount', afterMount);
  afterMount();
  if (opts.placeholder) set('placeholder', `\\text{${opts.placeholder}}`);

  // När man skriver +, −, = eller · i en ifylld nämnare eller exponent hoppar
  // markören ut först, som när man skriver på papper: 3/4 + 1/2 blir två bråk,
  // inte ett bråk med nämnaren 4 + 1/2. Bygger på MathLives interna modell,
  // så allt är inslaget i try: fungerar det inte beter sig fältet som vanligt.
  mf.addEventListener(
    'keydown',
    (e) => {
      const key = (e as KeyboardEvent).key;
      if (key.length !== 1 || !'+-=*:<>'.includes(key)) return;
      try {
        const inner = (mf as unknown as { _mathfield?: { model?: { at(i: number): unknown } } })._mathfield;
        const atom = inner?.model?.at((mf as unknown as { position: number }).position) as
          | { type?: string; parentBranch?: string; parent?: { type?: string } }
          | undefined;
        if (!atom || atom.type === 'first') return;
        const inDenominator = atom.parent?.type === 'genfrac' && atom.parentBranch === 'below';
        const inExponent = atom.parentBranch === 'superscript';
        if (inDenominator || inExponent) {
          (mf as unknown as { executeCommand(c: string): boolean }).executeCommand('moveAfterParent');
        }
      } catch {
        /* intern modell saknas i den här versionen */
      }
    },
    { capture: true },
  );

  return {
    el: mf,
    plain: (mode) => latexToPlain(mf.value ?? '', mode),
    incomplete: () => hasPlaceholder(mf.value ?? ''),
    clear: () => set('value', ''),
    focus: () => mf.focus(),
    setReadOnly: (on) => {
      set('readOnly', on);
      mf.toggleAttribute('read-only', on);
    },
    onInput: (cb) => mf.addEventListener('input', cb),
    onEnter: (cb) =>
      mf.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          e.preventDefault();
          cb();
        }
      }),
  };
}

function textInput(opts: InputOpts): MathInput {
  const wrap = document.createElement('div');
  wrap.className = 'textinput';
  const input = document.createElement('input');
  input.id = opts.id;
  input.setAttribute('aria-label', opts.label);
  input.autocomplete = 'off';
  input.spellcheck = false;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  const prev = document.createElement('div');
  prev.className = 'textinput-preview';
  prev.setAttribute('aria-live', 'polite');
  wrap.append(input, prev);
  input.addEventListener('input', () => {
    const p = opts.kind === 'equation' ? equationPreview(input.value) : preview(input.value);
    prev.innerHTML = p.html;
    prev.classList.toggle('unreadable', !p.ok && input.value.trim() !== '');
  });

  return {
    el: wrap,
    plain: (mode) =>
      mode === 'equation' ? input.value.replace(/(\d+)\s+(\d+)\s*\/\s*(\d+)/g, '($1+$2/$3)') : input.value,
    incomplete: () => false,
    clear: () => {
      input.value = '';
      prev.innerHTML = '';
    },
    focus: () => input.focus(),
    setReadOnly: (on) => {
      input.readOnly = on;
    },
    onInput: (cb) => input.addEventListener('input', cb),
    onEnter: (cb) =>
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cb();
        }
      }),
  };
}

/** Förhandsvisning av en ekvationsrad: bråk ritas staplade, inget tolkas. */
function equationPreview(raw: string): { html: string; ok: boolean } {
  const t = raw.trim();
  if (t === '') return { html: '', ok: false };
  const markup = t
    .replace(/[{}$]/g, '')
    .replace(/(\d+|x|\([^()]*\))\s*\/\s*(\d+|x|\([^()]*\))/g, (_m, a: string, b: string) => `{${strip(a)}/${strip(b)}}`)
    .replace(/\*/g, '·');
  return { html: math(markup), ok: true };
}

const strip = (s: string): string => (/^\(.*\)$/.test(s) ? s.slice(1, -1) : s);
