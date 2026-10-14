const fs = require('fs');
const path = require('path');

// CLI options
const args = process.argv.slice(2);

function listAllCatalogFiles() {
  return fs.readdirSync(__dirname)
    .filter(f => f.startsWith('biu-') && f.endsWith('.json'))
    .sort()
    .reverse();
}

function resolveFilesToCompare() {
  const allFiles = listAllCatalogFiles();

  if (allFiles.length < 2) {
    if (args.length >= 2) {
      return { oldPath: path.resolve(args[0]), newPath: path.resolve(args[1]) };
    }
    console.error('Need at least 2 catalog JSON files to compare.');
    process.exit(1);
  }

  // If two arguments were passed
  if (args.length >= 2) {
    return { oldPath: path.resolve(args[0]), newPath: path.resolve(args[1]) };
  }

  // If one argument was passed (could be a target slug like 'cs' or a filename)
  if (args.length === 1) {
    const target = args[0];
    if (fs.existsSync(target)) {
      // It's a file path
      const base = path.basename(target);
      const match = base.match(/^biu-(\d{4})-([a-z0-9-]+)-full-/i);
      if (match) {
        const prefix = `biu-${match[1]}-${match[2]}-full-`;
        const matching = allFiles.filter(f => f.startsWith(prefix) && f !== base);
        if (matching.length > 0) {
          return { oldPath: path.join(__dirname, matching[0]), newPath: path.resolve(target) };
        }
      }
    } else {
      // It's a slug, e.g. 'cs', 'engineering', etc.
      const matching = allFiles.filter(f => f.includes(`-${target}-`));
      if (matching.length >= 2) {
        return { oldPath: path.join(__dirname, matching[1]), newPath: path.join(__dirname, matching[0]) };
      }
    }
  }

  // Default: group by target and find the target with most recent files
  const groups = {};
  for (const f of allFiles) {
    const m = f.match(/^biu-(\d{4})-([a-z0-9-]+)-full-/i);
    const key = m ? `${m[1]}-${m[2]}` : 'general';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  // Find first group with at least 2 files (or the '2027-cs' group)
  let selectedGroup = groups['2027-cs'];
  let groupKey = '2027-cs';
  if (!selectedGroup || selectedGroup.length < 2) {
    const foundKey = Object.keys(groups).find(k => groups[k].length >= 2);
    if (foundKey) {
      selectedGroup = groups[foundKey];
      groupKey = foundKey;
    }
  }

  if (selectedGroup && selectedGroup.length >= 2) {
    // files are already sorted descending by date
    return {
      oldPath: path.join(__dirname, selectedGroup[1]),
      newPath: path.join(__dirname, selectedGroup[0]),
      targetKey: groupKey
    };
  }

  // Fallback
  return {
    oldPath: path.join(__dirname, allFiles[1]),
    newPath: path.join(__dirname, allFiles[0]),
    targetKey: 'general'
  };
}

function compare() {
  const { oldPath, newPath, targetKey } = resolveFilesToCompare();

  if (!fs.existsSync(newPath)) {
    console.error('New file does not exist:', newPath);
    process.exit(1);
  }
  if (!fs.existsSync(oldPath)) {
    console.error('Old file does not exist:', oldPath);
    process.exit(1);
  }

  const oldData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
  const newData = JSON.parse(fs.readFileSync(newPath, 'utf8'));

  console.log('====================================');
  console.log('      BIU Course Catalog Diff       ');
  console.log('====================================');
  console.log(`Reference File (Old): ${path.basename(oldPath)} (${oldData.meta?.scraped_at || 'unknown'})`);
  console.log(`Latest File    (New): ${path.basename(newPath)} (${newData.meta?.scraped_at || 'unknown'})`);
  if (newData.meta?.target_name) {
    console.log(`Target:               ${newData.meta.target_name}`);
  }
  console.log('------------------------------------');
  console.log(`Validation Check:`);
  console.log(`  Complete:       ${newData.meta?.complete}`);
  console.log(`  Reported Total: ${newData.meta?.reported_total}`);
  console.log(`  Captured Rows:  ${newData.meta?.captured}`);
  console.log(`  Sections (LIDs): ${Object.keys(newData.sections || {}).length}`);
  console.log(`  Details (Pairs): ${Object.keys(newData.details || {}).length}`);
  console.log('------------------------------------');

  // Build maps by code-group-kind-semester
  const oldRowMap = new Map();
  for (const r of (oldData.rows || [])) {
    const key = `${r.code}-${r.group}-${r.kind}-${r.semester}`;
    oldRowMap.set(key, r);
  }

  const newRowMap = new Map();
  for (const r of (newData.rows || [])) {
    const key = `${r.code}-${r.group}-${r.kind}-${r.semester}`;
    newRowMap.set(key, r);
  }

  // Added courses / groups
  const added = [];
  for (const [key, r] of newRowMap.entries()) {
    if (!oldRowMap.has(key)) {
      added.push(r);
    }
  }

  // Removed courses / groups
  const removed = [];
  for (const [key, r] of oldRowMap.entries()) {
    if (!newRowMap.has(key)) {
      removed.push(r);
    }
  }

  // Changed courses
  const changes = [];
  for (const [key, newR] of newRowMap.entries()) {
    const oldR = oldRowMap.get(key);
    if (!oldR) continue;

    const diffs = [];
    if (oldR.teachers !== newR.teachers) {
      diffs.push(`מרצים: "${oldR.teachers.replace(/\n/g, ', ')}" -> "${newR.teachers.replace(/\n/g, ', ')}"`);
    }
    if (oldR.day !== newR.day) {
      diffs.push(`יום: "${oldR.day}" -> "${newR.day}"`);
    }
    if (oldR.hours !== newR.hours) {
      diffs.push(`שעות: "${oldR.hours}" -> "${newR.hours}"`);
    }

    const oldLoc = oldR.location || oldR.classroom || '';
    const newLoc = newR.location || newR.classroom || '';
    if (oldLoc !== newLoc && (oldLoc || newLoc)) {
      diffs.push(`מיקום/כיתה: "${oldLoc}" -> "${newLoc}"`);
    }

    // Check exam terms
    const oldSec = (oldData.sections || {})[oldR.lid];
    const newSec = (newData.sections || {})[newR.lid];
    if (oldSec && newSec) {
      const oldTermsStr = (oldSec.terms || []).map(t => `${t.type} ${t.date} ${t.hour}`).join('; ');
      const newTermsStr = (newSec.terms || []).map(t => `${t.type} ${t.date} ${t.hour}`).join('; ');
      if (oldTermsStr !== newTermsStr) {
        diffs.push(`מועדי בחינה: [${oldTermsStr}] -> [${newTermsStr}]`);
      }
    }

    if (diffs.length > 0) {
      changes.push({
        course: `${newR.code}-${newR.group} ${newR.name} (${newR.kind}, ${newR.semester})`,
        diffs
      });
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    target: newData.meta?.target_name || targetKey,
    oldFile: path.basename(oldPath),
    newFile: path.basename(newPath),
    totalOld: (oldData.rows || []).length,
    totalNew: (newData.rows || []).length,
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changes.length,
    added,
    removed,
    changes
  };

  const reportFile = path.join(__dirname, 'diff-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Summary:`);
  console.log(`  Total Old Rows: ${(oldData.rows || []).length}`);
  console.log(`  Total New Rows: ${(newData.rows || []).length} (${newData.rows.length >= oldData.rows.length ? '+' : ''}${newData.rows.length - oldData.rows.length})`);
  console.log(`  Added Groups:   ${added.length}`);
  console.log(`  Removed Groups: ${removed.length}`);
  console.log(`  Changed Groups: ${changes.length}`);
  console.log('------------------------------------');
  console.log(`Full report saved to: ${reportFile}\n`);
}

compare();
