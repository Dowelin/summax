// Bygger dist/: kompilerar TypeScript till JavaScript-moduler och kopierar
// de statiska filerna. Inga andra verktyg behövs än TypeScript.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

const localTsc = 'node_modules/.bin/tsc';
const tsc = existsSync(localTsc) ? localTsc : 'tsc';
execFileSync(tsc, ['-p', 'tsconfig.build.json'], { stdio: 'inherit' });

for (const f of ['index.html', 'styles.css']) cpSync(f, `dist/${f}`);
// Förhandsversionen som publiceras som claude.ai-artifact.
cpSync('scripts/artifact.html', 'dist/summax-prototyp.html');
console.log('Byggt till dist/');
