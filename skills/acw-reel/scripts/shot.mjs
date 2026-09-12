// Grab a single frame at a given time: node shot.mjs <file url> <ms> <out.png>
import fs from 'node:fs';

const URL_ = process.argv[2];
const MS   = Number(process.argv[3]);
const OUT  = process.argv[4];

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = list.find(t => t.type === 'page');
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
await send('Runtime.evaluate', { expression: `window.__seek(${MS})`, returnByValue: true });
await new Promise(r => setTimeout(r, 200));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
const data = shot.result?.result?.data ?? shot.result?.data;
if (!data) throw new Error('no screenshot');
fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
console.log('wrote', OUT);
ws.close();
process.exit(0);
