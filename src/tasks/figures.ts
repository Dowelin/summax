/**
 * Tekniska figurer som SVG-text: svartvitt, med måttangivelser, som i en
 * lärobok. Ren textgenerering utan DOM, så att figurerna går att testa.
 * Färgerna sätts i CSS via klasserna fig-*.
 */

const MAX_W = 260;
const MAX_H = 170;
const PAD = 44;

interface Pt {
  x: number;
  y: number;
}

function scaleFor(w: number, h: number): number {
  return Math.min(MAX_W / w, MAX_H / h);
}

function svg(width: number, height: number, body: string, label: string): string {
  const w = Math.round(width + 2 * PAD);
  const h = Math.round(height + 2 * PAD);
  return `<svg class="figure" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

function poly(points: Pt[], cls = 'fig-shape'): string {
  const d = points.map((p) => `${r(p.x)},${r(p.y)}`).join(' ');
  return `<polygon class="${cls}" points="${d}"/>`;
}

function line(a: Pt, b: Pt, cls = 'fig-aux'): string {
  return `<line class="${cls}" x1="${r(a.x)}" y1="${r(a.y)}" x2="${r(b.x)}" y2="${r(b.y)}"/>`;
}

function text(p: Pt, s: string, anchor: 'start' | 'middle' | 'end' = 'middle'): string {
  return `<text class="fig-label" x="${r(p.x)}" y="${r(p.y)}" text-anchor="${anchor}" dominant-baseline="middle">${esc(s)}</text>`;
}

function rightAngle(corner: Pt, dx: number, dy: number, size = 9): string {
  const a = { x: corner.x + dx * size, y: corner.y };
  const b = { x: corner.x + dx * size, y: corner.y + dy * size };
  const c = { x: corner.x, y: corner.y + dy * size };
  return `<polyline class="fig-mark" points="${r(a.x)},${r(a.y)} ${r(b.x)},${r(b.y)} ${r(c.x)},${r(c.y)}"/>`;
}

const r = (n: number): string => (Math.round(n * 10) / 10).toString();

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Rektangel. Måtten styr proportionerna; etiketterna kan ha andra enheter. */
export function rectangle(w: number, h: number, wLabel: string, hLabel: string): string {
  const k = scaleFor(w, h);
  const W = Math.max(w * k, 40);
  const H = Math.max(h * k, 30);
  const o = { x: PAD, y: PAD };
  const body =
    poly([o, { x: o.x + W, y: o.y }, { x: o.x + W, y: o.y + H }, { x: o.x, y: o.y + H }]) +
    rightAngle({ x: o.x, y: o.y + H }, 1, -1) +
    text({ x: o.x + W / 2, y: o.y + H + 18 }, wLabel) +
    text({ x: o.x - 8, y: o.y + H / 2 }, hLabel, 'end');
  return svg(W, H, body, `Rektangel med sidorna ${wLabel} och ${hLabel}`);
}

/**
 * Triangel med basen nedtill och toppen förskjuten. Höjden ritas streckad
 * med rät vinkel. Den högra sidan får en etikett (en distraktor för arean).
 */
export function triangle(left: number, right: number, height: number, labels: { base: string; height: string; side: string }): string {
  const base = left + right;
  const k = scaleFor(base, height);
  const B = base * k;
  const H = height * k;
  const o = { x: PAD, y: PAD + H };
  const apex = { x: o.x + left * k, y: PAD };
  const foot = { x: apex.x, y: o.y };
  const end = { x: o.x + B, y: o.y };
  const mid = { x: (apex.x + end.x) / 2, y: (apex.y + end.y) / 2 };
  const body =
    poly([o, end, apex]) +
    line(apex, foot) +
    rightAngle(foot, 1, -1) +
    text({ x: o.x + B / 2, y: o.y + 18 }, labels.base) +
    text({ x: apex.x + 6, y: (apex.y + foot.y) / 2 + 6 }, labels.height, 'start') +
    text({ x: mid.x + 10, y: mid.y - 4 }, labels.side, 'start');
  return svg(B, H, body, `Triangel med basen ${labels.base}, höjden ${labels.height} och en sida ${labels.side}`);
}

/**
 * L-formad figur: en rektangel W × H där ett hörn uppe till höger är
 * borttaget. Etiketter på botten, vänster sida, översta kanten och högra kanten.
 */
export function lShape(
  W: number,
  H: number,
  cutW: number,
  cutH: number,
  labels: { bottom: string; left: string; top: string; right: string },
): string {
  const k = scaleFor(W, H);
  const o = { x: PAD, y: PAD };
  const P = (x: number, y: number): Pt => ({ x: o.x + x * k, y: o.y + y * k });
  const pts = [P(0, 0), P(W - cutW, 0), P(W - cutW, cutH), P(W, cutH), P(W, H), P(0, H)];
  const body =
    poly(pts) +
    text({ x: o.x + (W * k) / 2, y: o.y + H * k + 18 }, labels.bottom) +
    text({ x: o.x - 8, y: o.y + (H * k) / 2 }, labels.left, 'end') +
    text({ x: o.x + ((W - cutW) * k) / 2, y: o.y - 14 }, labels.top) +
    text({ x: o.x + W * k + 8, y: o.y + ((cutH + H) * k) / 2 }, labels.right, 'start');
  return svg(W * k, H * k, body, `Sammansatt figur med måtten ${labels.bottom}, ${labels.left}, ${labels.top} och ${labels.right}`);
}
