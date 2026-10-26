// En minimal lokal webbserver för dist/, för att prova appen: npm run build && npm run serve
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT ?? 5173);

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join('dist', path.endsWith('/') ? `${path}index.html` : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Hittades inte');
  }
}).listen(port, () => console.log(`SummaX på http://localhost:${port}`));
