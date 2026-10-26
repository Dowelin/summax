import { normalize, parseAnswer } from '../core/parse.ts';
import { math, esc } from './math.ts';

/**
 * Förhandsvisningen under svarsfältet visar hur appen har tolkat svaret,
 * så att en felskrivning syns innan Samuel skickar. Talet visas så som
 * han skrev det: 6/8 visas som 6/8, inte förkortat.
 */
export function preview(raw: string): { html: string; ok: boolean } {
  const p = parseAnswer(raw);
  if (p.kind === 'empty') return { html: '', ok: false };
  if (p.kind === 'invalid') return { html: 'Jag kan inte läsa svaret än.', ok: false };

  const s = normalize(raw);
  let numberPart = s;
  let suffix = '';
  if (p.kind === 'solution') {
    numberPart = s.slice(s.indexOf('=') + 1);
  } else if (p.kind === 'percent') {
    numberPart = s.replace(/\s*(%|procent)$/, '');
    suffix = ' %';
  } else if (p.kind === 'quantity') {
    numberPart = /^(.*[0-9])\s*[a-zåäö:][a-zåäö.²^:\-]*(?: ?2)?$/.exec(s)?.[1] ?? s;
    suffix = ` ${esc(p.unit.label)}`;
  }

  const m = /^(-?)(?:(\d+) )?(\d+) ?\/ ?(\d+)$/.exec(numberPart.trim());
  const markup = m ? `${m[1]}${m[2] ?? ''}{${m[3]}/${m[4]}}` : numberPart.trim().replace('.', ',');
  const prefix = p.kind === 'solution' ? `${math(`${p.variable} =`)} ` : '';
  return { html: `${prefix}${math(markup)}${suffix}`, ok: true };
}
