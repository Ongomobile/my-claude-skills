import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.argv[2];
const OUT  = process.argv[3];
const FPS  = 30;

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
let page = list.find(t => t.type === 'page');
if (!page) throw new Error('no page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
await new Promise(r => ws.onopen = r);
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL_ });
await new Promise(r => setTimeout(r, 3500));

const t = await send('Runtime.evaluate', { expression: 'window.__total', returnByValue: true });
const total = t.result?.result?.value;
if (!total) throw new Error('harness not loaded: ' + JSON.stringify(t).slice(0, 400));

fs.mkdirSync(OUT, { recursive: true });
const frames = Math.round(total / 1000 * FPS);
for (let f = 0; f < frames; f++) {
  const ms = (f / FPS) * 1000;
  await send('Runtime.evaluate', { expression: `window.__seek(${ms})`, returnByValue: true });
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = shot.result?.result?.data ?? shot.result?.data;
  if (!data) throw new Error('no screenshot at frame ' + f);
  fs.writeFileSync(path.join(OUT, String(f).padStart(5, '0') + '.png'), Buffer.from(data, 'base64'));
  if (f % 60 === 0) process.stdout.write(`  ${f}/${frames}\n`);
}
console.log('done', frames, 'frames');
ws.close();
process.exit(0);
