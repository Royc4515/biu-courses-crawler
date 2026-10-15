const fs = require('fs');
const path = require('path');
const readline = require('readline');
const puppeteer = require('puppeteer-core');
const {
  FACULTIES,
  DEPARTMENTS,
  findDepartment,
  findFaculty,
  resolveTarget,
  formatCatalogDirectory
} = require('./catalog-meta');
const {
  detectBlock,
  isBiuUrl,
  CrawlBlockedError,
  probePuppeteerPage,
  reportBlockedCrawl
} = require('./block-detect');

const DEFAULT_DELAY_MS = 1500;
const DEFAULT_YEAR = '2027';

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dept: null,
    faculty: null,
    year: DEFAULT_YEAR,
    delay: DEFAULT_DELAY_MS,
    output: null,
    list: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dept' || arg === '-d') {
      options.dept = args[++i];
    } else if (arg === '--faculty' || arg === '-f') {
      options.faculty = args[++i];
    } else if (arg === '--year' || arg === '-y') {
      options.year = args[++i];
    } else if (arg === '--delay') {
      options.delay = parseInt(args[++i], 10) || DEFAULT_DELAY_MS;
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (!arg.startsWith('-') && !options.dept && !options.faculty) {
      // Positional argument treated as dept or faculty query
      options.dept = arg;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
סורק קטלוג הקורסים של אוניברסיטת בר-אילן (BIU Courses Crawler)
==============================================================

שימוש:
  node crawl.js [אפשרויות]

דוגמאות:
  node crawl.js --list                           # הצגת כל המחלקות והפקולטות עם המזהים שלהן
  node crawl.js --dept 84                        # סריקת מדעי המחשב (תשפ"ז 2027)
  node crawl.js --dept "מתמטיקה"                 # סריקה לפי שם מחלקה
  node crawl.js --faculty 10                     # סריקת פקולטת הנדסה
  node crawl.js --faculty "מדעים מדויקים"        # סריקת פקולטה לפי שם
  node crawl.js --year 2026 --dept 84            # סריקת שנת תשפ"ו
  node crawl.js                                  # אם הדפדפן כבר בעמוד תוצאות - יסרוק אותו אוטומטית!

אפשרויות:
  -d, --dept <id|name|slug>      מזהה מחלקה, שם או slug
  -f, --faculty <id|name|slug>   מזהה פקולטה, שם או slug
  -y, --year <year>              שנה אקדמית (ברירת מחדל: 2027)
  -l, --list                     הדפסת רשימת כל הפקולטות והמחלקות ויציאה
  -o, --output <file>            שם קובץ יעד מותאם אישית
      --delay <ms>               השהייה בין קריאות במילישניות (ברירת מחדל: 1500)
  -h, --help                     הצגת עזרה זו
`);
}

async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.list) {
    console.log(formatCatalogDirectory());
    return;
  }

  console.log('Connecting to browser on port 9222...');
  let browser;
  try {
    browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  } catch (err) {
    console.error('Could not connect to Chrome on port 9222.');
    console.error('Please ensure Chrome is running with: chrome.exe --remote-debugging-port=9222');
    process.exit(1);
  }

  // Everything collected so far; saved as a checkpoint if the site blocks us mid-crawl.
  const allRows = [];
  const rowsPerPage = {};
  const sections = {};
  const details = {};
  let checkpointFile = null;

  function stopIfBlocked(probe) {
    const block = detectBlock(probe);
    if (!block) return;
    reportBlockedCrawl(block, checkpointFile, {
      meta: {
        source: 'https://courses.biu.ac.il/CoursesView.aspx',
        captured: allRows.length,
        rows_per_page: rowsPerPage,
        detail_sections_captured: Object.keys(sections).length,
        delay_ms: options.delay
      },
      rows: allRows,
      sections,
      details
    });
    throw new CrawlBlockedError(block);
  }

  const pages = await browser.pages();
  const coursePages = pages.filter((p) => isBiuUrl(p.url()));
  if (coursePages.length === 0) {
    throw new Error('Courses page not found on port 9222! Please open courses.biu.ac.il in Chrome first.');
  }

  // A tab already showing a CAPTCHA or block page means the site is pushing back: stop.
  for (const p of coursePages) {
    stopIfBlocked({ url: p.url(), title: await p.title().catch(() => '') });
  }
  const page = coursePages[0];
  const checkNavigation = async (response) => stopIfBlocked(await probePuppeteerPage(page, response));

  console.log('Attached to page:', page.url());
  await checkNavigation(null);

  // Check if currently on a valid results page
  const currentStatus = await page.evaluate(() => {
    const table = document.getElementById('ContentPlaceHolder1_gvLessons');
    const header = document.body.innerText.match(/(\d+)\s*קורסים\s*ברשימה/);
    const count = header ? parseInt(header[1], 10) : 0;
    const activePage = document.querySelector('tr.cssPager span')?.innerText.trim() || '1';
    return {
      isResultsPage: window.location.href.includes('CoursesView.aspx') && !!table && count > 0,
      count,
      activePage
    };
  });

  let target = null;
  let year = options.year || DEFAULT_YEAR;

  if (options.faculty) {
    target = resolveTarget(options.faculty, 'faculty');
    if (!target) {
      console.error(`Faculty not found: "${options.faculty}". Use --list to see available faculties.`);
      process.exit(1);
    }
  } else if (options.dept) {
    target = resolveTarget(options.dept, 'department');
    if (!target) {
      console.error(`Department not found: "${options.dept}". Use --list to see available departments.`);
      process.exit(1);
    }
  }

  // If no target given, check if already on a search results page
  if (!target) {
    if (currentStatus.isResultsPage) {
      console.log(`\nBrowser is already on a results page with ${currentStatus.count} courses!`);
      console.log(`Proceeding to crawl active search results directly.`);
      target = {
        type: 'custom',
        id: 'active',
        name: 'חיפוש פעיל בדפדפן',
        slug: 'active-search'
      };
    } else {
      // Interactive prompt
      console.log('\nNo department or faculty specified, and browser is not on a results page.');
      const input = await promptUser('Enter department name / ID or faculty (or "list" to view, press Enter for CS 84): ');
      if (input.toLowerCase() === 'list') {
        console.log(formatCatalogDirectory());
        const input2 = await promptUser('Enter department or faculty: ');
        target = resolveTarget(input2 || '84');
      } else {
        target = resolveTarget(input || '84');
      }

      if (!target) {
        console.error('Could not resolve target. Defaulting to Computer Science (84).');
        target = resolveTarget('84');
      }
    }
  }

  console.log(`\nTarget: [${target.type.toUpperCase()}] ${target.name} (ID: ${target.id}, Slug: ${target.slug}, Year: ${year})`);

  // If a specific target was chosen and we need to perform the search
  if (target.type !== 'custom') {
    console.log(`Navigating to search page and selecting target...`);
    await checkNavigation(await page.goto('https://courses.biu.ac.il/', { waitUntil: 'networkidle2' }));
    await sleep(options.delay);

    if (target.type === 'faculty') {
      // Check if faculty dropdown is visible; if not, open advanced search
      const hasFac = await page.evaluate(() => !!document.getElementById('ContentPlaceHolder1_cmbFaculties'));
      if (!hasFac) {
        const [advResponse] = await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2' }),
          page.evaluate(() => {
            document.getElementById('ContentPlaceHolder1_btnAdvanceSearch').click();
          })
        ]);
        await checkNavigation(advResponse);
        await sleep(options.delay);
        await page.waitForSelector('#ContentPlaceHolder1_cmbFaculties', { timeout: 10000 });
      }

      await page.evaluate((targetId, yr) => {
        const yearEl = document.getElementById('ContentPlaceHolder1_cmbYear');
        if (yearEl) yearEl.value = yr;
        const facEl = document.getElementById('ContentPlaceHolder1_cmbFaculties');
        if (facEl) facEl.value = targetId;
        const deptEl = document.getElementById('ContentPlaceHolder1_cmbDepartments');
        if (deptEl) deptEl.value = '-1';
      }, target.id, year);
    } else {
      // Department search
      await page.evaluate((targetId, yr) => {
        const yearEl = document.getElementById('ContentPlaceHolder1_cmbYear');
        if (yearEl) yearEl.value = yr;
        const deptEl = document.getElementById('ContentPlaceHolder1_cmbDepartments');
        if (deptEl) deptEl.value = targetId;
        const facEl = document.getElementById('ContentPlaceHolder1_cmbFaculties');
        if (facEl) facEl.value = '-1';
      }, target.id, year);
    }

    // Submit search
    const [searchResponse] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.evaluate(() => {
        document.getElementById('ContentPlaceHolder1_btnSearch').click();
      })
    ]);
    await checkNavigation(searchResponse);
    await sleep(options.delay);
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
          const first = Array.from(document.querySelectorAll('tr.cssPager a')).find(
            (el) => el.innerText.trim() === '<<' || el.getAttribute('href')?.includes('Page$1')
          );
          if (first) first.click();
        }
      })
    ]);
    await checkNavigation(firstPageResponse);
    await sleep(options.delay);
  }

  // Read reported total courses
  const reportedTotal = await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/(\d+)\s*קורסים\s*ברשימה/);
    return match ? parseInt(match[1], 10) : 0;
  });

  if (reportedTotal === 0) {
    console.warn('No courses found in search results. Please check your search parameters.');
    return;
  }

  console.log(`Reported total courses: ${reportedTotal}`);

  // Dynamic file names
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetSlug = target.slug || 'results';
  const defaultOutputFile = path.join(__dirname, `biu-${year}-${targetSlug}-full-${todayStr}.json`);
  const OUTPUT_FILE = options.output ? path.resolve(options.output) : defaultOutputFile;
  const CHECKPOINT_FILE = path.join(__dirname, `checkpoint-${targetSlug}.json`);
  checkpointFile = CHECKPOINT_FILE;

  console.log(`Output file will be: ${OUTPUT_FILE}`);
  console.log(`Checkpoint file: ${CHECKPOINT_FILE}`);

  let currentPage = 1;

  // Extract real course rows (ignoring pager row)
  async function extractCurrentPageRows() {
    return await page.evaluate(() => {
      const table = document.getElementById('ContentPlaceHolder1_gvLessons');
      if (!table) return [];

      let idxCode = 0, idxName = 1, idxGroup = 2, idxTeachers = 3, idxKind = 4, idxSemester = 5, idxDay = 6, idxHours = 7;
      let idxBuilding = -1, idxRoom = -1, idxClassroom = -1;

      const ths = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td'));
      ths.forEach((th, idx) => {
        const txt = (th.innerText || th.textContent || '').trim();
        if (txt.includes('קוד קורס')) idxCode = idx;
        else if (txt.includes('שם קורס')) idxName = idx;
        else if (txt.includes('קבוצה')) idxGroup = idx;
        else if (txt.includes('מרצה')) idxTeachers = idx;
        else if (txt.includes('סוג מפגש')) idxKind = idx;
        else if (txt.includes('סמסטר')) idxSemester = idx;
        else if (txt.includes('יום')) idxDay = idx;
        else if (txt.includes('שעה') || txt.includes('שעות')) idxHours = idx;
        else if (txt.includes('בניין') || txt.includes('בנין')) idxBuilding = idx;
        else if (txt.includes('חדר')) idxRoom = idx;
        else if (txt.includes('כיתה') || txt.includes('מיקום') || txt.includes('אולם')) idxClassroom = idx;
      });

      const trs = Array.from(table.querySelectorAll('tr'));
      const rows = [];
      for (const tr of trs) {
        if (tr.classList.contains('cssPager') || tr.querySelector('table')) continue;
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length >= 8) {
          const code = (tds[idxCode] || tds[0]).innerText.trim();
          if (/^\d{4,7}$/.test(code)) {
            const a = tr.querySelector('a[href*="lid="]');
            const href = a ? a.getAttribute('href') || a.getAttribute('onclick') || '' : '';
            const lidMatch = href.match(/lid=(\d+)/);
            if (lidMatch) {
              const rowBuilding = idxBuilding !== -1 ? (tds[idxBuilding].innerText || '').trim() : '';
              const rowRoom = idxRoom !== -1 ? (tds[idxRoom].innerText || '').trim() : '';
              let rowClass = idxClassroom !== -1 ? (tds[idxClassroom].innerText || '').trim() : '';
              if (!rowClass && tds.length > 8 && idxBuilding === -1 && idxClassroom === -1) {
                rowClass = (tds[8].innerText || '').trim();
              }
              const rowLoc = [rowBuilding, rowRoom].filter(Boolean).join(' / ') || rowClass || '';

              rows.push({
                code: code,
                name: (tds[idxName] || tds[1]).innerText.trim(),
                group: (tds[idxGroup] || tds[2]).innerText.trim().padStart(2, '0'),
                teachers: (tds[idxTeachers] || tds[3]).innerText.trim(),
                kind: (tds[idxKind] || tds[4]).innerText.trim(),
                semester: (tds[idxSemester] || tds[5]).innerText.trim(),
                day: (tds[idxDay] || tds[6]).innerText.trim(),
                hours: (tds[idxHours] || tds[7]).innerText.trim(),
                building: rowBuilding,
                room: rowRoom,
                classroom: rowClass || rowLoc,
                location: rowLoc,
                lid: lidMatch[1]
              });
            }
          }
        }
      }
      return rows;
    });
  }

  // Walk all result pages
  console.log('\n--- Walking Result Pages ---');
  let hasMorePages = true;

  while (hasMorePages) {
    const pageRows = await extractCurrentPageRows();
    console.log(`Page ${currentPage} captured ${pageRows.length} rows (Cumulative: ${allRows.length + pageRows.length}/${reportedTotal})`);

    allRows.push(...pageRows);
    rowsPerPage[String(currentPage)] = pageRows.length;

    // Check if there is a next page
    const nextTarget = currentPage + 1;
    const canNavigateNext = await page.evaluate((targetNum) => {
      const links = Array.from(document.querySelectorAll('tr.cssPager a'));
      // Direct page number match
      const direct = links.find((a) => a.innerText.trim() === String(targetNum));
      if (direct) {
        direct.click();
        return true;
      }
      // Forward ellipsis or Page$<target> match
      const targetHref = links.find((a) => a.getAttribute('href')?.includes(`Page$${targetNum}`));
      if (targetHref) {
        targetHref.click();
        return true;
      }
      return false;
    }, nextTarget);

    if (canNavigateNext) {
      await checkNavigation(await page.waitForNavigation({ waitUntil: 'networkidle2' }));
      await sleep(options.delay);
      currentPage++;
    } else {
      console.log(`Completed pagination at page ${currentPage}.`);
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
  let detectedDept = target.name;
  let detectedFaculty = '';

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

        function getField(lblOrArray) {
          const labels = Array.isArray(lblOrArray) ? lblOrArray : [lblOrArray];
          const allEls = Array.from(doc.querySelectorAll('td, th, span, div, label, b, strong'));
          const el = allEls.find((e) => {
            const t = (e.innerText || e.textContent || '').trim().replace(/[:\s]+$/, '');
            return labels.some((lbl) => t === lbl.replace(/[:\s]+$/, ''));
          });
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
        const m = (doc.body.innerText || doc.body.textContent || '').match(/פרטי קורס\s*:\s*([^\n\r]+)/);
        if (m) title = m[1].trim();

        // Extract exam terms
        const terms = [];
        const trs = Array.from(doc.querySelectorAll('table tr')).filter((tr) =>
          (tr.innerText || tr.textContent || '').includes('מועד')
        );
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll('td')).map((td) => (td.innerText || td.textContent || '').trim());
          if (tds.length >= 3) {
            const type = tds[0] || tds.find((c) => c.includes('מועד')) || '';
            const date = tds[1] || tds.find((c) => c.match(/\d{2}\/\d{2}\/\d{4}/)) || '';
            const hour = tds[2] || tds.find((c) => c.match(/\d{2}:\d{2}/)) || '';
            if (type.includes('מועד') && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
              terms.push({ type, date, hour });
            }
          }
        }

        const building = getField(['בניין', 'בנין']) || '';
        const room = getField('חדר') || '';
        const classroom = getField(['כיתה', 'מיקום כיתה', 'מיקום', 'אולם']) || '';
        const campus = getField('קמפוס') || '';
        const location = [building, room].filter(Boolean).join(' / ') || classroom || '';

        return { probe, secData: {
          points: getField('נ"ז') || '',
          code: getField('קוד קורס') || '',
          hours: getField('שעות') || '',
          terms: terms,
          title: title,
          name_en: getField('שם קורס באנגלית') || '',
          department: getField('מחלקה') || '',
          faculty: getField('פקולטה') || '',
          kind: getField('סוג מפגש') || '',
          teachers: getField('מרצה') || '',
          day: getField('יום') || '',
          session_hours: getField('שעה') || '',
          building: building,
          room: room,
          classroom: classroom || location,
          location: location || classroom,
          campus: campus,
          remark: getField('הערה') || '',
          clusters: getField('אפיונים') || '',
          syllabus: `CourseSylabusView.aspx?lid=${lId}`
        } };
      }, lid);
      stopIfBlocked(probe);

      // Backfill classroom into row if row was empty
      if (!row.building && secData.building) row.building = secData.building;
      if (!row.room && secData.room) row.room = secData.room;
      if (!row.classroom && secData.classroom) row.classroom = secData.classroom;
      if (!row.location && secData.location) row.location = secData.location;

      if (secData.department && !detectedDept) detectedDept = secData.department;
      if (secData.faculty && !detectedFaculty) detectedFaculty = secData.faculty;

      sections[lid] = secData;

      const pairKey = `${row.code}|${row.semester}`;
      if (!details[pairKey]) {
        details[pairKey] = secData;
      }

      console.log(`OK (terms: ${secData.terms.length})`);
    } catch (err) {
      if (err instanceof CrawlBlockedError) throw err;
      console.log(`ERROR: ${err.message}`);
    }

    if (count % 10 === 0) {
      const checkpointResult = {
        meta: {
          schema: 2,
          year: year,
          target_type: target.type,
          target_id: target.id,
          target_name: detectedDept || target.name,
          faculty: detectedFaculty,
          label: `${year}-${targetSlug}`,
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
          delay_ms: options.delay,
          complete: false
        },
        rows: allRows,
        sections: sections,
        details: details
      };
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpointResult, null, 2), 'utf8');
    }

    await sleep(options.delay);
  }

  // Build final complete JSON
  const isComplete =
    allRows.length === reportedTotal &&
    Object.keys(sections).length === uniqueTuples.length &&
    Object.keys(details).length === pairSet.size;

  const finalData = {
    meta: {
      schema: 2,
      year: year,
      target_type: target.type,
      target_id: target.id,
      target_name: detectedDept || target.name,
      faculty: detectedFaculty,
      label: `${year}-${targetSlug}`,
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
      delay_ms: options.delay,
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
  console.log(`Department: ${finalData.meta.target_name}`);
  if (detectedFaculty) console.log(`Faculty: ${detectedFaculty}`);
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
