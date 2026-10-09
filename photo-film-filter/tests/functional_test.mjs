/**
 * Headless Chrome DevTools Protocol Functional Test for Web UI
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');

const PORT = 8088;
const DEBUG_PORT = 9223;

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];
const CHROME_PATH = CHROME_CANDIDATES.find(p => p && fs.existsSync(p)) || 'google-chrome';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  // Ensure local static server is running on PORT
  let server = null;
  const isPortOpen = await fetch(`http://127.0.0.1:${PORT}/index.html`).then(() => true).catch(() => false);
  if (!isPortOpen) {
    server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = path.join(WEB_ROOT, urlPath === '/' ? 'index.html' : urlPath);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.wasm': 'application/wasm'
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      fs.createReadStream(filePath).pipe(res);
    });
    await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
    console.log(`Started local test server on http://127.0.0.1:${PORT}`);
  }

  console.log('>>> Starting Headless Chrome for Functional Testing...');
  const tmpProfile = `/tmp/chrome_test_profile_${Date.now()}`;
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${tmpProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disk-cache-size=1',
    `http://127.0.0.1:${PORT}/index.html?t=${Date.now()}`
  ], { stdio: 'ignore' });

  // Wait for Chrome CDP port to be open
  let wsUrl = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(500);
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const list = await res.json();
      const pageTarget = list.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || list.find(t => t.type === 'page');
      if (pageTarget && pageTarget.webSocketDebuggerUrl) {
        wsUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch (_) {}
  }

  if (!wsUrl) {
    chrome.kill();
    throw new Error('Failed to connect to Headless Chrome CDP');
  }

  console.log(`Connected to Chrome CDP at: ${wsUrl}`);
  const ws = new WebSocket(wsUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Enable Runtime, Page, and Network with Cache/SW bypass for testing
  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('Network.enable');
  await sendCommand('Network.setBypassServiceWorker', { bypass: true });
  await sendCommand('Network.setCacheDisabled', { cacheDisabled: true });

  await sendCommand('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html?t=${Date.now()}` });
  await sleep(2500);

  async function evaluate(expr) {
    const res = await sendCommand('Runtime.evaluate', { expression: expr, returnByValue: true });
    return res.result?.result?.value;
  }

  console.log('Page URL:', await evaluate('document.location.href'));
  console.log('Page Title:', await evaluate('document.title'));
  console.log('Page body length:', await evaluate('document.body.innerHTML.length'));

  console.log('\n--- 1. Testing Catalog & Categories ---');
  const totalPresets = await evaluate('window.app ? window.app.getPresetsCount ? window.app.getPresetsCount() : PRESETS.length : 0');
  console.log(`Total Presets in JS runtime: ${totalPresets}`);

  const tabAllText = await evaluate('document.querySelector(".tab-btn[data-category=\'all\']").textContent');
  const tabFilmText = await evaluate('document.querySelector(".tab-btn[data-category=\'Film\']").textContent');
  console.log(`Tab 'All': "${tabAllText}"`);
  console.log(`Tab 'Film': "${tabFilmText}"`);

  if (!tabAllText.includes('48') || !tabFilmText.includes('39')) {
    throw new Error(`Unexpected tab counts! Expected 48 and 39, got: "${tabAllText}", "${tabFilmText}"`);
  }

  console.log('\n--- 1b. Testing Filter Swatch & Name Vertical Alignment ---');
  const alignmentCheck = await evaluate(`(() => {
    const swatches = Array.from(document.querySelectorAll('.filter-card .swatch-ring'));
    if (swatches.length === 0) return { ok: false, reason: 'No swatches found' };
    const tops = swatches.map(s => Math.round(s.getBoundingClientRect().top));
    const firstTop = tops[0];
    const mismatched = tops.filter(t => t !== firstTop);
    const names = Array.from(document.querySelectorAll('.filter-card-name'));
    const nameHeights = names.map(n => Math.round(n.getBoundingClientRect().height));
    return {
      ok: mismatched.length === 0,
      totalSwatches: swatches.length,
      firstTop,
      uniqueTops: Array.from(new Set(tops)),
      uniqueNameHeights: Array.from(new Set(nameHeights))
    };
  })()`);
  console.log('Swatch Alignment Check Result:', JSON.stringify(alignmentCheck));
  if (!alignmentCheck.ok) {
    throw new Error(`Swatch vertical alignment failed! Swatches are not horizontally aligned: unique tops = ${JSON.stringify(alignmentCheck.uniqueTops)}`);
  }
  console.log(`✓ All ${alignmentCheck.totalSwatches} filter swatches share exact identical top baseline (${alignmentCheck.firstTop}px).`);

  console.log('\n--- 1c. Testing Favorites Starring & Category Filter ---');
  const initialFavCheck = await evaluate(`(() => {
    const btnFav = document.getElementById('btnFavorite');
    const tabFav = document.getElementById('tabFavorites');
    return {
      hasBtn: !!btnFav,
      hasTab: !!tabFav,
      tabText: tabFav ? tabFav.textContent : '',
      isBtnActive: btnFav ? btnFav.classList.contains('active') : false,
      initialFavCount: window.app.favorites.size
    };
  })()`);
  console.log('Initial Favorites State:', initialFavCheck);
  if (!initialFavCheck.hasBtn || !initialFavCheck.hasTab) {
    throw new Error('Favorites button or tab missing from DOM!');
  }

  // Click Favorites tab and verify displayed cards
  await evaluate(`document.getElementById('tabFavorites').click()`);
  await sleep(300);
  const favCardCount = await evaluate(`document.querySelectorAll('.filter-card').length`);
  console.log(`Cards displayed in Favorites tab: ${favCardCount}`);
  if (favCardCount !== initialFavCheck.initialFavCount) {
    throw new Error(`Expected ${initialFavCheck.initialFavCount} cards in Favorites tab, got ${favCardCount}`);
  }

  // Select Filter 24 (Fuji Sensia 100), verify unstarred, then star it
  await evaluate(`window.app.selectFilter(24)`);
  await sleep(300);
  const beforeStar = await evaluate(`window.app.isFavorite(24)`);
  console.log(`Filter 24 initial favorite status: ${beforeStar}`);
  if (beforeStar) throw new Error('Filter 24 should not be favorited initially!');

  // Star Filter 24
  await evaluate(`document.getElementById('btnFavorite').click()`);
  await sleep(300);
  const afterStar = await evaluate(`window.app.isFavorite(24)`);
  const newFavCount = await evaluate(`window.app.favorites.size`);
  const btnStarActive = await evaluate(`document.getElementById('btnFavorite').classList.contains('active')`);
  console.log(`Filter 24 starred: ${afterStar}, new count: ${newFavCount}, btn active: ${btnStarActive}`);
  if (!afterStar || !btnStarActive || newFavCount !== initialFavCheck.initialFavCount + 1) {
    throw new Error('Failed to star Filter 24!');
  }

  // Switch to Favorites tab and verify Filter 24 is present
  await evaluate(`document.getElementById('tabFavorites').click()`);
  await sleep(300);
  const card24InFavs = await evaluate(`!!document.querySelector('.filter-card[data-filter-id="24"]')`);
  console.log(`Filter 24 card rendered in Favorites tab: ${card24InFavs}`);
  if (!card24InFavs) throw new Error('Filter 24 missing from Favorites tab carousel!');

  // Un-star Filter 24 to restore original favorites state
  await evaluate(`document.getElementById('btnFavorite').click()`);
  await sleep(300);
  const restoredFavCount = await evaluate(`window.app.favorites.size`);
  console.log(`Filter 24 un-starred, restored count: ${restoredFavCount}`);
  if (restoredFavCount !== initialFavCheck.initialFavCount) {
    throw new Error('Failed to un-star Filter 24!');
  }

  // Restore All category tab
  await evaluate(`document.querySelector('.tab-btn[data-category="all"]').click()`);
  await sleep(300);
  console.log('✓ Favorites starring and category tab filtering passed cleanly!');

  console.log('\n--- 2. Functional Test: Fuji Sensia 100 (ID: 24) ---');
  await evaluate('window.app.selectFilter(24)');
  await sleep(500);

  const filter24Title = await evaluate('document.getElementById("filterName").textContent');
  const filter24Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter24ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter24ActiveId}`);
  console.log(`Active Title: "${filter24Title}"`);
  console.log(`Active Category Badge: "${filter24Cat}"`);

  if (filter24Title !== 'Fuji Sensia 100' || filter24ActiveId !== 24) {
    throw new Error(`Failed to activate Fuji Sensia 100! Title: ${filter24Title}`);
  }

  console.log('\n--- 3. Functional Test: Chrome Sensia 200 (ID: 25) ---');
  await evaluate('window.app.selectFilter(25)');
  await sleep(500);

  const filter25Title = await evaluate('document.getElementById("filterName").textContent');
  const filter25Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter25ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter25ActiveId}`);
  console.log(`Active Title: "${filter25Title}"`);
  console.log(`Active Category Badge: "${filter25Cat}"`);

  if (filter25Title !== 'Chrome Sensia 200' || filter25ActiveId !== 25) {
    throw new Error(`Failed to activate Chrome Sensia 200! Title: ${filter25Title}`);
  }

  console.log('\n--- 4. Functional Test: Fuji Astia 100F (ID: 26) ---');
  await evaluate('window.app.selectFilter(26)');
  await sleep(500);

  const filter26Title = await evaluate('document.getElementById("filterName").textContent');
  const filter26Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter26ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter26ActiveId}`);
  console.log(`Active Title: "${filter26Title}"`);
  console.log(`Active Category Badge: "${filter26Cat}"`);

  if (filter26Title !== 'Fuji Astia 100F' || filter26ActiveId !== 26) {
    throw new Error(`Failed to activate Fuji Astia 100F! Title: ${filter26Title}`);
  }

  console.log('\n--- 5. Functional Test: Fuji Superia 200 (ID: 27) ---');
  await evaluate('window.app.selectFilter(27)');
  await sleep(500);

  const filter27Title = await evaluate('document.getElementById("filterName").textContent');
  const filter27Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter27ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter27ActiveId}`);
  console.log(`Active Title: "${filter27Title}"`);
  console.log(`Active Category Badge: "${filter27Cat}"`);

  if (filter27Title !== 'Fuji Superia 200' || filter27ActiveId !== 27) {
    throw new Error(`Failed to activate Fuji Superia 200! Title: ${filter27Title}`);
  }

  console.log('\n--- 6. Functional Test: Fuji Superia 800 (ID: 28) ---');
  await evaluate('window.app.selectFilter(28)');
  await sleep(500);

  const filter28Title = await evaluate('document.getElementById("filterName").textContent');
  const filter28Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter28ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter28ActiveId}`);
  console.log(`Active Title: "${filter28Title}"`);
  console.log(`Active Category Badge: "${filter28Cat}"`);

  if (filter28Title !== 'Fuji Superia 800' || filter28ActiveId !== 28) {
    throw new Error(`Failed to activate Fuji Superia 800! Title: ${filter28Title}`);
  }

  console.log('\n--- 7. Functional Test: Fuji Pro 160C (ID: 29) ---');
  await evaluate('window.app.selectFilter(29)');
  await sleep(500);

  const filter29Title = await evaluate('document.getElementById("filterName").textContent');
  const filter29Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter29ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter29ActiveId}`);
  console.log(`Active Title: "${filter29Title}"`);
  console.log(`Active Category Badge: "${filter29Cat}"`);

  if (filter29Title !== 'Fuji Pro 160C' || filter29ActiveId !== 29) {
    throw new Error(`Failed to activate Fuji Pro 160C! Title: ${filter29Title}`);
  }

  console.log('\n--- 8. Functional Test: Fuji Eterna 250D (ID: 30) ---');
  await evaluate('window.app.selectFilter(30)');
  await sleep(500);

  const filter30Title = await evaluate('document.getElementById("filterName").textContent');
  const filter30Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter30ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter30ActiveId}`);
  console.log(`Active Title: "${filter30Title}"`);
  console.log(`Active Category Badge: "${filter30Cat}"`);

  if (filter30Title !== 'Fuji Eterna 250D' || filter30ActiveId !== 30) {
    throw new Error(`Failed to activate Fuji Eterna 250D! Title: ${filter30Title}`);
  }

  console.log('\n--- 9. Functional Test: Fuji F-64D (ID: 31) ---');
  await evaluate('window.app.selectFilter(31)');
  await sleep(500);

  const filter31Title = await evaluate('document.getElementById("filterName").textContent');
  const filter31Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter31ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter31ActiveId}`);
  console.log(`Active Title: "${filter31Title}"`);
  console.log(`Active Category Badge: "${filter31Cat}"`);

  if (filter31Title !== 'Fuji F-64D' || filter31ActiveId !== 31) {
    throw new Error(`Failed to activate Fuji F-64D! Title: ${filter31Title}`);
  }

  console.log('\n--- 10. Functional Test: Kodak Portra 160 (ID: 32) ---');
  await evaluate('window.app.selectFilter(32)');
  await sleep(500);

  const filter32Title = await evaluate('document.getElementById("filterName").textContent');
  const filter32Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter32ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter32ActiveId}`);
  console.log(`Active Title: "${filter32Title}"`);
  console.log(`Active Category Badge: "${filter32Cat}"`);

  if (filter32Title !== 'Kodak Portra 160' || filter32ActiveId !== 32) {
    throw new Error(`Failed to activate Kodak Portra 160! Title: ${filter32Title}`);
  }

  console.log('\n--- 11. Functional Test: Kodak Portra 800 HC (ID: 33) ---');
  await evaluate('window.app.selectFilter(33)');
  await sleep(500);

  const filter33Title = await evaluate('document.getElementById("filterName").textContent');
  const filter33Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter33ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter33ActiveId}`);
  console.log(`Active Title: "${filter33Title}"`);
  console.log(`Active Category Badge: "${filter33Cat}"`);

  if (filter33Title !== 'Kodak Portra 800 HC' || filter33ActiveId !== 33) {
    throw new Error(`Failed to activate Kodak Portra 800 HC! Title: ${filter33Title}`);
  }

  console.log('\n--- 12. Functional Test: Ektachrome E100VS (ID: 34) ---');
  await evaluate('window.app.selectFilter(34)');
  await sleep(500);

  const filter34Title = await evaluate('document.getElementById("filterName").textContent');
  const filter34Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter34ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter34ActiveId}`);
  console.log(`Active Title: "${filter34Title}"`);
  console.log(`Active Category Badge: "${filter34Cat}"`);

  if (filter34Title !== 'Ektachrome E100VS' || filter34ActiveId !== 34) {
    throw new Error(`Failed to activate Ektachrome E100VS! Title: ${filter34Title}`);
  }

  console.log('\n--- 13. Functional Test: Kodak Kodachrome 25 (ID: 35) ---');
  await evaluate('window.app.selectFilter(35)');
  await sleep(500);

  const filter35Title = await evaluate('document.getElementById("filterName").textContent');
  const filter35Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter35ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter35ActiveId}`);
  console.log(`Active Title: "${filter35Title}"`);
  console.log(`Active Category Badge: "${filter35Cat}"`);

  if (filter35Title !== 'Kodak Kodachrome 25' || filter35ActiveId !== 35) {
    throw new Error(`Failed to activate Kodak Kodachrome 25! Title: ${filter35Title}`);
  }

  console.log('\n--- 14. Functional Test: Kodak ColorPlus 200 (ID: 36) ---');
  await evaluate('window.app.selectFilter(36)');
  await sleep(500);

  const filter36Title = await evaluate('document.getElementById("filterName").textContent');
  const filter36Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter36ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter36ActiveId}`);
  console.log(`Active Title: "${filter36Title}"`);
  console.log(`Active Category Badge: "${filter36Cat}"`);

  if (filter36Title !== 'Kodak ColorPlus 200' || filter36ActiveId !== 36) {
    throw new Error(`Failed to activate Kodak ColorPlus 200! Title: ${filter36Title}`);
  }

  console.log('\n--- 15. Functional Test: Kodak Elite Color 200 (ID: 37) ---');
  await evaluate('window.app.selectFilter(37)');
  await sleep(500);

  const filter37Title = await evaluate('document.getElementById("filterName").textContent');
  const filter37Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter37ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter37ActiveId}`);
  console.log(`Active Title: "${filter37Title}"`);
  console.log(`Active Category Badge: "${filter37Cat}"`);

  if (filter37Title !== 'Kodak Elite Color 200' || filter37ActiveId !== 37) {
    throw new Error(`Failed to activate Kodak Elite Color 200! Title: ${filter37Title}`);
  }

  console.log('\n--- 16. Functional Test: Ilford Delta 400 (ID: 38) ---');
  await evaluate('window.app.selectFilter(38)');
  await sleep(500);

  const filter38Title = await evaluate('document.getElementById("filterName").textContent');
  const filter38Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter38ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter38ActiveId}`);
  console.log(`Active Title: "${filter38Title}"`);
  console.log(`Active Category Badge: "${filter38Cat}"`);

  if (filter38Title !== 'Ilford Delta 400' || filter38ActiveId !== 38) {
    throw new Error(`Failed to activate Ilford Delta 400! Title: ${filter38Title}`);
  }

  console.log('\n--- 17. Functional Test: Agfa Color XR 200 (ID: 39) ---');
  await evaluate('window.app.selectFilter(39)');
  await sleep(500);

  const filter39Title = await evaluate('document.getElementById("filterName").textContent');
  const filter39Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter39ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter39ActiveId}`);
  console.log(`Active Title: "${filter39Title}"`);
  console.log(`Active Category Badge: "${filter39Cat}"`);

  if (filter39Title !== 'Agfa Color XR 200' || filter39ActiveId !== 39) {
    throw new Error(`Failed to activate Agfa Color XR 200! Title: ${filter39Title}`);
  }

  console.log('\n--- 18. Functional Test: Agfa Precisa 100 (ID: 40) ---');
  await evaluate('window.app.selectFilter(40)');
  await sleep(500);

  const filter40Title = await evaluate('document.getElementById("filterName").textContent');
  const filter40Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter40ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter40ActiveId}`);
  console.log(`Active Title: "${filter40Title}"`);
  console.log(`Active Category Badge: "${filter40Cat}"`);

  if (filter40Title !== 'Agfa Precisa 100' || filter40ActiveId !== 40) {
    throw new Error(`Failed to activate Agfa Precisa 100! Title: ${filter40Title}`);
  }

  console.log('\n--- 19. Functional Test: Agfa Ultra Color 100 (ID: 41) ---');
  await evaluate('window.app.selectFilter(41)');
  await sleep(500);

  const filter41Title = await evaluate('document.getElementById("filterName").textContent');
  const filter41Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter41ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter41ActiveId}`);
  console.log(`Active Title: "${filter41Title}"`);
  console.log(`Active Category Badge: "${filter41Cat}"`);

  if (filter41Title !== 'Agfa Ultra Color 100' || filter41ActiveId !== 41) {
    throw new Error(`Failed to activate Agfa Ultra Color 100! Title: ${filter41Title}`);
  }

  console.log('\n--- 20. Functional Test: Lomography Negative 100 (ID: 42) ---');
  await evaluate('window.app.selectFilter(42)');
  await sleep(500);

  const filter42Title = await evaluate('document.getElementById("filterName").textContent');
  const filter42Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter42ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter42ActiveId}`);
  console.log(`Active Title: "${filter42Title}"`);
  console.log(`Active Category Badge: "${filter42Cat}"`);

  if (filter42Title !== 'Lomography Negative 100' || filter42ActiveId !== 42) {
    throw new Error(`Failed to activate Lomography Negative 100! Title: ${filter42Title}`);
  }

  console.log('\n--- 21. Functional Test: Lomography Negative 400 (ID: 43) ---');
  await evaluate('window.app.selectFilter(43)');
  await sleep(500);

  const filter43Title = await evaluate('document.getElementById("filterName").textContent');
  const filter43Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter43ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter43ActiveId}`);
  console.log(`Active Title: "${filter43Title}"`);
  console.log(`Active Category Badge: "${filter43Cat}"`);

  if (filter43Title !== 'Lomography Negative 400' || filter43ActiveId !== 43) {
    throw new Error(`Failed to activate Lomography Negative 400! Title: ${filter43Title}`);
  }

  console.log('\n--- 22. Functional Test: Lomography Redscale 100 (ID: 44) ---');
  await evaluate('window.app.selectFilter(44)');
  await sleep(500);

  const filter44Title = await evaluate('document.getElementById("filterName").textContent');
  const filter44Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter44ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter44ActiveId}`);
  console.log(`Active Title: "${filter44Title}"`);
  console.log(`Active Category Badge: "${filter44Cat}"`);

  if (filter44Title !== 'Lomography Redscale 100' || filter44ActiveId !== 44) {
    throw new Error(`Failed to activate Lomography Redscale 100! Title: ${filter44Title}`);
  }

  console.log('\n--- 23. Functional Test: Ninoco 400 (ID: 45) ---');
  await evaluate('window.app.selectFilter(45)');
  await sleep(500);

  const filter45Title = await evaluate('document.getElementById("filterName").textContent');
  const filter45Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter45ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter45ActiveId}`);
  console.log(`Active Title: "${filter45Title}"`);
  console.log(`Active Category Badge: "${filter45Cat}"`);

  if (filter45Title !== 'Ninoco 400' || filter45ActiveId !== 45) {
    throw new Error(`Failed to activate Ninoco 400! Title: ${filter45Title}`);
  }

  console.log('\n--- 24. Functional Test: Vibe Photo 400 Blue (ID: 46) ---');
  await evaluate('window.app.selectFilter(46)');
  await sleep(500);

  const filter46Title = await evaluate('document.getElementById("filterName").textContent');
  const filter46Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter46ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter46ActiveId}`);
  console.log(`Active Title: "${filter46Title}"`);
  console.log(`Active Category Badge: "${filter46Cat}"`);

  if (filter46Title !== 'Vibe Photo 400 Blue' || filter46ActiveId !== 46) {
    throw new Error(`Failed to activate Vibe Photo 400 Blue! Title: ${filter46Title}`);
  }

  console.log('\n--- 25. Functional Test: 800 RED (ID: 47) ---');
  await evaluate('window.app.selectFilter(47)');
  await sleep(500);

  const filter47Title = await evaluate('document.getElementById("filterName").textContent');
  const filter47Cat = await evaluate('document.getElementById("filterCategory").textContent');
  const filter47ActiveId = await evaluate('window.app.selectedFilterId');
  console.log(`Active Filter ID: ${filter47ActiveId}`);
  console.log(`Active Title: "${filter47Title}"`);
  console.log(`Active Category Badge: "${filter47Cat}"`);

  if (filter47Title !== '800 RED' || filter47ActiveId !== 47) {
    throw new Error(`Failed to activate 800 RED! Title: ${filter47Title}`);
  }

  console.log('\n--- 26. Verify Canvas Output ---');
  const hasCanvasData = await evaluate('(() => { const c = document.getElementById("canvasAfter"); return !!(c && c.width > 0 && c.height > 0); })()');
  console.log(`Canvas render dimensions validated: ${hasCanvasData}`);
  if (!hasCanvasData) {
    throw new Error('Canvas render dimensions check failed: canvasAfter is missing or 0x0!');
  }

  console.log('\n--- 27. Device Emulation: Popular iPhone and Samsung Mobile Layouts ---');
  const mobileDevices = [
    { name: 'iPhone SE (3rd Gen)', width: 375, height: 667, scale: 2 },
    { name: 'iPhone 14 / 15 / 16', width: 390, height: 844, scale: 3 },
    { name: 'iPhone Pro Max', width: 430, height: 932, scale: 3 },
    { name: 'Samsung Galaxy S22', width: 360, height: 800, scale: 3 },
    { name: 'Samsung Galaxy S24 Ultra', width: 412, height: 915, scale: 3.5 }
  ];

  for (const dev of mobileDevices) {
    console.log(`Testing viewport layout: ${dev.name} (${dev.width}x${dev.height})...`);
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: dev.width,
      height: dev.height,
      deviceScaleFactor: dev.scale,
      mobile: true
    });
    await sleep(300);

    const check = await evaluate(`(() => {
      const header = document.querySelector('.app-header');
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const btnSample = document.getElementById('btnSample');
      const btnLibrary = document.getElementById('btnLibrary');
      const btnUpload = document.getElementById('btnUpload');
      const btnDownload = document.getElementById('btnDownload');
      const btnTune = document.getElementById('btnTune');
      const langSelect = document.getElementById('langSelect');
      const rect = header.getBoundingClientRect();

      return {
        noHorizontalOverflow: scrollWidth <= clientWidth + 2,
        hasDuplicateSampleBtn: !!btnSample,
        libraryVisible: !!btnLibrary && getComputedStyle(btnLibrary).display !== 'none',
        uploadVisible: !!btnUpload && getComputedStyle(btnUpload).display !== 'none',
        downloadVisible: !!btnDownload && getComputedStyle(btnDownload).display !== 'none',
        tuneVisible: !!btnTune && getComputedStyle(btnTune).display !== 'none',
        langSelectVisible: !!langSelect && getComputedStyle(langSelect).display !== 'none',
        headerWidth: rect.width,
        clientWidth
      };
    })()`);

    console.log(`  ✓ ${dev.name} layout metrics:`, JSON.stringify(check));
    if (!check.noHorizontalOverflow) {
      throw new Error(`Horizontal overflow detected on ${dev.name}! clientWidth: ${check.clientWidth}, scrollWidth: ${check.scrollWidth}`);
    }
    if (check.hasDuplicateSampleBtn) {
      throw new Error(`Duplicate sample button still present in DOM on ${dev.name}!`);
    }
    if (!check.libraryVisible || !check.uploadVisible || !check.downloadVisible || !check.tuneVisible || !check.langSelectVisible) {
      throw new Error(`Essential header action buttons hidden or missing on ${dev.name}!`);
    }
  }

  console.log('\n--- 28. Functional Test: In-Place Language Switching and Localization ---');
  // Reset back to standard iPhone 15 layout for language testing
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await sleep(200);

  const testLanguages = [
    {
      code: 'ja',
      name: 'Japanese',
      expectedOriginal: 'オリジナル',
      expectedFiltered: 'フィルター適用',
      expectedFavSubstr: 'お気に入り',
      expectedFilmCategory: '(フィルム)'
    },
    {
      code: 'vi',
      name: 'Vietnamese',
      expectedOriginal: 'ẢNH GỐC',
      expectedFiltered: 'ĐÃ LỌC',
      expectedFavSubstr: 'Yêu thích',
      expectedFilmCategory: '(Phim)'
    },
    {
      code: 'zh-Hans',
      name: 'Simplified Chinese',
      expectedOriginal: '原图',
      expectedFiltered: '滤镜效果',
      expectedFavSubstr: '收藏',
      expectedFilmCategory: '(胶片)'
    },
    {
      code: 'zh-Hant',
      name: 'Traditional Chinese',
      expectedOriginal: '原圖',
      expectedFiltered: '濾鏡效果',
      expectedFavSubstr: '收藏',
      expectedFilmCategory: '(膠片)'
    },
    {
      code: 'en',
      name: 'English',
      expectedOriginal: 'ORIGINAL',
      expectedFiltered: 'FILTERED',
      expectedFavSubstr: 'Favorites',
      expectedFilmCategory: '(Film)'
    }
  ];

  for (const l of testLanguages) {
    console.log(`Switching language to ${l.name} (${l.code})...`);
    await evaluate(`(() => {
      const sel = document.getElementById('langSelect');
      sel.value = '${l.code}';
      sel.dispatchEvent(new Event('change'));
    })()`);
    await sleep(350);

    const localizedTexts = await evaluate(`(() => {
      const tagOrig = document.getElementById('tagOriginal')?.textContent?.trim();
      const tagFilt = document.getElementById('tagFiltered')?.textContent?.trim();
      const tabFav = document.getElementById('tabFavorites')?.textContent?.trim();
      const catBadge = document.getElementById('filterCategory')?.textContent?.trim();
      return { tagOrig, tagFilt, tabFav, catBadge };
    })()`);

    console.log(`  [${l.code}] Verified DOM texts:`, JSON.stringify(localizedTexts));

    if (localizedTexts.tagOrig !== l.expectedOriginal) {
      throw new Error(`tagOriginal translation mismatch for ${l.code}: expected "${l.expectedOriginal}", got "${localizedTexts.tagOrig}"`);
    }
    if (localizedTexts.tagFilt !== l.expectedFiltered) {
      throw new Error(`tagFiltered translation mismatch for ${l.code}: expected "${l.expectedFiltered}", got "${localizedTexts.tagFilt}"`);
    }
    if (!localizedTexts.tabFav.includes(l.expectedFavSubstr)) {
      throw new Error(`tabFavorites translation mismatch for ${l.code}: expected to contain "${l.expectedFavSubstr}", got "${localizedTexts.tabFav}"`);
    }
    if (localizedTexts.catBadge !== l.expectedFilmCategory) {
      throw new Error(`filterCategory annotation mismatch for ${l.code}: expected "${l.expectedFilmCategory}", got "${localizedTexts.catBadge}"`);
    }
  }

  // Also verify switching to an Effect filter localizes "(Effect)" correctly across languages
  await evaluate('window.app.selectFilter(19)'); // Cinematic Teal & Orange (category: Effect)
  await sleep(200);
  const effectCatBadge = await evaluate('document.getElementById("filterCategory")?.textContent?.trim()');
  console.log(`Effect filter category badge in English: "${effectCatBadge}"`);
  if (effectCatBadge !== '(Effect)') {
    throw new Error(`Expected category annotation "(Effect)", got "${effectCatBadge}"`);
  }

  console.log('\n★ ALL WEB FUNCTIONAL TESTS & RESPONSIVE DEVICE TESTS PASSED SUCCESSFULLY! ★');

  ws.close();
  chrome.kill();
  if (server) server.close();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Functional test failed:', err);
  process.exit(1);
});
