/**
 * Bar-Ilan University Catalog Metadata: Faculties and Departments
 * Auto-extracted from courses.biu.ac.il
 */

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

/**
 * Find department by ID, slug, or substring match in name
 */
function findDepartment(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();
  
  // Exact ID match
  const byId = DEPARTMENTS.find(d => d.id === q);
  if (byId) return byId;

  // Exact slug match
  const bySlug = DEPARTMENTS.find(d => d.slug.toLowerCase() === q);
  if (bySlug) return bySlug;

  // Exact or partial name match
  const byName = DEPARTMENTS.find(d => d.name.toLowerCase() === q);
  if (byName) return byName;

  const partial = DEPARTMENTS.filter(d => 
    d.name.toLowerCase().includes(q) || 
    d.slug.toLowerCase().includes(q)
  );

  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    return partial.find(d => d.name.includes(query)) || partial[0];
  }

  return null;
}

/**
 * Find faculty by ID, slug, or substring match in name
 */
function findFaculty(query) {
  if (!query) return null;
  const q = String(query).trim().toLowerCase();

  // Exact ID match
  const byId = FACULTIES.find(f => f.id === q);
  if (byId) return byId;

  // Exact slug match
  const bySlug = FACULTIES.find(f => f.slug.toLowerCase() === q);
  if (bySlug) return bySlug;

  // Exact or partial name match
  const byName = FACULTIES.find(f => f.name.toLowerCase() === q);
  if (byName) return byName;

  const partial = FACULTIES.filter(f => 
    f.name.toLowerCase().includes(q) || 
    f.slug.toLowerCase().includes(q)
  );
  if (partial.length > 0) return partial[0];

  return null;
}

/**
 * General target resolver: checks department or faculty
 */
function resolveTarget(query, typeHint = null) {
  if (!query) return null;
  
  if (typeHint === 'faculty') {
    const fac = findFaculty(query);
    if (fac) return { type: 'faculty', ...fac };
  }
  if (typeHint === 'department') {
    const dept = findDepartment(query);
    if (dept) return { type: 'department', ...dept };
  }

  // Try department first
  const dept = findDepartment(query);
  if (dept) return { type: 'department', ...dept };

  // Try faculty
  const fac = findFaculty(query);
  if (fac) return { type: 'faculty', ...fac };

  return null;
}

/**
 * Returns formatted text listing all faculties and departments
 */
function formatCatalogDirectory() {
  let out = '\n=== פקולטות באוניברסיטת בר-אילן (Faculties) ===\n';
  FACULTIES.forEach(f => {
    out += `  [ID: ${f.id.padEnd(2)}] ${f.name.padEnd(30)} (slug: ${f.slug})\n`;
  });

  out += '\n=== מחלקות ויחידות (Departments) ===\n';
  DEPARTMENTS.forEach(d => {
    out += `  [ID: ${d.id.padEnd(3)}] ${d.name.padEnd(46)} (slug: ${d.slug})\n`;
  });

  return out;
}

module.exports = {
  FACULTIES,
  DEPARTMENTS,
  findDepartment,
  findFaculty,
  resolveTarget,
  formatCatalogDirectory
};
