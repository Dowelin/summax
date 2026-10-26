/**
 * Ritar texter med matematik inom $…$ som HTML med boktypografi:
 * staplade bråk, riktiga minustecken, kursiva variabler.
 * Notationen beskrivs i core/format.ts.
 */

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Löptext med inbäddad matematik. */
export function rich(text: string): string {
  return text
    .split('$')
    .map((part, i) => (i % 2 === 1 ? `<span class="math">${math(part)}</span>` : esc(part)))
    .join('');
}

const OPS = new Set(['+', '=', '·', '÷', '×', '<', '>', '≤', '≥', '/']);

/** Ett matematiskt uttryck i notationen {a/b}, 2{1/3}, x, ·, -. */
export function math(src: string): string {
  let out = '';
  let i = 0;
  let prev: 'start' | 'op' | 'value' = 'start';
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '{') {
      const end = matching(src, i);
      const inner = src.slice(i + 1, end);
      const slash = topLevelSlash(inner);
      if (slash >= 0) {
        out += `<span class="frac"><span class="num">${math(inner.slice(0, slash))}</span><span class="den">${math(inner.slice(slash + 1))}</span></span>`;
      } else {
        out += math(inner);
      }
      i = end + 1;
      prev = 'value';
      continue;
    }
    if (ch === ' ') {
      i++;
      continue;
    }
    if (ch === '-') {
      out += prev === 'value' ? '<span class="op">−</span>' : '<span class="neg">−</span>';
      prev = prev === 'value' ? 'op' : prev;
      i++;
      continue;
    }
    if (OPS.has(ch)) {
      out += `<span class="op">${esc(ch)}</span>`;
      prev = 'op';
      i++;
      continue;
    }
    if (ch === '(') {
      out += '(';
      prev = 'start';
      i++;
      continue;
    }
    const num = /^[0-9][0-9, ]*/.exec(src.slice(i));
    if (num) {
      out += `<span class="mn">${esc(num[0].replace(/,$/, ''))}</span>`;
      if (num[0].endsWith(',')) out += ',';
      i += num[0].length;
      prev = 'value';
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out += `<i class="mi">${ch}</i>`;
      i++;
      prev = 'value';
      continue;
    }
    out += esc(ch);
    prev = ch === ')' || ch === '%' ? 'value' : prev;
    i++;
  }
  return out;
}

function matching(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    if (s[i] === '}' && --depth === 0) return i;
  }
  return s.length - 1;
}

function topLevelSlash(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    else if (s[i] === '/' && depth === 0) return i;
  }
  return -1;
}
