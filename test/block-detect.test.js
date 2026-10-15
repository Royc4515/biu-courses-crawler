const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  detectBlock,
  isBiuUrl,
  formatBlockMessage,
  CrawlBlockedError,
  saveBlockedCheckpoint,
  probePuppeteerPage,
  reportBlockedCrawl,
  BLOCK_MESSAGE_HE
} = require('../block-detect');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const BIU = 'https://courses.biu.ac.il/CoursesView.aspx';

describe('detectBlock: normal pages pass', () => {
  test('course results page is not a block', () => {
    assert.equal(detectBlock({ status: 200, url: BIU, html: fixture('course-results.html') }), null);
  });

  test('course details page is not a block (Hebrew "חסום" in a remark is fine)', () => {
    const html = fixture('course-details.html');
    assert.equal(detectBlock({ status: 200, url: 'https://courses.biu.ac.il/CourseDetails.aspx?lid=1', html }), null);
  });

  test('normal page carrying the Radware connector script is not a block', () => {
    const connector =
      '<script>ssConf("c1", "https://courses.biu.ac.il"); ssConf("cu", "validate.perfdrive.com, ssc");' +
      ' a.src = "https://courses.biu.ac.il/x/stormcaster.js";</script>';
    const html = fixture('course-results.html').replace('</head>', `${connector}</head>`);
    assert.equal(detectBlock({ status: 200, url: BIU, title: 'קטלוג קורסים', html }), null);
  });

  test('missing fields are not a block', () => {
    assert.equal(detectBlock({}), null);
    assert.equal(detectBlock(), null);
  });

  test('relative URL resolves to the BIU host', () => {
    assert.equal(detectBlock({ status: 200, url: 'CourseDetails.aspx?lid=1' }), null);
  });
});

describe('detectBlock: HTTP status', () => {
  for (const status of [403, 429]) {
    test(`HTTP ${status} is a block`, () => {
      const block = detectBlock({ status, url: BIU, html: fixture('course-results.html') });
      assert.equal(block.reason, `http-${status}`);
    });
  }

  test('other error statuses are not treated as a block', () => {
    assert.equal(detectBlock({ status: 500, url: BIU, html: '' }), null);
    assert.equal(detectBlock({ status: 404, url: BIU, html: '' }), null);
  });
});

describe('detectBlock: CAPTCHA and block-page markers', () => {
  test('real Radware challenge page is a block', () => {
    const block = detectBlock({ status: 200, url: BIU, html: fixture('radware-page.html') });
    assert.equal(block.reason, 'radware');
  });

  test('Radware title alone is a block', () => {
    assert.equal(detectBlock({ status: 200, url: BIU, title: 'Radware Page' }).reason, 'radware');
  });

  test('hCaptcha page is a block', () => {
    const block = detectBlock({ status: 200, url: BIU, html: fixture('hcaptcha-page.html') });
    assert.equal(block.reason, 'hcaptcha');
  });

  test('generic "captcha" in the title is a block', () => {
    assert.equal(detectBlock({ status: 200, url: BIU, title: 'Please solve the CAPTCHA' }).reason, 'captcha');
  });

  test('generic block page is a block', () => {
    const block = detectBlock({ status: 200, url: BIU, html: fixture('block-page.html') });
    assert.equal(block.reason, 'block-page');
  });

  test('Hebrew block text is a block', () => {
    assert.equal(detectBlock({ status: 200, url: BIU, html: '<p>הגישה נחסמה</p>' }).reason, 'block-page');
  });
});

describe('detectBlock: redirect away from courses.biu.ac.il', () => {
  test('redirect to the Radware validation host is a block', () => {
    const block = detectBlock({ status: 200, url: 'https://validate.perfdrive.com/abc', html: '' });
    assert.equal(block.reason, 'off-site-redirect');
  });

  test('redirect to the university SSO is a block', () => {
    const block = detectBlock({ status: 200, url: 'https://sso.biu.ac.il/login', html: '' });
    assert.equal(block.reason, 'off-site-redirect');
  });

  test('look-alike host is a block', () => {
    assert.equal(detectBlock({ url: 'https://courses.biu.ac.il.evil.example/' }).reason, 'off-site-redirect');
  });

  test('a request that fails outright (e.g. cross-origin redirect blocked by CORS) stops the crawl', () => {
    const block = detectBlock({ fetchError: 'TypeError: Failed to fetch' });
    assert.equal(block.reason, 'fetch-failed');
    assert.match(block.detail, /Failed to fetch/);
  });
});

describe('isBiuUrl', () => {
  test('accepts the courses host over http and https', () => {
    assert.equal(isBiuUrl('https://courses.biu.ac.il/'), true);
    assert.equal(isBiuUrl('http://courses.biu.ac.il/CoursesView.aspx'), true);
  });

  test('rejects other hosts', () => {
    assert.equal(isBiuUrl('https://biu.ac.il/'), false);
    assert.equal(isBiuUrl('https://example.com/?courses.biu.ac.il'), false);
  });
});

describe('formatBlockMessage', () => {
  test('is Hebrew, names the reason and tells the user not to work around the block', () => {
    const msg = formatBlockMessage({ reason: 'http-429', detail: 'HTTP 429' });
    assert.ok(msg.includes(BLOCK_MESSAGE_HE));
    assert.ok(msg.includes('HTTP 429'));
    assert.match(BLOCK_MESSAGE_HE, /הסריקה נעצרה/);
    assert.match(BLOCK_MESSAGE_HE, /אל תנסו לעקוף/);
  });

  test('mentions where the checkpoint was saved', () => {
    const msg = formatBlockMessage({ reason: 'radware', detail: 'Radware' }, 'checkpoint-cs.json');
    assert.ok(msg.includes('checkpoint-cs.json'));
  });
});

describe('CrawlBlockedError', () => {
  test('carries the block', () => {
    const block = { reason: 'captcha', detail: 'captcha' };
    const err = new CrawlBlockedError(block);
    assert.ok(err instanceof Error);
    assert.deepEqual(err.block, block);
  });
});

describe('saveBlockedCheckpoint', () => {
  const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'biu-block-')), 'checkpoint.json');
  const block = { reason: 'http-403', detail: 'HTTP 403' };

  test('writes collected rows with the stop reason and complete=false', () => {
    const file = tmpFile();
    const saved = saveBlockedCheckpoint(file, { meta: { label: 'x' }, rows: [{ code: '1' }], sections: {}, details: {} }, block);
    assert.equal(saved, true);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(data.rows.length, 1);
    assert.equal(data.meta.complete, false);
    assert.equal(data.meta.label, 'x');
    assert.deepEqual(data.meta.stopped_by_block, block);
  });

  test('does not overwrite an existing checkpoint when nothing was collected', () => {
    const file = tmpFile();
    fs.writeFileSync(file, '{"old":true}');
    assert.equal(saveBlockedCheckpoint(file, { rows: [] }, block), false);
    assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  });

  test('does nothing without a checkpoint path', () => {
    assert.equal(saveBlockedCheckpoint(null, { rows: [{}] }, block), false);
  });
});

describe('reportBlockedCrawl', () => {
  test('still reports the stop when the checkpoint cannot be written', (t) => {
    const errors = [];
    t.mock.method(console, 'error', (msg) => errors.push(String(msg)));
    const unwritable = path.join(os.tmpdir(), 'no-such-dir-biu', 'nested', 'checkpoint.json');
    reportBlockedCrawl({ reason: 'http-429', detail: 'HTTP 429' }, unwritable, { rows: [{}] });
    process.exitCode = 0;
    assert.ok(errors.some((m) => m.includes('Could not write checkpoint')));
    assert.ok(errors.some((m) => m.includes(BLOCK_MESSAGE_HE)));
  });
});

describe('probePuppeteerPage', () => {
  const fakePage = (overrides = {}) => ({
    url: () => overrides.url || BIU,
    title: async () => overrides.title || 'קטלוג',
    content: async () => overrides.html || '<html></html>'
  });

  test('reads status from the navigation response', async () => {
    const probe = await probePuppeteerPage(fakePage(), { status: () => 429 });
    assert.equal(probe.status, 429);
    assert.equal(detectBlock(probe).reason, 'http-429');
  });

  test('works without a response (same-document navigation)', async () => {
    const probe = await probePuppeteerPage(fakePage({ title: 'Radware Page' }), null);
    assert.equal(probe.status, undefined);
    assert.equal(detectBlock(probe).reason, 'radware');
  });
});

describe('browser-crawl.js stays in sync', () => {
  const region = (src) => {
    const m = src.match(/\/\/ >>> block-detect[\s\S]*?\/\/ <<< block-detect/);
    assert.ok(m, 'block-detect region missing');
    return m[0].split('\n').map((l) => l.trim()).join('\n');
  };

  test('its inline detector matches block-detect.js', () => {
    const shared = fs.readFileSync(path.join(__dirname, '..', 'block-detect.js'), 'utf8');
    const browser = fs.readFileSync(path.join(__dirname, '..', 'browser-crawl.js'), 'utf8');
    assert.equal(region(browser), region(shared));
  });
});
