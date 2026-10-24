'use strict';
// 배포 직후 서비스워커 전환 검사: 옛 버전이 설치된 브라우저에서 새 버전을 배포하면,
// 첫 접속에서 옛 JS가 섞이지 않고 결국 새 JS로 동작해야 한다.
// 시나리오 A: 수정 전 서비스워커(커밋 11f1cb1)가 깔린 상태 → 새 페이지의 확인 코드가 한 번 새로고침해야 함
// 시나리오 B: 이번 서비스워커의 옛 버전이 깔린 상태 → 버전이 다른 요청은 저장본 대신 서버에서 받아야 함
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), assert = require('assert/strict');
const { chromium } = require('C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'un/sw.js'), 'utf8').match(/CACHE_VERSION = '([^']+)'/)[1];
const git = args => cp.execFileSync('git', ['-c', 'safe.directory=' + root.replace(/\\/g, '/'), ...args], { cwd: root, encoding: 'utf8' });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function serve(state) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(file);
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (['un/index.html', 'un/sw.js', 'un/app-pages.js'].includes(rel)) {
      let text = rel === 'un/sw.js' && state.oldSw ? state.oldSw : body.toString('utf8');
      if (state.phase === 'old') text = text.split(current).join('v000-old');
      if (rel === 'un/app-pages.js') text += '\nwindow.__build = ' + JSON.stringify(state.phase) + ';\n';
      body = Buffer.from(text);
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  });
}

async function scenario(name, oldSw) {
  const state = { phase: 'old', oldSw };
  const server = serve(state);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port + '/un/';
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  await context.route(url => !url.href.startsWith('http://127.0.0.1'), r => r.abort());
  const page = await context.newPage();
  try {
    await page.goto(base);
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 20000 });
    await page.reload();
    await page.waitForFunction(() => window.__build, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => window.__build), 'old', name + ': old build should be installed first');

    state.phase = 'new'; state.oldSw = null;
    await page.goto(base);
    let build = null;
    for (let i = 0; i < 40 && build !== 'new'; i++) {
      await page.waitForTimeout(500);
      build = await page.evaluate(() => window.__build).catch(() => null);
    }
    assert.equal(build, 'new', name + ': after the deploy the page must run the new scripts, not the cached old ones');
    const swVersion = await page.evaluate(() => new Promise(res => {
      const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data);
      navigator.serviceWorker.controller.postMessage('GET_VERSION', [ch.port2]); setTimeout(() => res(null), 3000);
    }));
    assert.equal(swVersion, current, name + ': the new service worker should end up in control');
  } finally {
    await browser.close();
    server.close();
  }
}

(async () => {
  const unfixedSw = git(['show', '11f1cb1:un/sw.js']);
  await scenario('A (unfixed old service worker)', unfixedSw);
  await scenario('B (fixed old service worker)', null);
  console.log('PASS sw-update: after a deploy both unfixed and fixed old service workers end with the new scripts and the new worker in control (' + current + ')');
})().catch(e => { console.error(e); process.exit(1); });
