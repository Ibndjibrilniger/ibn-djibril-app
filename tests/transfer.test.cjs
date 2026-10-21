// Run: node --test tests/transfer.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const transfer = read('public/accueil-catalogue-prioritaire.js');

function sourceFiles(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true })
    .filter(entry => !['.git', '.local', '.cache', '.agents', 'node_modules', 'generated-artifacts'].includes(entry.name))
    .flatMap(entry => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? sourceFiles(file) : [file];
    });
}

test('all application JavaScript, inline scripts and handlers parse', () => {
  for (const file of sourceFiles('.')) {
    if (/\.(js|cjs)$/.test(file)) new vm.Script(read(file), { filename: file });
    if (!file.endsWith('.html')) continue;
    for (const match of read(file).matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      new vm.Script(match[1], { filename: file });
    }
    for (const match of read(file).matchAll(/\bon(?:click|keydown)="([^"]*)"/g)) {
      new Function('event', match[1]);
    }
  }
});

test('one transfer implementation, data source and renderer across application sources', () => {
  const sources = sourceFiles('.')
    .filter(file => !file.startsWith('tests/') && /\.(js|html)$/.test(file))
    .map(read).join('\n');
  assert.equal((sources.match(/function openTransferSheet\s*\(/g) || []).length, 1);
  assert.equal((sources.match(/const financeData\s*=/g) || []).length, 1);
  assert.equal((sources.match(/function renderFinance\s*\(/g) || []).length, 1);
  assert.doesNotMatch(sources, /al[\s-]*izza/i);
  assert.doesNotMatch(read('public/index.html'), /\btitle\.includes|Choisissez votre moyen de contact/);
});

test('both pages load the same transfer script and stylesheet exactly once', () => {
  let version;
  for (const file of ['public/index.html', 'public/dashboard.html']) {
    const html = read(file);
    const scripts = [...html.matchAll(/<script[^>]*src="([^"]*accueil-catalogue-prioritaire\.js[^"]*)"/g)];
    assert.equal(scripts.length, 1, file);
    version ||= scripts[0][1];
    assert.equal(scripts[0][1], version);
    const styles = [...html.matchAll(/href="([^"]*accueil-catalogue-prioritaire\.css[^"]*)"/g)];
    assert.equal(styles.length, 1);
    assert.equal(styles[0][1].split('?')[1], version.split('?')[1]);
    if (file.endsWith('dashboard.html')) assert.match(html, /window\.openTransferSheet\(\)/);
    else assert.match(read('public/catalogue-ultra.js'), /window\.openTransferSheet\(\)/);
    assert.match(html, /href="\/icons\/icon-192\.png"/);
    assert.ok(fs.existsSync(path.join(root, 'public/icons/icon-192.png')));
  }
});

test('Express prevents HTTP caching of pages and executable assets without affecting images', () => {
  const source = read('server.js');
  const callback = source.match(/setHeaders\(res, filePath\) \{([\s\S]*?)\n      \}/);
  assert.ok(callback, 'static asset cache policy exists');
  const setHeaders = new Function('res', 'filePath', callback[1]);
  for (const file of ['index.html', 'dashboard.html', 'sw.js', 'accueil-catalogue-prioritaire.js', 'accueil-catalogue-prioritaire.css']) {
    const headers = {};
    setHeaders({ setHeader: (key, value) => { headers[key] = value; } }, `/public/${file}`);
    assert.equal(headers['Cache-Control'], 'no-store');
  }
  const headers = {};
  setHeaders({ setHeader: (key, value) => { headers[key] = value; } }, '/public/icons/logo.png');
  assert.deepEqual(headers, {});
});

test('all existing countries, payment services and HTTPS links are retained', () => {
  const object = transfer.match(/const financeData = (\{[\s\S]*?\n  \});/)[1];
  const data = vm.runInNewContext(`(${object})`);
  const expected = {
    Niger: ['MyNITA', 'AMANATA', 'Airtel Money', 'Moov Flooz', 'Wave', 'Orange Money', 'Coris Money', 'Zamani Cash'],
    Benin: ['MTN MoMo', 'Moov Money', 'Celtiis Cash', 'B-MO', 'MyNITA'],
    Nigeria: ['UBA', 'FirstBank', 'Zenith Bank', 'Union Bank', 'Access Bank', 'GTCO', 'Monnify'],
    Ghana: ['MTN MoMo', 'Telecel Cash'],
    International: ['MoneyGram', 'Ria', 'MoneyFusion', 'NITA'],
    Crypto: ['Binance / USDT']
  };
  assert.deepEqual(Object.keys(data), Object.keys(expected));
  for (const [country, names] of Object.entries(expected)) {
    assert.deepEqual(Array.from(data[country].services, service => service[0]), names);
    for (const [, url] of data[country].services) assert.equal(new URL(url).protocol, 'https:');
  }
});

test('every financial service has a local optimized logo with recorded provenance', () => {
  const data = vm.runInNewContext('(' + transfer.match(/const financeData = (\{[\s\S]*?\n  \});/)[1] + ')');
  const logos = vm.runInNewContext('(' + transfer.match(/const FINANCE_LOGOS = (\{[\s\S]*?\n  \});/)[1] + ')');
  const sources = JSON.parse(read('public/media/services/sources.json'));
  const ids = new Set();
  let services = 0;
  for (const category of Object.values(data)) {
    for (const [name] of category.services) {
      services++;
      const id = logos[name];
      assert.ok(id, name);
      ids.add(id);
      const file = path.join(root, 'public/media/services', id + '.webp');
      assert.ok(fs.existsSync(file), name);
      assert.ok(fs.statSync(file).size < 30000, name + ': mobile asset budget');
      const source = sources.find(record => record.id === id);
      assert.ok(source && new URL(source.url).protocol === 'https:', name + ': source recorded');
      assert.equal(source.sha256, require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
    }
  }
  assert.equal(services, 27);
  assert.equal(ids.size, 24);
});

function workerHarness(offline = false) {
  const handlers = {};
  const requests = [];
  const deleted = [];
  let fallbacks = 0;
  let claimed = false;
  let skipped = false;
  vm.runInNewContext(read('public/sw.js'), {
    URL,
    Response,
    self: {
      location: {origin: 'https://example.test'},
      addEventListener: (event, handler) => { handlers[event] = handler; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } }
    },
    caches: {
      keys: async () => ['ibn-djibril-v2', 'ibn-djibril-v4', 'unrelated-cache'],
      delete: async key => { deleted.push(key); },
      match: async () => { fallbacks++; return 'stale'; }
    },
    fetch: async (request, options) => {
      requests.push({ request, options });
      if (offline) throw new Error('offline');
      return 'fresh';
    }
  });
  return {
    handlers, requests, deleted,
    get fallbacks() { return fallbacks; },
    get claimed() { return claimed; },
    get skipped() { return skipped; }
  };
}

test('worker immediately activates and deletes only this app’s legacy caches', async () => {
  const worker = workerHarness();
  let pending;
  worker.handlers.install({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.equal(worker.skipped, true);
  worker.handlers.activate({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(worker.deleted, ['ibn-djibril-v2', 'ibn-djibril-v4']);
  assert.equal(worker.claimed, true);
});

test('HTML, versioned scripts, CSS, worker and APIs never fall back to stale caches', async () => {
  for (const url of ['/', '/dashboard.html', '/accueil-catalogue-prioritaire.js?v=old', '/accueil-catalogue-prioritaire.css?v=old', '/pwa-update.js', '/sw.js', '/api/app-version']) {
    for (const offline of [false, true]) {
      const worker = workerHarness(offline);
      let response;
      worker.handlers.fetch({
        request: { method: 'GET', mode: url === '/' ? 'navigate' : 'cors', url: `https://example.test${url}` },
        respondWith: promise => { response = promise; }
      });
      if (offline && url === '/') {
        const result = await response;
        assert.equal(result.status, 503);
        assert.match(await result.text(), /Connexion indisponible/);
      } else if (offline) await assert.rejects(response, /offline/);
      else assert.equal(await response, 'fresh');
      assert.equal(worker.requests[0].options.cache, 'no-store');
      assert.equal(worker.fallbacks, 0, url);
    }
  }
});

test('PWA requests a worker update and reloads once on replacement, not first install', async () => {
  for (const existing of [false, true]) {
    const swEvents = {}, windowEvents = {};
    let reloads = 0, updates = 0;
    const serviceWorker = {
      controller: existing ? {} : null,
      addEventListener: (event, handler) => { swEvents[event] = handler; },
      register: async (url, options) => {
        assert.equal(url, '/sw.js');
        assert.equal(options.updateViaCache, 'none');
        return { update: async () => { updates++; } };
      }
    };
    vm.runInNewContext(read('public/pwa-update.js'), {
      navigator: { serviceWorker },
      window: {
        addEventListener: (event, handler) => { windowEvents[event] = handler; },
        location: { reload: () => { reloads++; } }
      },
      document: { addEventListener() {} },
      localStorage: { getItem: () => null, setItem() {} },
      fetch: async () => ({ ok: true, json: async () => ({ version: 'test-release' }) }),
      setInterval() {}, console
    });
    await windowEvents.load();
    assert.equal(updates, 1);
    swEvents.controllerchange();
    assert.equal(reloads, existing ? 1 : 0);
    swEvents.controllerchange();
    assert.equal(reloads, 1);
    swEvents.controllerchange();
    assert.equal(reloads, 1);
  }
});
