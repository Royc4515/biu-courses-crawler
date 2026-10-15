const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const {
  detectBlock,
  CrawlBlockedError,
  probePuppeteerPage,
  reportBlockedCrawl
} = require('./block-detect');

const DELAY_MS = 1500;
const OUTPUT_FILE = path.join(__dirname, 'biu-2027-cs-full-2026-10-14.json');
const CHECKPOINT_FILE = path.join(__dirname, 'checkpoint-crawl.json');
const OLD_FILE = "C:\\Users\\Roy\\CrossDevice\\Roy's S23 (1)\\storage\\Download\\biu-2027-cs-full-2026-09-13.json";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function main() {
  console.log('Connecting to browser on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  // Everything collected so far; saved as a checkpoint if the site blocks us mid-crawl.
  const allRows = [];
  const rowsPerPage = {};
  const sections = {};
  const details = {};

  function stopIfBlocked(probe) {
    const block = detectBlock(probe);
    if (!block) return;
    reportBlockedCrawl(block, CHECKPOINT_FILE, {
      meta: {
        label: '2027-cs',
        source: 'https://courses.biu.ac.il/CoursesView.aspx',
        captured: allRows.length,
        rows_per_page: rowsPerPage,
        detail_sections_captured: Object.keys(sections).length,
        delay_ms: DELAY_MS
      },
      rows: allRows,
      sections,
      details
    });
    throw new CrawlBlockedError(block);
  }

  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('courses.biu.ac.il'));

  if (!page) {
    throw new Error('Courses page not found on port 9222!');
  }
  const checkNavigation = async (response) => stopIfBlocked(await probePuppeteerPage(page, response));

  console.log('Attached to page:', page.url());
  await checkNavigation(null);

  // Check if we are on results page with 515 courses
  const status = await page.evaluate(() => {
    const table = document.getElementById('ContentPlaceHolder1_gvLessons');
    const header = document.body.innerText.match(/(\d+)\s*קורסים\s*ברשימה/);
    const count = header ? parseInt(header[1], 10) : 0;
    const activePage = document.querySelector('tr.cssPager span')?.innerText.trim() || '1';
    return { hasTable: !!table, count, activePage };
  });

  if (!status.hasTable || status.count !== 515) {
    console.log('Not on CS 515 results page. Navigating to root and searching...');
    await checkNavigation(await page.goto('https://courses.biu.ac.il/', { waitUntil: 'networkidle2' }));
    await sleep(DELAY_MS);
    await page.evaluate(() => {
      document.getElementById('ContentPlaceHolder1_cmbYear').value = '2027';
      document.getElementById('ContentPlaceHolder1_cmbDepartments').value = '84';
    });
    const [searchResponse] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.evaluate(() => {
        document.getElementById('ContentPlaceHolder1_btnSearch').click();
      })
    ]);
    await checkNavigation(searchResponse);
    await sleep(DELAY_MS);
  }

  // Ensure on Page 1
  const activePageNum = await page.evaluate(() => {
    return document.querySelector('tr.cssPager span')?.innerText.trim() || '1';
  });

  if (activePageNum !== '1') {
    console.log(`Current page is ${activePageNum}, returning to Page 1...`);
    const [firstPageResponse] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.evaluate(() => {
        const a1 = Array.from(document.querySelectorAll('tr.cssPager a')).find(
          (el) => el.innerText.trim() === '1'
        );
        if (a1) a1.click();
        else {
          // Find link to 1 or <<
          const first = Array.from(document.querySelectorAll('tr.cssPager a')).find(
            (el) => el.innerText.trim() === '<<' || el.getAttribute('href')?.includes('Page$1')
          );
          if (first) first.click();
        }
      })
    ]);
    await checkNavigation(firstPageResponse);
    await sleep(DELAY_MS);
  }

  const reportedTotal = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/(\d+)\s*קורסים\s*ברשימה/);
    return match ? parseInt(match[1], 10) : 515;
  });
  console.log(`Reported total courses: ${reportedTotal}`);

  let currentPage = 1;

  // Extract real course rows (ignoring pager row)
  async function extractCurrentPageRows() {
    return await page.evaluate(() => {
      const table = document.getElementById('ContentPlaceHolder1_gvLessons');
      if (!table) return [];
      const trs = Array.from(table.querySelectorAll('tr'));
      const rows = [];
      for (const tr of trs) {
        if (tr.classList.contains('cssPager') || tr.querySelector('table')) continue;
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length >= 8) {
          const code = tds[0].innerText.trim();
          if (/^\d{4,7}$/.test(code)) {
            const a = tr.querySelector('a[href*="lid="]');
            const href = a ? a.getAttribute('href') || a.getAttribute('onclick') || '' : '';
            const lidMatch = href.match(/lid=(\d+)/);
            if (lidMatch) {
              rows.push({
                code: code,
                name: tds[1].innerText.trim(),
                group: tds[2].innerText.trim().padStart(2, '0'),
                teachers: tds[3].innerText.trim(),
                kind: tds[4].innerText.trim(),
                semester: tds[5].innerText.trim(),
                day: tds[6].innerText.trim(),
                hours: tds[7].innerText.trim(),
                lid: lidMatch[1]
              });
            }
          }
        }
      }
      return rows;
    });
  }

  // Walk all 26 pages
  console.log('\n--- Walking Result Pages ---');
  let hasMorePages = true;

  while (hasMorePages) {
    const pageRows = await extractCurrentPageRows();
    console.log(`Page ${currentPage} captured ${pageRows.length} rows.`);

    allRows.push(...pageRows);
    rowsPerPage[String(currentPage)] = pageRows.length;

    // Check if there is a next page
    const nextTarget = currentPage + 1;
    const canNavigateNext = await page.evaluate((target) => {
      const links = Array.from(document.querySelectorAll('tr.cssPager a'));
      // Direct page number match
      const direct = links.find((a) => a.innerText.trim() === String(target));
      if (direct) {
        direct.click();
        return true;
      }
      // Forward ellipsis or Page$<target> match
      const targetHref = links.find((a) => a.getAttribute('href')?.includes(`Page$${target}`));
      if (targetHref) {
        targetHref.click();
        return true;
      }
      return false;
    }, nextTarget);

    if (canNavigateNext) {
      await checkNavigation(await page.waitForNavigation({ waitUntil: 'networkidle2' }));
      await sleep(DELAY_MS);
      currentPage++;
    } else {
      console.log(`No further pages found. Completed pagination at page ${currentPage}.`);
      hasMorePages = false;
    }

    // Save checkpoint
    fs.writeFileSync(
      CHECKPOINT_FILE,
      JSON.stringify({ capturedRows: allRows.length, rowsPerPage, rows: allRows }, null, 2),
      'utf8'
    );
  }

  console.log(`\nTotal rows collected: ${allRows.length} across ${currentPage} pages.`);
  console.log(`Expected total: ${reportedTotal}`);

  if (allRows.length !== reportedTotal) {
    console.warn(`WARNING: Collected ${allRows.length} rows, expected ${reportedTotal}!`);
  }

  // Unique sections (code|kind|semester)
  const tupleMap = new Map();
  for (const row of allRows) {
    const tupleKey = `${row.code}|${row.kind}|${row.semester}`;
    if (!tupleMap.has(tupleKey)) {
      tupleMap.set(tupleKey, row);
    }
  }

  const uniqueTuples = Array.from(tupleMap.entries());
  console.log(`\nUnique code|kind|semester sections expected: ${uniqueTuples.length}`);

  // Unique details pairs (code|semester)
  const pairSet = new Set(allRows.map((r) => `${r.code}|${r.semester}`));
  console.log(`Unique code|semester detail pairs expected: ${pairSet.size}`);

  // Fetch Section Details
  console.log('\n--- Fetching Section Details ---');

  let count = 0;
  for (const [tupleKey, row] of uniqueTuples) {
    count++;
    const lid = row.lid;
    process.stdout.write(`[${count}/${uniqueTuples.length}] Fetching LID ${lid} (${row.code} - ${row.name})... `);

    try {
      const { probe, secData } = await page.evaluate(async (lId) => {
        let res;
        let html;
        try {
          res = await fetch(`CourseDetails.aspx?lid=${lId}`);
          html = await res.text();
        } catch (fetchErr) {
          return { probe: { fetchError: String(fetchErr) } };
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const probe = { status: res.status, url: res.url, title: doc.title, html };

        function getField(lbl) {
          const allEls = Array.from(doc.querySelectorAll('td, th, span, div, label, b, strong'));
          const el = allEls.find((e) => e.innerText && e.innerText.trim() === lbl);
          if (!el) return '';
          let valEl = el.nextElementSibling;
          if (!valEl) {
            const tr = el.closest('tr');
            if (tr) {
              const cells = Array.from(tr.querySelectorAll('td, th'));
              const idx = cells.indexOf(el);
              if (idx !== -1 && cells[idx + 1]) {
                valEl = cells[idx + 1];
              }
            }
          }
          if (!valEl) return '';
          return valEl.innerHTML
            .replace(/<br\s*[\/]?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .join('\n');
        }

        let title = '';
        const m = doc.body.innerText.match(/פרטי קורס\s*:\s*([^\n\r]+)/);
        if (m) title = m[1].trim();

        // Extract exam terms
        const terms = [];
        const trs = Array.from(doc.querySelectorAll('table tr')).filter((tr) =>
          tr.innerText.includes('מועד')
        );
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim());
          if (tds.length >= 3) {
            const type = tds[0] || tds.find((c) => c.includes('מועד')) || '';
            const date = tds[1] || tds.find((c) => c.match(/\d{2}\/\d{2}\/\d{4}/)) || '';
            const hour = tds[2] || tds.find((c) => c.match(/\d{2}:\d{2}/)) || '';
            if (type.includes('מועד') && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
              terms.push({ type, date, hour });
            }
          }
        }

        return { probe, secData: {
          points: getField('נ"ז') || '',
          code: getField('קוד קורס') || '',
          hours: getField('שעות') || '',
          terms: terms,
          title: title,
          name_en: getField('שם קורס באנגלית') || '',
          department: getField('מחלקה') || 'המחלקה למדעי המחשב',
          faculty: getField('פקולטה') || 'מדעים מדויקים',
          kind: getField('סוג מפגש') || '',
          teachers: getField('מרצה') || '',
          day: getField('יום') || '',
          session_hours: getField('שעה') || '',
          remark: getField('הערה') || '',
          clusters: getField('אפיונים') || '',
          syllabus: `CourseSylabusView.aspx?lid=${lId}`
        } };
      }, lid);
      stopIfBlocked(probe);

      sections[lid] = secData;

      // Populate details for code|semester
      const pairKey = `${row.code}|${row.semester}`;
      if (!details[pairKey]) {
        details[pairKey] = secData;
      }

      console.log(`OK (terms: ${secData.terms.length})`);
    } catch (err) {
      if (err instanceof CrawlBlockedError) throw err;
      console.log(`ERROR: ${err.message}`);
    }

    // Save checkpoint every 10 sections
    if (count % 10 === 0) {
      const checkpointResult = {
        meta: {
          schema: 1,
          script: 'scripts/crawl/v1-crawl.js',
          label: '2027-cs',
          mode: 'all',
          scraped_at: new Date().toISOString(),
          source: 'https://courses.biu.ac.il/CoursesView.aspx',
          reported_total: reportedTotal,
          captured: allRows.length,
          pages_walked: Object.keys(rowsPerPage).length,
          page_size: 20,
          rows_per_page: rowsPerPage,
          detail_sections_expected: uniqueTuples.length,
          detail_sections_captured: Object.keys(sections).length,
          detail_pairs_expected: pairSet.size,
          detail_pairs_captured: Object.keys(details).length,
          delay_ms: DELAY_MS,
          complete: false
        },
        rows: allRows,
        sections: sections,
        details: details
      };
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpointResult, null, 2), 'utf8');
    }

    await sleep(DELAY_MS);
  }

  // Build final complete JSON
  const isComplete =
    allRows.length === reportedTotal &&
    Object.keys(sections).length === uniqueTuples.length &&
    Object.keys(details).length === pairSet.size;

  const finalData = {
    meta: {
      schema: 1,
      script: 'scripts/crawl/v1-crawl.js',
      label: '2027-cs',
      mode: 'all',
      scraped_at: new Date().toISOString(),
      source: 'https://courses.biu.ac.il/CoursesView.aspx',
      reported_total: reportedTotal,
      captured: allRows.length,
      pages_walked: Object.keys(rowsPerPage).length,
      page_size: 20,
      rows_per_page: rowsPerPage,
      detail_sections_expected: uniqueTuples.length,
      detail_sections_captured: Object.keys(sections).length,
      detail_pairs_expected: pairSet.size,
      detail_pairs_captured: Object.keys(details).length,
      delay_ms: DELAY_MS,
      complete: isComplete
    },
    rows: allRows,
    sections: sections,
    details: details
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf8');
  console.log(`\n==============================================`);
  console.log(`SUCCESS! Saved full JSON to: ${OUTPUT_FILE}`);
  console.log(`Complete status: ${isComplete}`);
  console.log(`Total rows: ${finalData.rows.length}`);
  console.log(`Sections count: ${Object.keys(finalData.sections).length}`);
  console.log(`Details count: ${Object.keys(finalData.details).length}`);
  console.log(`==============================================\n`);

  browser.disconnect();
}

main().catch((err) => {
  // The stop message and checkpoint were already handled where the block was detected.
  if (err instanceof CrawlBlockedError) process.exit(2);
  console.error('Crawler failed with error:', err);
  process.exit(1);
});
