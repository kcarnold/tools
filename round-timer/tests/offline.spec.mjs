// Opening the timer without a network, after one visit with one.

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, ok, eq, expect, armSurprise, finish } from './helpers.mjs';

const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
const html = readFileSync(APP_DIR + 'index.html', 'utf8');
const LOADED = [...html.matchAll(/<(?:script src|link rel="stylesheet" href)="([^"]+)"/g)].map(m => m[1]);

test('the service worker caches exactly what the page loads', () => {
  const list = readFileSync(APP_DIR + 'sw.js', 'utf8').match(/FILES = \[([^\]]*)\]/)[1];
  const files = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]);
  expect([...files].sort()).toEqual(['./', ...LOADED].sort());
});

// A server of the test's own, so it can be made to fail, hang or serve a new
// version. Real failures rather than context.setOffline(), which doesn't reach
// a service worker's own requests in every browser.
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
async function appServer() {
  const server = { mode: 'up', edit: (path, body) => body };
  const http = createServer((req, res) => {
    if (server.mode === 'down') { req.socket.destroy(); return; }
    if (server.mode === 'hang') return;
    const path = req.url.replace(/^\/t\//, '') || 'index.html';
    try {
      const body = server.edit(path, readFileSync(APP_DIR + path, 'utf8'));
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)], 'Cache-Control': 'public, max-age=0, must-revalidate' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => http.listen(0, 'localhost', resolve));
  server.url = `http://localhost:${http.address().port}/t/`;
  server.close = () => { http.closeAllConnections(); http.close(); };
  return server;
}

// Open the app and wait until the worker has cached it and taken over.
const firstVisit = async (openPage, server, options = {}) => {
  const page = await openPage({ url: server.url, serviceWorkers: 'allow', ...options });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  return page;
};

test('it opens and runs with no network', async ({ openPage }) => {
  const server = await appServer();
  try {
    const page = await firstVisit(openPage, server);
    server.mode = 'down';
    await page.reload();
    eq(await page.locator('.art-thumb-wrap').count(), 5, 'the setup screen is all there');
    ok(await page.evaluate(() => getComputedStyle(document.body).display === 'flex'), 'and styled');
    await armSurprise(page);
    await page.locator('#startBtn').click();
    ok(await page.locator('#timerView').isVisible(), 'a round starts');
    await expect(page.locator('#revealName')).toBeVisible();
    ok((await page.locator('#revealName').textContent()).length > 0, 'and reveals something');
  } finally { server.close(); }
});

test('a deploy shows up on the next load', async ({ openPage }) => {
  const server = await appServer();
  try {
    const page = await firstVisit(openPage, server);
    server.edit = (path, body) => path === 'index.html' ? body.replace('<h1>Reveal Timer</h1>', '<h1>Version 2</h1>') : body;
    await page.reload();
    eq(await page.locator('h1').textContent(), 'Version 2', 'the new page is not hidden behind the cache');
    server.mode = 'down';
    await page.reload();
    eq(await page.locator('h1').textContent(), 'Version 2', 'and is what opens offline from then on');
  } finally { server.close(); }
});

test('a file that fails to load comes from the cache', async ({ openPage }) => {
  const server = await appServer();
  try {
    const page = await firstVisit(openPage, server);
    server.edit = (path, body) => { if (path === 'art/food.js') throw new Error('404'); return body; };
    await page.reload();
    eq(await page.locator('.art-thumb-wrap').count(), 5, 'the app still starts');
  } finally { server.close(); }
});

test('a connection that hangs falls back to the cache', async ({ openPage }) => {
  const server = await appServer();
  try {
    const page = await firstVisit(openPage, server);
    server.mode = 'hang';
    await page.reload({ timeout: 25000 });
    eq(await page.locator('.art-thumb-wrap').count(), 5, 'the app still starts');
  } finally { server.close(); }
});

test('it runs straight from a file, with no server at all', async ({ openPage }) => {
  const page = await openPage({ url: 'file://' + APP_DIR + 'index.html', clock: true });
  await armSurprise(page);
  await page.locator('#startBtn').click();
  await finish(page);
  ok((await page.locator('#revealName').textContent()).length > 0, 'a round runs to its reveal');
});
