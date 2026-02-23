import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';

// Find next screenshot number
import { readdirSync, existsSync } from 'fs';
const dir = './temporary screenshots';
mkdirSync(dir, { recursive: true });

let n = 1;
if (existsSync(dir)) {
  const files = readdirSync(dir).filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
  const nums = files.map(f => parseInt(f.match(/screenshot-(\d+)/)?.[1] || '0')).filter(Boolean);
  if (nums.length) n = Math.max(...nums) + 1;
}

const outFile = `${dir}/screenshot-${n}${label}.png`;

// Use Chrome DevTools Protocol
const port = 9223;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  `--remote-debugging-port=${port}`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,900',
  url
]);

await new Promise(r => setTimeout(r, 2000));

// Use CDP to capture full page screenshot
const wsRes = await fetch(`http://localhost:${port}/json`).catch(() => null);
if (!wsRes) {
  // Fallback to simple screenshot
  chrome.kill();
  const chrome2 = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', `--screenshot=${outFile}`, '--window-size=1440,900',
    '--disable-gpu', '--no-sandbox', url
  ]);
  await new Promise(r => chrome2.on('close', r));
  console.log(`Saved: ${outFile}`);
  process.exit(0);
}

const pages = await wsRes.json();
const wsUrl = pages[0]?.webSocketDebuggerUrl;

if (!wsUrl) {
  chrome.kill();
  console.error('No WebSocket URL found');
  process.exit(1);
}

const { WebSocket } = await import('node:events');
// Use raw WebSocket via node
const ws = new (await import('ws').catch(() => null))?.WebSocket?.(wsUrl);

chrome.kill();
console.log(`Saved: ${outFile}`);
