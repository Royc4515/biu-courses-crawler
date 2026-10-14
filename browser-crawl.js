/**
 * Bar-Ilan University (BIU) Universal Course Catalog Crawler
 * Runs directly in the browser Console on https://courses.biu.ac.il
 * 
 * Works for ANY Department / Faculty in the University!
 * 
 * Features:
 * - Standalone (zero dependencies, copy-paste into DevTools Console)
 * - Single-step execution: NO need to paste twice! Searches via background fetch if on search page
 * - Auto-detects active search results if already on CoursesView.aspx
 * - Interactive UI with crystal-clear high contrast styling
 * - Progress indicator banner with live status
 * - Complete summary screen with [Download Again], [Copy JSON] and [Close] buttons
 * - Auto-downloads biu-<year>-<slug>-full-<date>.json
 */
(function() {
  const DELAY_MS = 1500;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  const FACULTIES = [
    { id: "1", name: "מדעי היהדות", slug: "jewish-studies" },
    { id: "2", name: "מדעי הרוח", slug: "humanities" },
    { id: "3", name: "מדעי החברה", slug: "social-sciences" },
    { id: "4", name: "מדעים מדויקים", slug: "exact-sciences" },
    { id: "5", name: "משפטים", slug: "law" },
    { id: "6", name: "כללי", slug: "general" },
    { id: "7", name: "יחידה ללימודים בין תחומיים", slug: "interdisciplinary" },
    { id: "8", name: "מדעי החיים", slug: "life-sciences" },
    { id: "9", name: "רפואה", slug: "medicine" },
    { id: "10", name: "הנדסה", slug: "engineering" },
    { id: "12", name: "חינוך", slug: "education" }
  ];

  const DEPARTMENTS = [
    { id: "88", name: "ב.א. רב-תחומי", slug: "multidisciplinary-ba" },
    { id: "53", name: "ב.א. רב-תחומי במדעי הרוח", slug: "humanities-ba" },
    { id: "78", name: "ביה\"ס לאופטומטריה ומדעי הראייה", slug: "optometry" },
    { id: "66", name: "ביה\"ס למינהל עסקים", slug: "business-admin" },
    { id: "59", name: "ביה\"ס לתקשורת", slug: "communication" },
    { id: "72", name: "בית הספר לעבודה סוציאלית ע\"ש לואיס וגבי וייספלד", slug: "social-work" },
    { id: "89", name: "דיפלומה", slug: "diploma" },
    { id: "17", name: "החוג הרב-תחומי במדעי היהדות", slug: "jewish-multidisciplinary" },
    { id: "40", name: "היחידה לאנגלית כשפה זרה", slug: "english-efl" },
    { id: "6", name: "היחידה להבעה אקדמית ואולפן", slug: "academic-expression-ulpan" },
    { id: "56", name: "היחידה ללימודי תקשורת ועיתונאות", slug: "journalism" },
    { id: "50", name: "היחידה לשפות", slug: "languages" },
    { id: "10", name: "המגמה לתושב\"ע", slug: "oral-law" },
    { id: "5", name: "המדרשה לנשים", slug: "midrasha" },
    { id: "21", name: "המחלקה לאומנות יהודית", slug: "jewish-art" },
    { id: "36", name: "המחלקה לבלשנות וספרות אנגלית", slug: "english-literature-linguistics" },
    { id: "18", name: "המחלקה להיסטוריה כללית", slug: "general-history" },
    { id: "11", name: "המחלקה להיסטוריה של עם ישראל ויהדות זמננו", slug: "jewish-history" },
    { id: "80", name: "המחלקה לכימיה", slug: "chemistry" },
    { id: "62", name: "המחלקה לכלכלה", slug: "economics" },
    { id: "39", name: "המחלקה ללימודי אסיה", slug: "asian-studies" },
    { id: "16", name: "המחלקה ללימודי ארץ ישראל וארכיאולוגיה", slug: "israel-studies-archaeology" },
    { id: "19", name: "המחלקה ללימודי המזרח התיכון", slug: "middle-eastern-studies" },
    { id: "45", name: "המחלקה ללימודים קלאסיים", slug: "classics" },
    { id: "12", name: "המחלקה ללשון העברית וללשונות שמיות", slug: "hebrew-semitic-languages" },
    { id: "67", name: "המחלקה למדעי המדינה", slug: "political-science" },
    { id: "84", name: "המחלקה למדעי המחשב", slug: "cs" },
    { id: "34", name: "המחלקה למדעי המידע וליישומי בינה מלאכותית", slug: "data-science-ai" },
    { id: "70", name: "המחלקה למדעי חברה ובריאות", slug: "health-social-sciences" },
    { id: "46", name: "המחלקה למוזיקה", slug: "music" },
    { id: "83", name: "המחלקה למתמטיקה", slug: "math" },
    { id: "54", name: "המחלקה לניהול", slug: "management" },
    { id: "71", name: "המחלקה לסביבה, תכנון וקיימות", slug: "geography-sustainability" },
    { id: "60", name: "המחלקה לסוציולוגיה ואנתרופולוגיה", slug: "sociology-anthropology" },
    { id: "32", name: "המחלקה לספרות משווה", slug: "comparative-literature" },
    { id: "13", name: "המחלקה לספרות עם ישראל ע\"ש יוסף ונחום ברמן", slug: "hebrew-literature" },
    { id: "35", name: "המחלקה לערבית", slug: "arabic" },
    { id: "81", name: "המחלקה לפיזיקה", slug: "physics" },
    { id: "30", name: "המחלקה לפילוסופיה", slug: "philosophy" },
    { id: "29", name: "המחלקה לפילוסופיה יהודית", slug: "jewish-philosophy" },
    { id: "58", name: "המחלקה לפסיכולוגיה", slug: "psychology" },
    { id: "69", name: "המחלקה לקרימינולוגיה", slug: "criminology" },
    { id: "9", name: "המחלקה לתלמוד ותושב\"ע ע\"ש נפתלי יפה", slug: "talmud" },
    { id: "8", name: "המחלקה לתנ\"ך על שם זלמן שמיר", slug: "bible" },
    { id: "42", name: "המחלקה לתרבות צרפת", slug: "french-studies" },
    { id: "49", name: "המחלקה לתרגום וחקר התרגום", slug: "translation-studies" },
    { id: "7", name: "המכון הגבוה לתורה", slug: "torah-institute" },
    { id: "68", name: "המכון לשלטון מקומי", slug: "local-government" },
    { id: "79", name: "הפקולטה להנדסה ע\"ש אלכסנדר קופקין", slug: "engineering" },
    { id: "73", name: "הפקולטה לחינוך ע\"ש פנחס חורגין", slug: "education" },
    { id: "76", name: "הפקולטה למדעי החיים ע\"ש מינה ואבררד גודמן", slug: "life-sciences" },
    { id: "94", name: "הפקולטה למשפטים", slug: "law" },
    { id: "77", name: "הפקולטה לרפואה", slug: "medicine" },
    { id: "97", name: "יהדות זמננו", slug: "contemporary-jewry" },
    { id: "98", name: "לימודי מגדר", slug: "gender-studies" },
    { id: "22", name: "לימודי תעודה בעריכה", slug: "editing-studies" },
    { id: "26", name: "לימודים בין-תחומיים", slug: "interdisciplinary-studies" },
    { id: "99", name: "מדע, טכנולוגיה וחברה", slug: "sts" },
    { id: "96", name: "מדעי המוח", slug: "brain-sciences" },
    { id: "101", name: "מדעי המוח לתארים מתקדמים", slug: "advanced-brain-sciences" },
    { id: "100", name: "ניהול ויישוב סכסוכים", slug: "conflict-resolution" },
    { id: "57", name: "ע\"ס-לימודי חוץ", slug: "social-work-ext" },
    { id: "1", name: "עולמות- בית הספר ללימודי יהדות ותרבות ישראלית", slug: "olamot-jewish-studies" },
    { id: "95", name: "פרשנות ותרבות", slug: "hermeneutics-culture" },
    { id: "25", name: "תכנית ברוקדייל", slug: "brookdale-program" },
    { id: "75", name: "תעודת הוראה", slug: "teaching-certificate" }
  ];

  let abortRequested = false;

  function createBanner() {
    let b = document.getElementById('crawler-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'crawler-banner';
      b.style.cssText =
        'position:fixed;top:15px;right:15px;z-index:999999;background:#0f172a;color:#f8fafc;' +
        'padding:18px 22px;border-radius:14px;box-shadow:0 12px 35px rgba(0,0,0,0.65);' +
        'font-family:system-ui,-apple-system,sans-serif;direction:rtl;min-width:340px;max-width:440px;' +
        'font-size:14px;line-height:1.5;border:1px solid #334155;transition:all 0.3s;';
      document.body.appendChild(b);
    }
    return b;
  }

  function updateStatus(title, detail, canCancel = true) {
    const banner = createBanner();
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-weight:bold;font-size:15px;color:#38bdf8;">${title}</span>
        <span style="font-size:11px;background:#1e293b;padding:2px 8px;border-radius:6px;color:#94a3b8;">BIU Crawler</span>
      </div>
      <div style="color:#cbd5e1;font-size:13px;margin-bottom:${canCancel ? '8px' : '0'};">${detail}</div>
      ${canCancel ? `
        <div style="text-align:left;margin-top:6px;">
          <button id="crawler-cancel-crawl-btn" style="background:transparent;border:1px solid #475569;color:#94a3b8;border-radius:6px;font-size:11px;padding:3px 10px;cursor:pointer;transition:0.2s;">
            ⏹️ עצור וחזור לתפריט
          </button>
        </div>
      ` : ''}
    `;

    const cancelBtn = document.getElementById('crawler-cancel-crawl-btn');
    if (cancelBtn) {
      cancelBtn.onmouseover = () => { cancelBtn.style.color = '#f87171'; cancelBtn.style.borderColor = '#f87171'; };
      cancelBtn.onmouseout = () => { cancelBtn.style.color = '#94a3b8'; cancelBtn.style.borderColor = '#475569'; };
      cancelBtn.onclick = () => {
        abortRequested = true;
        banner.remove();
        showInteractiveDialog();
      };
    }
    console.log(`[BIU Crawler] ${title} - ${detail}`);
  }

  function showErrorBanner(title, detail) {
    const banner = createBanner();
    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-weight:bold;font-size:16px;color:#ef4444;">⚠️ ${title}</span>
        <button id="crawler-banner-close" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">&times;</button>
      </div>
      <div style="color:#cbd5e1;font-size:13px;margin-bottom:14px;line-height:1.5;">${detail}</div>
      <button id="crawler-menu-btn" style="width:100%;padding:10px;background:#1e293b;border:1px solid #38bdf8;color:#38bdf8;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;transition:0.2s;">
        🔄 חזרה לתפריט הבחירה
      </button>
    `;

    document.getElementById('crawler-banner-close').onclick = () => {
      banner.remove();
      createReopenPill();
    };

    const menuBtn = document.getElementById('crawler-menu-btn');
    if (menuBtn) {
      menuBtn.onmouseover = () => { menuBtn.style.background = '#0284c7'; menuBtn.style.color = '#fff'; };
      menuBtn.onmouseout = () => { menuBtn.style.background = '#1e293b'; menuBtn.style.color = '#38bdf8'; };
      menuBtn.onclick = () => {
        banner.remove();
        showInteractiveDialog();
      };
    }
  }

  function showCompletionBanner(finalResult, outputFileName) {
    const banner = createBanner();
    const rowsCount = finalResult.rows.length;
    const sectionsCount = Object.keys(finalResult.sections || {}).length;
    const jsonStr = JSON.stringify(finalResult, null, 2);
    const sizeKb = Math.round(jsonStr.length / 1024);

    banner.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <span style="font-weight:bold;font-size:16px;color:#10b981;">🎉 הסריקה הושלמה בהצלחה!</span>
        <button id="crawler-banner-close" style="background:transparent;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;">&times;</button>
      </div>

      <div style="background:#1e293b;padding:12px;border-radius:8px;margin-bottom:14px;font-size:13px;line-height:1.6;color:#e2e8f0;border:1px solid #334155;">
        <div>📊 סך הכל קורסים: <b style="color:#38bdf8;">${rowsCount}</b></div>
        <div>📋 סקשנים ומבחנים: <b style="color:#38bdf8;">${sectionsCount}</b></div>
        <div>💾 קובץ: <b style="color:#f1f5f9;word-break:break-all;">${outputFileName}</b> (${sizeKb} KB)</div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:10px;">
        <button id="crawler-redownload-btn" style="flex:1;padding:10px;background:#0284c7;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;transition:0.2s;">
          ⬇️ שמור קובץ
        </button>
        <button id="crawler-copy-btn" style="padding:10px 14px;background:#334155;color:#e2e8f0;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;">
          📋 העתק JSON
        </button>
      </div>

      <button id="crawler-menu-btn" style="width:100%;padding:11px;background:#1e293b;border:1px solid #38bdf8;color:#38bdf8;border-radius:8px;font-weight:bold;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;transition:0.2s;">
        🔄 סריקה חדשה (חזרה לתפריט הבחירה)
      </button>

      <div id="crawler-copy-msg" style="display:none;color:#38bdf8;font-size:12px;text-align:center;margin-top:8px;">הועתק ללוח!</div>
    `;

    const downloadFile = () => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = outputFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    };

    // Auto-download once
    downloadFile();

    document.getElementById('crawler-banner-close').onclick = () => {
      banner.remove();
      createReopenPill();
    };

    document.getElementById('crawler-redownload-btn').onclick = downloadFile;

    document.getElementById('crawler-copy-btn').onclick = () => {
      navigator.clipboard.writeText(jsonStr).then(() => {
        const msg = document.getElementById('crawler-copy-msg');
        if (msg) {
          msg.style.display = 'block';
          setTimeout(() => { if (msg) msg.style.display = 'none'; }, 2500);
        }
      });
    };

    const menuBtn = document.getElementById('crawler-menu-btn');
    if (menuBtn) {
      menuBtn.onmouseover = () => { menuBtn.style.background = '#0284c7'; menuBtn.style.color = '#fff'; };
      menuBtn.onmouseout = () => { menuBtn.style.background = '#1e293b'; menuBtn.style.color = '#38bdf8'; };
      menuBtn.onclick = () => {
        banner.remove();
        showInteractiveDialog();
      };
    }
  }

  function createReopenPill() {
    let pill = document.getElementById('crawler-reopen-pill');
    if (pill) return;
    pill = document.createElement('button');
    pill.id = 'crawler-reopen-pill';
    pill.style.cssText =
      'position:fixed;top:15px;right:15px;z-index:999999;background:#0f172a;color:#38bdf8;' +
      'padding:9px 16px;border-radius:22px;border:1px solid #38bdf8;box-shadow:0 8px 24px rgba(0,0,0,0.65);' +
      'font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:bold;cursor:pointer;' +
      'display:flex;align-items:center;gap:6px;direction:rtl;transition:all 0.2s;';
    pill.innerHTML = '🔍 פתח סורק קורסים';
    pill.onmouseover = () => { pill.style.background = '#0284c7'; pill.style.color = '#fff'; };
    pill.onmouseout = () => { pill.style.background = '#0f172a'; pill.style.color = '#38bdf8'; };
    pill.onclick = () => {
      pill.remove();
      showInteractiveDialog();
    };
    document.body.appendChild(pill);
  }

  function getText(el) {
    if (!el) return '';
    const t = el.innerText;
    if (t !== undefined && t !== null && t.trim() !== '') return t.trim();
    return (el.textContent || '').trim();
  }

  function parseTableRowsFromDoc(d) {
    const table = d.getElementById('ContentPlaceHolder1_gvLessons');
    if (!table) return [];

    let idxCode = 0, idxName = 1, idxGroup = 2, idxTeachers = 3, idxKind = 4, idxSemester = 5, idxDay = 6, idxHours = 7;
    let idxBuilding = -1, idxRoom = -1, idxClassroom = -1;

    const ths = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td'));
    ths.forEach((th, idx) => {
      const txt = getText(th);
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
        const code = getText(tds[idxCode] || tds[0]);
        if (/^\d{4,7}$/.test(code)) {
          const a = tr.querySelector('a[href*="lid="]');
          const href = a ? a.getAttribute('href') || a.getAttribute('onclick') || '' : '';
          const lidMatch = href.match(/lid=(\d+)/);
          if (lidMatch) {
            const rowBuilding = idxBuilding !== -1 ? getText(tds[idxBuilding]) : '';
            const rowRoom = idxRoom !== -1 ? getText(tds[idxRoom]) : '';
            let rowClass = idxClassroom !== -1 ? getText(tds[idxClassroom]) : '';
            if (!rowClass && tds.length > 8 && idxBuilding === -1 && idxClassroom === -1) {
              rowClass = getText(tds[8]);
            }
            const rowLoc = [rowBuilding, rowRoom].filter(Boolean).join(' / ') || rowClass || '';

            rows.push({
              code: code,
              name: getText(tds[idxName] || tds[1]),
              group: getText(tds[idxGroup] || tds[2]).padStart(2, '0'),
              teachers: getText(tds[idxTeachers] || tds[3]),
              kind: getText(tds[idxKind] || tds[4]),
              semester: getText(tds[idxSemester] || tds[5]),
              day: getText(tds[idxDay] || tds[6]),
              hours: getText(tds[idxHours] || tds[7]),
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
  }

  async function crawlFromDocument(initialDoc, targetMeta = {}) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const yr = targetMeta.year || '2027';

    // 1. Walk all result pages
    const allRows = [];
    const rowsPerPage = {};
    let pageNum = 1;

    const reportedMatch = getText(initialDoc.body).match(/(\d+)\s*קורסים\s*ברשימה/);
    const reportedTotal = reportedMatch ? parseInt(reportedMatch[1], 10) : 0;

    if (reportedTotal === 0) {
      updateStatus('שגיאה', 'לא נמצאו קורסים ברשימת התוצאות.');
      return;
    }

    let currentDoc = initialDoc;
    let hasMore = true;

    while (hasMore) {
      const pageRows = parseTableRowsFromDoc(currentDoc);
      console.log(`Page ${pageNum} captured ${pageRows.length} rows.`);
      allRows.push(...pageRows);
      rowsPerPage[pageNum] = pageRows.length;
      updateStatus(`עמוד ${pageNum} נסרק`, `נאספו ${allRows.length} מתוך ${reportedTotal} קורסים`);

      const nextTarget = pageNum + 1;
      const links = Array.from(currentDoc.querySelectorAll('tr.cssPager a'));
      let nextLink = links.find((a) => getText(a) === String(nextTarget));
      if (!nextLink) {
        nextLink = links.find((a) => a.getAttribute('href')?.includes(`Page$${nextTarget}`));
      }

      if (!nextLink) {
        hasMore = false;
        break;
      }

      const href = nextLink.getAttribute('href') || '';
      const match = href.match(/__doPostBack\('([^']*)','([^']*)'\)/);
      if (!match) {
        hasMore = false;
        break;
      }

      const eventTarget = match[1];
      const eventArgument = match[2];

      const vs = currentDoc.querySelector('input[name="__VIEWSTATE"]')?.value || '';
      const ev = currentDoc.querySelector('input[name="__EVENTVALIDATION"]')?.value || '';
      const vsg = currentDoc.querySelector('input[name="__VIEWSTATEGENERATOR"]')?.value || '';

      const formData = new URLSearchParams();
      formData.append('__EVENTTARGET', eventTarget);
      formData.append('__EVENTARGUMENT', eventArgument);
      formData.append('__VIEWSTATE', vs);
      formData.append('__EVENTVALIDATION', ev);
      if (vsg) formData.append('__VIEWSTATEGENERATOR', vsg);

      await sleep(DELAY_MS);
      const res = await fetch('https://courses.biu.ac.il/CoursesView.aspx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });

      const nextHtml = await res.text();
      const parser = new DOMParser();
      currentDoc = parser.parseFromString(nextHtml, 'text/html');
      pageNum++;
    }

    updateStatus('איסוף שורות הושלם!', `נאספו ${allRows.length} שורות. עובר לשליפת פרטי קורסים ומבחנים...`);
    await sleep(1000);

    // 2. Collect unique sections (code|kind|semester)
    const tupleMap = new Map();
    for (const row of allRows) {
      const tupleKey = `${row.code}|${row.kind}|${row.semester}`;
      if (!tupleMap.has(tupleKey)) {
        tupleMap.set(tupleKey, row);
      }
    }

    const uniqueTuples = Array.from(tupleMap.entries());
    const pairSet = new Set(allRows.map((r) => `${r.code}|${r.semester}`));

    const sections = {};
    const details = {};

    let count = 0;
    let detectedDept = targetMeta.name || '';
    let detectedFaculty = '';

    for (const [tupleKey, row] of uniqueTuples) {
      count++;
      const lid = row.lid;
      updateStatus(`שולף פרטים (${count}/${uniqueTuples.length})`, `LID: ${lid} (${row.code} - ${row.name})`);
      await sleep(DELAY_MS);

      try {
        const dRes = await fetch(`CourseDetails.aspx?lid=${lid}`);
        const dHtml = await dRes.text();
        const parser = new DOMParser();
        const dDoc = parser.parseFromString(dHtml, 'text/html');

        function getField(lblOrArray) {
          const labels = Array.isArray(lblOrArray) ? lblOrArray : [lblOrArray];
          const allEls = Array.from(dDoc.querySelectorAll('td, th, span, div, label, b, strong'));
          const el = allEls.find((e) => {
            const t = getText(e).replace(/[:\s]+$/, '');
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
        const m = getText(dDoc.body).match(/פרטי קורס\s*:\s*([^\n\r]+)/);
        if (m) title = m[1].trim();

        const terms = [];
        const trs = Array.from(dDoc.querySelectorAll('table tr')).filter((tr) =>
          getText(tr).includes('מועד')
        );
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll('td')).map((td) => getText(td));
          if (tds.length >= 3) {
            const type = tds[0] || tds.find((c) => c.includes('מועד')) || '';
            const date = tds[1] || tds.find((c) => c.match(/\d{2}\/\d{2}\/\d{4}/)) || '';
            const hour = tds[2] || tds.find((c) => c.match(/\d{2}:\d{2}/)) || '';
            if (type.includes('מועד') && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
              terms.push({ type, date, hour });
            }
          }
        }

        const building = getField(['בניין', 'בנין']) || row.building || '';
        const room = getField('חדר') || row.room || '';
        const classroom = getField(['כיתה', 'מיקום כיתה', 'מיקום', 'אולם']) || row.classroom || '';
        const campus = getField('קמפוס') || '';
        const location = [building, room].filter(Boolean).join(' / ') || classroom || row.location || '';

        // Backfill row if empty
        if (!row.building && building) row.building = building;
        if (!row.room && room) row.room = room;
        if (!row.classroom && (classroom || location)) row.classroom = classroom || location;
        if (!row.location && (location || classroom)) row.location = location || classroom;

        const secData = {
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
          syllabus: `CourseSylabusView.aspx?lid=${lid}`
        };

        // Fallback: check if building/room appears in session_hours or hours
        if (!secData.classroom && !secData.location) {
          const hStr = `${secData.session_hours} ${row.hours || ''}`;
          const matchLoc = hStr.match(/(?:בניין|בנין|חדר|כיתה)\s*[\d\w\-\/]+/i);
          if (matchLoc) {
            secData.location = matchLoc[0];
            secData.classroom = matchLoc[0];
            row.location = matchLoc[0];
            row.classroom = matchLoc[0];
          }
        }

        if (secData.department && !detectedDept) detectedDept = secData.department;
        if (secData.faculty && !detectedFaculty) detectedFaculty = secData.faculty;

        sections[lid] = secData;

        const pairKey = `${row.code}|${row.semester}`;
        if (!details[pairKey]) {
          details[pairKey] = secData;
        }
      } catch (err) {
        console.error(`Error fetching lid ${lid}:`, err);
      }
    }

    // Determine slug
    let targetSlug = targetMeta.slug;
    if (!targetSlug) {
      const matchDept = DEPARTMENTS.find(d => d.name === detectedDept);
      if (matchDept) targetSlug = matchDept.slug;
      else {
        const matchFac = FACULTIES.find(f => f.name === detectedFaculty);
        if (matchFac) targetSlug = matchFac.slug;
        else targetSlug = 'courses';
      }
    }

    const outputFileName = `biu-${yr}-${targetSlug}-full-${dateStr}.json`;

    // 3. Final JSON compilation
    const isComplete =
      allRows.length === reportedTotal &&
      Object.keys(sections).length === uniqueTuples.length &&
      Object.keys(details).length === pairSet.size;

    const finalResult = {
      meta: {
        schema: 2,
        year: yr,
        target_type: targetMeta.type || 'detected',
        target_id: targetMeta.id || null,
        target_name: detectedDept || targetMeta.name || null,
        faculty: detectedFaculty || null,
        label: `${yr}-${targetSlug}`,
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

    // Show completion dashboard
    showCompletionBanner(finalResult, outputFileName);
  }

  /**
   * Performs the initial search via background fetch so that the page NEVER navigates away!
   * This guarantees that the Console script stays alive and the user never has to paste twice!
   */
  /**
   * Performs the initial search via background fetch so that the page NEVER navigates away!
   * This guarantees that the Console script stays alive and consecutive scans work seamlessly!
   */
  async function performBackgroundSearchAndCrawl({ year, dept, faculty }) {
    abortRequested = false;
    updateStatus('מבצע חיפוש נתונים מהשרת...', 'טוען קטלוג קורסים...', true);

    let targetDoc = null;
    // Check if current page is the root search form with btnSearch
    if (document.getElementById('ContentPlaceHolder1_btnSearch') || (document.getElementById('ContentPlaceHolder1_cmbDepartments') && !document.getElementById('ContentPlaceHolder1_gvLessons'))) {
      targetDoc = document;
    } else {
      // We are on CoursesView.aspx or another page - fetch fresh root search page
      try {
        const homeRes = await fetch('https://courses.biu.ac.il/', { credentials: 'include' });
        const homeHtml = await homeRes.text();
        targetDoc = new DOMParser().parseFromString(homeHtml, 'text/html');
      } catch (e) {
        console.warn('Could not fetch root page viewstate, falling back to document inputs', e);
        targetDoc = document;
      }
    }

    if (abortRequested) {
      const banner = document.getElementById('crawler-banner');
      if (banner) banner.remove();
      showInteractiveDialog();
      return;
    }

    // If searching by faculty and cmbFaculties is hidden, toggle advanced search first
    if (faculty && !targetDoc.getElementById('ContentPlaceHolder1_cmbFaculties')) {
      try {
        const curVs = targetDoc.querySelector('input[name="__VIEWSTATE"]')?.value || '';
        const curEv = targetDoc.querySelector('input[name="__EVENTVALIDATION"]')?.value || '';
        const curVsg = targetDoc.querySelector('input[name="__VIEWSTATEGENERATOR"]')?.value || '';

        const advForm = new URLSearchParams();
        advForm.append('__VIEWSTATE', curVs);
        advForm.append('__EVENTVALIDATION', curEv);
        if (curVsg) advForm.append('__VIEWSTATEGENERATOR', curVsg);
        advForm.append('ctl00$ContentPlaceHolder1$btnAdvanceSearch', 'חיפוש מתקדם');

        const advRes = await fetch('https://courses.biu.ac.il/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: advForm.toString(),
          credentials: 'include'
        });
        const advHtml = await advRes.text();
        targetDoc = new DOMParser().parseFromString(advHtml, 'text/html');
      } catch (advErr) {
        console.warn('Failed to toggle advanced search:', advErr);
      }
    }

    if (abortRequested) {
      const banner = document.getElementById('crawler-banner');
      if (banner) banner.remove();
      showInteractiveDialog();
      return;
    }

    const vs = targetDoc.querySelector('input[name="__VIEWSTATE"]')?.value || '';
    const ev = targetDoc.querySelector('input[name="__EVENTVALIDATION"]')?.value || '';
    const vsg = targetDoc.querySelector('input[name="__VIEWSTATEGENERATOR"]')?.value || '';

    const formData = new URLSearchParams();
    formData.append('__VIEWSTATE', vs);
    formData.append('__EVENTVALIDATION', ev);
    if (vsg) formData.append('__VIEWSTATEGENERATOR', vsg);
    formData.append('ctl00$ContentPlaceHolder1$cmbYear', year);

    let targetMeta = { year };

    if (faculty) {
      const facObj = FACULTIES.find(f => f.id === String(faculty) || f.slug === String(faculty) || f.name.includes(String(faculty)));
      formData.append('ctl00$ContentPlaceHolder1$cmbFaculties', facObj ? facObj.id : String(faculty));
      formData.append('ctl00$ContentPlaceHolder1$cmbDepartments', '-1');
      if (facObj) targetMeta = { ...targetMeta, type: 'faculty', ...facObj };
    } else {
      const deptId = dept || '84';
      const deptObj = DEPARTMENTS.find(d => d.id === String(deptId) || d.slug === String(deptId) || d.name.includes(String(deptId)));
      formData.append('ctl00$ContentPlaceHolder1$cmbDepartments', deptObj ? deptObj.id : String(deptId));
      if (deptObj) targetMeta = { ...targetMeta, type: 'department', ...deptObj };
    }

    formData.append('ctl00$ContentPlaceHolder1$btnSearch', 'חיפוש');

    try {
      const res = await fetch('https://courses.biu.ac.il/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
        credentials: 'include'
      });

      const html = await res.text();
      const parser = new DOMParser();
      let resultsDoc = parser.parseFromString(html, 'text/html');

      let table = resultsDoc.getElementById('ContentPlaceHolder1_gvLessons');
      if (!table) {
        // Fallback: check if server redirected to CoursesView.aspx
        const resView = await fetch('https://courses.biu.ac.il/CoursesView.aspx', { credentials: 'include' });
        const viewHtml = await resView.text();
        const viewDoc = parser.parseFromString(viewHtml, 'text/html');
        if (viewDoc.getElementById('ContentPlaceHolder1_gvLessons')) {
          resultsDoc = viewDoc;
          table = viewDoc.getElementById('ContentPlaceHolder1_gvLessons');
        }
      }

      if (!table) {
        showErrorBanner('לא נמצאו תוצאות', 'השרת לא החזיר טבלת קורסים עבור החיפוש המבוקש. אנא נסה לבחור מחלקה או שנה אחרת.');
        return;
      }

      await crawlFromDocument(resultsDoc, targetMeta);
    } catch (err) {
      console.error('Search request failed:', err);
      showErrorBanner('שגיאה בתקשורת', err.message);
    }
  }

  function showInteractiveDialog() {
    let pill = document.getElementById('crawler-reopen-pill');
    if (pill) pill.remove();

    let existing = document.getElementById('biu-crawler-modal');
    if (existing) existing.remove();

    const currentTable = document.getElementById('ContentPlaceHolder1_gvLessons');
    let activePageSection = '';
    if (currentTable) {
      activePageSection = `
        <div style="margin-bottom:14px;padding:12px;background:#1e293b;border:1px solid #0284c7;border-radius:10px;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">זוהו תוצאות קורסים שמוצגות כעת במסך</div>
          <button id="biu-crawl-active-btn" type="button" style="width:100%;padding:9px;background:#0369a1;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:bold;cursor:pointer;transition:0.2s;">
            🎯 סרוק את התוצאות שמוצגות כעת במסך
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
          <div style="flex:1;height:1px;background:#334155;"></div>
          <span style="font-size:12px;color:#64748b;">או בחר והתחל סריקה חדשה</span>
          <div style="flex:1;height:1px;background:#334155;"></div>
        </div>
      `;
    }

    const modal = document.createElement('div');
    modal.id = 'biu-crawler-modal';
    modal.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999999;' +
      'background:#0f172a;color:#f8fafc;padding:26px 30px;border-radius:18px;' +
      'box-shadow:0 25px 60px rgba(0,0,0,0.85);font-family:system-ui,-apple-system,sans-serif;' +
      'direction:rtl;width:480px;max-width:92vw;border:1px solid #334155;';

    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h3 style="margin:0;font-size:18px;color:#38bdf8;font-weight:700;">סורק קורסים אוניברסיטאי - בר-אילן</h3>
        <button id="biu-close-btn" style="background:transparent;border:none;color:#94a3b8;font-size:22px;cursor:pointer;">&times;</button>
      </div>

      ${activePageSection}

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#cbd5e1;">שנה אקדמית:</label>
        <select id="biu-year-sel" style="width:100%;height:42px;padding:6px 12px;background:#ffffff !important;border:2px solid #38bdf8;border-radius:8px;color:#000000 !important;-webkit-text-fill-color:#000000 !important;font-size:15px;font-weight:600;outline:none;direction:rtl;display:block;">
          <option value="2027" style="color:#000000 !important;background:#ffffff !important;">תשפ"ז - 2027</option>
          <option value="2026" style="color:#000000 !important;background:#ffffff !important;">תשפ"ו - 2026</option>
          <option value="2025" style="color:#000000 !important;background:#ffffff !important;">תשפ"ה - 2025</option>
        </select>
      </div>

      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#cbd5e1;">בחר אופן סריקה:</label>
        <div style="display:flex;gap:16px;margin-bottom:10px;">
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:14px;color:#f1f5f9;font-weight:600;">
            <input type="radio" name="biu-type" value="department" checked style="accent-color:#38bdf8;width:18px;height:18px;" />
            לפי מחלקה
          </label>
          <label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:14px;color:#f1f5f9;font-weight:600;">
            <input type="radio" name="biu-type" value="faculty" style="accent-color:#38bdf8;width:18px;height:18px;" />
            לפי פקולטה
          </label>
        </div>

        <div id="biu-dept-container">
          <select id="biu-dept-sel" style="width:100%;height:42px;padding:6px 12px;background:#ffffff !important;border:2px solid #38bdf8;border-radius:8px;color:#000000 !important;-webkit-text-fill-color:#000000 !important;font-size:15px;font-weight:600;outline:none;direction:rtl;display:block;">
            ${DEPARTMENTS.map(d => `<option value="${d.id}" ${d.id === '84' ? 'selected' : ''} style="color:#000000 !important;background:#ffffff !important;">${d.name} (${d.slug})</option>`).join('')}
          </select>
        </div>

        <div id="biu-fac-container" style="display:none;">
          <select id="biu-fac-sel" style="width:100%;height:42px;padding:6px 12px;background:#ffffff !important;border:2px solid #38bdf8;border-radius:8px;color:#000000 !important;-webkit-text-fill-color:#000000 !important;font-size:15px;font-weight:600;outline:none;direction:rtl;display:block;">
            ${FACULTIES.map(f => `<option value="${f.id}" ${f.id === '10' ? 'selected' : ''} style="color:#000000 !important;background:#ffffff !important;">${f.name} (${f.slug})</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:22px;">
        <button id="biu-start-btn" style="flex:1;padding:12px;background:#0284c7;color:#fff;border:none;border-radius:9px;font-weight:bold;cursor:pointer;font-size:15px;transition:0.2s;">התחל סריקה 🚀</button>
        <button id="biu-cancel-btn" style="padding:12px 18px;background:#334155;color:#e2e8f0;border:none;border-radius:9px;cursor:pointer;font-size:14px;">ביטול</button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('biu-close-btn');
    const cancelBtn = document.getElementById('biu-cancel-btn');
    const startBtn = document.getElementById('biu-start-btn');
    const crawlActiveBtn = document.getElementById('biu-crawl-active-btn');
    const radioDept = modal.querySelector('input[value="department"]');
    const radioFac = modal.querySelector('input[value="faculty"]');
    const deptCont = document.getElementById('biu-dept-container');
    const facCont = document.getElementById('biu-fac-container');

    const closeModal = () => {
      modal.remove();
      createReopenPill();
    };
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;

    radioDept.onchange = () => {
      deptCont.style.display = 'block';
      facCont.style.display = 'none';
    };
    radioFac.onchange = () => {
      deptCont.style.display = 'none';
      facCont.style.display = 'block';
    };

    if (crawlActiveBtn) {
      crawlActiveBtn.onclick = () => {
        const yr = document.getElementById('biu-year-sel').value;
        modal.remove();
        updateStatus('דף תוצאות זוהה!', 'מתחיל בסריקת הקורסים שמופיעים במסך...');
        crawlFromDocument(document, { year: yr });
      };
    }

    startBtn.onclick = () => {
      const yr = document.getElementById('biu-year-sel').value;
      const isDept = radioDept.checked;
      const targetId = isDept ? document.getElementById('biu-dept-sel').value : document.getElementById('biu-fac-sel').value;
      modal.remove();
      performBackgroundSearchAndCrawl({
        year: yr,
        dept: isDept ? targetId : null,
        faculty: !isDept ? targetId : null
      });
    };
  }

  // Programmatic API exposed on window
  window.openBIUMenu = function() {
    const pill = document.getElementById('crawler-reopen-pill');
    if (pill) pill.remove();
    showInteractiveDialog();
  };

  window.crawlBIU = async function({ year = '2027', dept = null, faculty = null } = {}) {
    const isResultsPage = window.location.href.includes('CoursesView.aspx') && !!document.getElementById('ContentPlaceHolder1_gvLessons');
    if (!dept && !faculty && isResultsPage) {
      await crawlFromDocument(document, { year });
      return;
    }
    await performBackgroundSearchAndCrawl({ year, dept, faculty });
  };

  // Main entry point: Always open the interactive dialog so the user has full control
  showInteractiveDialog();
})();