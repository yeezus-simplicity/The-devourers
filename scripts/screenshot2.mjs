import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'sepulcher_shot.png';
const waitMs = parseInt(process.argv[4] || '4000', 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--disable-features=msEdgeIdentity', '--window-size=1280,800'],
  defaultViewport: { width: 1280, height: 800 }
});

const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));

await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await sleep(1500);

// Click Play then select sepulcher
await page.evaluate(() => {
  const play = document.getElementById('btn-play');
  if (play) play.click();
});
await sleep(800);
await page.evaluate(() => {
  const card = document.querySelector('.char-card[data-char="sepulcher"]');
  if (card) card.click();
});
await sleep(waitMs);

// Keep mouse stationary at center so the worm stays in a stable pose
await page.mouse.move(640, 400);
await sleep(2000);

await page.screenshot({ path: out });
console.log('screenshot saved:', out);
await browser.close();
