/**
 * Detects when courses.biu.ac.il pushes back (HTTP 403/429, a CAPTCHA or Radware
 * challenge, a block page, or a redirect off the courses host) so the crawler can stop.
 *
 * Stopping is the only response. Never retry, slow down and try again, or work around a block.
 *
 * browser-crawl.js is pasted into the DevTools console and cannot require() this file,
 * so it carries a verbatim copy of the region between the markers below.
 * test/block-detect.test.js fails if the two copies drift apart.
 */
const fs = require('fs');

// >>> block-detect (keep identical in block-detect.js and browser-crawl.js)
const BIU_COURSES_HOST = 'courses.biu.ac.il';
const BLOCK_STATUSES = [403, 429];
// Radware Bot Manager injects its connector script (perfdrive / stormcaster.js) into normal
// pages too, so the HTML is matched only on text that appears on the challenge page itself.
const BLOCK_MARKERS = [
  { reason: 'hcaptcha', pattern: /h-captcha|hcaptcha\.com/i },
  { reason: 'radware', pattern: /radware/i, titleOnly: true },
  { reason: 'radware', pattern: /radware page|verifying your browser/i },
  { reason: 'captcha', pattern: /captcha/i },
  {
    reason: 'block-page',
    pattern: /access denied|request (?:was )?(?:blocked|rejected)|you have been blocked|unusual traffic|הגישה נחסמה|הבקשה נחסמה/i
  }
];
const BLOCK_MESSAGE_HE =
  'הסריקה נעצרה: אתר הקורסים של בר-אילן חסם את הבקשות או הציג בדיקת CAPTCHA. ' +
  'אל תנסו לעקוף את החסימה ואל תריצו את הסורק שוב עכשיו. ' +
  'הנתונים שנאספו עד כה נשמרו.';

function isBiuUrl(url) {
  try {
    return new URL(url, `https://${BIU_COURSES_HOST}/`).hostname === BIU_COURSES_HOST;
  } catch (err) {
    return false;
  }
}

// fetchError: an in-page fetch() that rejected. A cross-origin redirect to a challenge
// host fails CORS before its URL can be read, so a failed request also stops the crawl.
function detectBlock({ status, url, title, html, fetchError } = {}) {
  if (fetchError) {
    return { reason: 'fetch-failed', detail: String(fetchError) };
  }
  if (BLOCK_STATUSES.includes(status)) {
    return { reason: `http-${status}`, detail: `HTTP ${status}` };
  }
  if (url && !isBiuUrl(url)) {
    return { reason: 'off-site-redirect', detail: url };
  }
  const fullText = `${title || ''}\n${html || ''}`;
  for (const { reason, pattern, titleOnly } of BLOCK_MARKERS) {
    const hit = (titleOnly ? title || '' : fullText).match(pattern);
    if (hit) return { reason, detail: hit[0] };
  }
  return null;
}

function formatBlockMessage(block, savedTo) {
  const where = savedTo ? ` (${savedTo})` : '';
  return `${BLOCK_MESSAGE_HE}${where}\nסיבה: ${block.reason} — ${block.detail}`;
}

class CrawlBlockedError extends Error {
  constructor(block) {
    super(`Crawl stopped by the site: ${block.reason} (${block.detail})`);
    this.name = 'CrawlBlockedError';
    this.block = block;
  }
}
// <<< block-detect

/** Status, URL, title and HTML of a Puppeteer page after a navigation, for detectBlock(). */
async function probePuppeteerPage(page, response) {
  return {
    status: response ? response.status() : undefined,
    url: page.url(),
    title: await page.title().catch(() => ''),
    html: await page.content().catch(() => '')
  };
}

/**
 * Saves what was collected before the block, marked incomplete with the stop reason.
 * Leaves an existing checkpoint untouched when no rows were collected yet.
 */
function saveBlockedCheckpoint(file, data, block) {
  if (!file || !data || !Array.isArray(data.rows) || data.rows.length === 0) return false;
  const checkpoint = {
    ...data,
    meta: {
      ...(data.meta || {}),
      scraped_at: new Date().toISOString(),
      complete: false,
      stopped_by_block: block
    }
  };
  fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2), 'utf8');
  return true;
}

/** Prints the stop message, saves the checkpoint and sets a non-zero exit code. */
function reportBlockedCrawl(block, checkpointFile, data) {
  let saved = false;
  try {
    saved = saveBlockedCheckpoint(checkpointFile, data, block);
  } catch (err) {
    // The crawl must still stop when the checkpoint cannot be written.
    console.error(`Could not write checkpoint ${checkpointFile}: ${err.message}`);
  }
  const banner = '='.repeat(60);
  console.error(`\n${banner}`);
  console.error(formatBlockMessage(block, saved ? checkpointFile : null));
  if (!saved) console.error('לא נאספו נתונים חדשים לפני החסימה, ולכן לא נשמר קובץ.');
  console.error(`${banner}\n`);
  process.exitCode = 2;
}

module.exports = {
  BIU_COURSES_HOST,
  BLOCK_MESSAGE_HE,
  detectBlock,
  isBiuUrl,
  formatBlockMessage,
  CrawlBlockedError,
  probePuppeteerPage,
  saveBlockedCheckpoint,
  reportBlockedCrawl
};
