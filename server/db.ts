import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { hashPassword, setPersistentSessionSecret } from './security.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'lnks_school.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Generates a valid, standards-compliant PDF document containing structured text lines
 * so students can immediately preview & download authentic study notes out of the box.
 */
function createSamplePdf(filePath: string, title: string, subtitle: string, lines: string[]): void {
  if (fs.existsSync(filePath)) return;

  const escapePdfText = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  const streamCommands: string[] = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    `(${escapePdfText('L.N.K.S HIGH SCHOOL - OFFICIAL ACADEMIC NOTES')}) Tj`,
    '0 -26 Td',
    '/F1 14 Tf',
    `(${escapePdfText(title)}) Tj`,
    '0 -20 Td',
    '/F1 11 Tf',
    `(${escapePdfText(subtitle)}) Tj`,
    '0 -28 Td',
    '/F1 10 Tf',
  ];

  for (const line of lines) {
    streamCommands.push(`(${escapePdfText(line)}) Tj`);
    streamCommands.push('0 -16 Td');
  }
  streamCommands.push('0 -24 Td');
  streamCommands.push(`(${escapePdfText('Published by L.N.K.S High School Academic Portal (Class 9 & Class 10)')}) Tj`);
  streamCommands.push('ET');

  const streamContent = streamCommands.join('\n');
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  fs.writeFileSync(filePath, pdf, 'utf8');
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS owner (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      login_id TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_slots (
      slot_number INTEGER PRIMARY KEY CHECK (slot_number BETWEEN 1 AND 5),
      name TEXT,
      login_id TEXT UNIQUE,
      password_hash TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      assigned_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('Boy', 'Girl')),
      class_level INTEGER NOT NULL CHECK (class_level IN (9, 10)),
      roll_number TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('super_owner', 'admin', 'student')),
      subject_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      title_or TEXT,
      description TEXT,
      class_level INTEGER NOT NULL CHECK (class_level IN (9, 10)),
      subject_id TEXT NOT NULL,
      resource_type TEXT NOT NULL CHECK (resource_type IN ('pdf', 'photo', 'link')),
      file_url TEXT,
      file_name TEXT,
      external_url TEXT,
      uploaded_by_name TEXT NOT NULL,
      uploaded_by_role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      title_or TEXT,
      content TEXT NOT NULL,
      content_or TEXT,
      priority TEXT NOT NULL DEFAULT 'general' CHECK (priority IN ('general', 'urgent', 'exam')),
      target_class TEXT NOT NULL DEFAULT 'all' CHECK (target_class IN ('all', '9', '10')),
      attachment_url TEXT,
      attachment_type TEXT NOT NULL DEFAULT 'none' CHECK (attachment_type IN ('none', 'pdf', 'photo')),
      attachment_name TEXT,
      posted_by_name TEXT NOT NULL,
      posted_by_role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      title_or TEXT,
      caption TEXT,
      category TEXT NOT NULL CHECK (category IN ('tournament', 'event', 'notice', 'campus')),
      image_url TEXT NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      uploaded_by_role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      student_gender TEXT NOT NULL CHECK (student_gender IN ('Boy', 'Girl')),
      student_class INTEGER NOT NULL CHECK (student_class IN (9, 10)),
      student_roll TEXT NOT NULL,
      subject_tag TEXT,
      content TEXT NOT NULL,
      attachment_url TEXT,
      attachment_type TEXT NOT NULL DEFAULT 'none' CHECK (attachment_type IN ('none', 'pdf', 'photo')),
      attachment_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS message_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      content TEXT NOT NULL,
      attachment_url TEXT,
      attachment_type TEXT NOT NULL DEFAULT 'none' CHECK (attachment_type IN ('none', 'pdf', 'photo')),
      attachment_name TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_level INTEGER NOT NULL CHECK (class_level IN (9, 10)),
      subject_id TEXT NOT NULL,
      question TEXT NOT NULL,
      question_or TEXT,
      options_json TEXT NOT NULL,
      correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
      explanation TEXT,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_level INTEGER NOT NULL CHECK (class_level IN (9, 10)),
      subject_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      designation TEXT NOT NULL,
      subject TEXT NOT NULL,
      class_assigned TEXT NOT NULL DEFAULT 'Class 9 & 10',
      phone TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();

  // 0. Initialize persistent session secret so sessions survive server restarts
  const secretRow = db.prepare("SELECT value FROM app_settings WHERE key = 'session_secret'").get() as
    | { value: string }
    | undefined;
  if (secretRow?.value) {
    setPersistentSessionSecret(secretRow.value);
  } else {
    const generated = crypto.randomBytes(32).toString('hex');
    db.prepare("INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES ('session_secret', ?, ?)").run(
      generated,
      now
    );
    setPersistentSessionSecret(generated);
  }

  // 1. Seed Super Owner if missing
  const ownerRow = db.prepare('SELECT id FROM owner WHERE id = 1').get();
  if (!ownerRow) {
    const initialLoginId = (process.env.INITIAL_OWNER_ID || 'owner@lnksschool').trim().toLowerCase();
    const initialMobile = (process.env.INITIAL_OWNER_MOBILE || '9999999999').trim();
    const initialPassword = process.env.INITIAL_OWNER_PASSWORD || 'owner@2026';

    db.prepare(
      `INSERT INTO owner (id, name, login_id, mobile, password_hash, updated_at)
       VALUES (1, ?, ?, ?, ?, ?)`
    ).run('Principal / Super Owner', initialLoginId, initialMobile, hashPassword(initialPassword), now);
  }

  // 2. Ensure exactly 5 Admin Slots exist (1..5)
  const insertSlot = db.prepare(
    `INSERT OR IGNORE INTO admin_slots (slot_number, name, login_id, password_hash, is_active, assigned_at, updated_at)
     VALUES (?, NULL, NULL, NULL, 0, NULL, ?)`
  );
  for (let slot = 1; slot <= 5; slot++) {
    insertSlot.run(slot, now);
  }

  // 3. Seed realistic sample PDFs and academic materials if empty
  const matCount = (db.prepare('SELECT COUNT(*) as c FROM materials').get() as { c: number }).c;
  if (matCount === 0) {
    createSamplePdf(
      path.join(UPLOAD_DIR, 'sample-class10-math-quadratics.pdf'),
      'Class 10 Mathematics - Quadratic Equations & Formula Sheet',
      'Subject: Mathematics (BSE Odisha Board Syllabus)',
      [
        '1. Standard Form of a Quadratic Equation:',
        '   ax^2 + bx + c = 0, where a != 0 and a, b, c are real numbers.',
        '',
        '2. Sridharacharya Formula (Quadratic Formula):',
        '   x = (-b +/- sqrt(b^2 - 4ac)) / (2a)',
        '',
        '3. Discriminant (D = b^2 - 4ac):',
        '   - If D > 0: Two distinct real roots.',
        '   - If D = 0: Two equal real roots (x = -b / 2a).',
        '   - If D < 0: No real roots.',
        '',
        '4. Relation Between Roots (alpha, beta) and Coefficients:',
        '   - Sum of roots: alpha + beta = -b / a',
        '   - Product of roots: alpha * beta = c / a',
        '',
        'Practice Problems:',
        '   Q1. Solve 2x^2 - 7x + 3 = 0 by factorization.',
        '   Q2. Find the value of k for which x^2 + kx + 9 = 0 has equal roots.',
        '   Q3. Form a quadratic equation whose roots are 3 and -5.',
      ]
    );

    createSamplePdf(
      path.join(UPLOAD_DIR, 'sample-class10-physci-electricity.pdf'),
      'Class 10 Physical Science - Electric Current & Ohm Law',
      'Subject: Physical Science (Chapter: Electricity)',
      [
        '1. Electric Current (I):',
        '   Rate of flow of electric charge: I = Q / t (Unit: Ampere, A)',
        '',
        '2. Potential Difference (V):',
        '   Work done per unit charge: V = W / Q (Unit: Volt, V)',
        '',
        '3. Ohm Law:',
        '   At constant temperature, V is directly proportional to I.',
        '   V = I * R   (R = Resistance in Ohms)',
        '',
        '4. Combination of Resistors:',
        '   - Series: R_eq = R1 + R2 + R3',
        '   - Parallel: 1 / R_eq = 1/R1 + 1/R2 + 1/R3',
        '',
        '5. Joule Law of Heating:',
        '   H = I^2 * R * t   and   Electric Power P = V * I = I^2 * R = V^2 / R',
      ]
    );

    createSamplePdf(
      path.join(UPLOAD_DIR, 'sample-class9-math-triangles.pdf'),
      'Class 9 Mathematics - Triangles & Congruence Rules',
      'Subject: Mathematics (Geometry Unit)',
      [
        '1. Angle Sum Property of a Triangle:',
        '   The sum of all three interior angles of a triangle is 180 degrees.',
        '',
        '2. Criteria for Congruence of Triangles:',
        '   - SAS (Side-Angle-Side) Congruence Criterion',
        '   - ASA (Angle-Side-Angle) Congruence Criterion',
        '   - AAS (Angle-Angle-Side) Congruence Criterion',
        '   - SSS (Side-Side-Side) Congruence Criterion',
        '   - RHS (Right angle-Hypotenuse-Side) Congruence Criterion',
        '',
        '3. Properties of Isosceles Triangle:',
        '   - Angles opposite to equal sides of a triangle are equal.',
        '   - Sides opposite to equal angles of a triangle are equal.',
      ]
    );

    createSamplePdf(
      path.join(UPLOAD_DIR, 'sample-class9-lifesci-cell.pdf'),
      'Class 9 Life Science - Fundamental Unit of Life (Cell)',
      'Subject: Life Science (Biology Revision Guide)',
      [
        '1. Discovery of Cell:',
        '   Robert Hooke discovered cells in 1665 while observing cork slices.',
        '',
        '2. Key Cell Organelles & Functions:',
        '   - Nucleus: Control center of the cell containing DNA.',
        '   - Mitochondria: Powerhouse of the cell; produces ATP energy.',
        '   - Ribosomes: Site of protein synthesis.',
        '   - Chloroplast (Plant cells): Conducts photosynthesis.',
        '   - Lysosomes: Digest cellular waste ("suicidal bags").',
        '',
        '3. Difference Between Prokaryotic and Eukaryotic Cells:',
        '   Eukaryotic cells possess a well-defined nuclear membrane and',
        '   membrane-bound organelles; prokaryotic cells do not.',
      ]
    );

    const insertMat = db.prepare(`
      INSERT INTO materials (
        title, title_or, description, class_level, subject_id, resource_type,
        file_url, file_name, external_url, uploaded_by_name, uploaded_by_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertMat.run(
      'Quadratic Equations — Complete Formula & Practice Sheet',
      'ଦ୍ୱିଘାତ ସମୀକରଣ — ସୂତ୍ର ଓ ଅଭ୍ୟାସ ପତ୍ର',
      'Essential BSE Odisha Class 10 board formulas, discriminant rules, and solved examples.',
      10,
      'mathematics',
      'pdf',
      '/api/uploads/sample-class10-math-quadratics.pdf',
      'Class10_Math_Quadratics.pdf',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertMat.run(
      'Electricity & Ohm’s Law — Revision Notes',
      'ବିଦ୍ୟୁତ୍ ପ୍ରବାହ ଓ ଓମ୍‌ଙ୍କ ନିୟମ — ସଂକ୍ଷିପ୍ତ ନୋଟ୍',
      'Concise board exam revision notes covering circuits, resistors in series/parallel, and Joule heating.',
      10,
      'physical_science',
      'pdf',
      '/api/uploads/sample-class10-physci-electricity.pdf',
      'Class10_PhysicalScience_Electricity.pdf',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertMat.run(
      'Triangles & Congruence Theorems',
      'ତ୍ରିଭୁଜ ଓ ସର୍ବସମତା ଉପପାଦ୍ୟ',
      'Complete summary of SAS, ASA, SSS, and RHS congruence rules for Class 9 Geometry.',
      9,
      'mathematics',
      'pdf',
      '/api/uploads/sample-class9-math-triangles.pdf',
      'Class9_Math_Triangles.pdf',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertMat.run(
      'Cell Structure & Organelles Revision Guide',
      'କୋଷ ଗଠନ ଓ ଅଙ୍ଗିକା ଅଧ୍ୟୟନ ଗାଇଡ୍',
      'Key definitions and organelle functions for Class 9 Life Science.',
      9,
      'life_science',
      'pdf',
      '/api/uploads/sample-class9-lifesci-cell.pdf',
      'Class9_LifeScience_Cell.pdf',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );
  }

  // 4. Seed Notices if empty
  const noticeCount = (db.prepare('SELECT COUNT(*) as c FROM notices').get() as { c: number }).c;
  if (noticeCount === 0) {
    const insertNotice = db.prepare(`
      INSERT INTO notices (
        title, title_or, content, content_or, priority, target_class,
        attachment_url, attachment_type, attachment_name, posted_by_name, posted_by_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertNotice.run(
      'Class 10 HSC Pre-Board Examination Schedule Released',
      'ଦଶମ ଶ୍ରେଣୀ ପ୍ରି-ବୋର୍ଡ ପରୀକ୍ଷା ସମୟସାରଣୀ ପ୍ରକାଶିତ',
      'All Class 10 students are informed that the Pre-Board Examination begins on 15th December at 10:00 AM. Carry your digital L.N.K.S Student ID Card and geometry box.',
      'ସମସ୍ତ ଦଶମ ଶ୍ରେଣୀ ଛାତ୍ରଛାତ୍ରୀଙ୍କୁ ଜଣାଇ ଦିଆଯାଉଛି ଯେ ଆସନ୍ତା ଡିସେମ୍ବର ୧୫ ତାରିଖ ସକାଳ ୧୦ଟାରୁ ପ୍ରି-ବୋର୍ଡ ପରୀକ୍ଷା ଆରମ୍ଭ ହେବ। ନିଜର ବିଦ୍ୟାଳୟ ପରିଚୟ ପତ୍ର ସାଙ୍ଗରେ ଆଣିବେ।',
      'exam',
      '10',
      null,
      'none',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertNotice.run(
      'Class 9 Science Model Exhibition & Practical Submission',
      'ନବମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପ୍ରଦର୍ଶନୀ ଓ ପ୍ରାକ୍ଟିକାଲ୍ ଖାତା ଦାଖଲ',
      'Class 9 Boys and Girls must submit their Physical Science and Life Science practical records by Friday 2:00 PM in the Science Laboratory.',
      'ନବମ ଶ୍ରେଣୀର ସମସ୍ତ ଛାତ୍ରଛାତ୍ରୀ ଶୁକ୍ରବାର ଅପରାହ୍ନ ୨ଟା ପୂର୍ବରୁ ଭୌତିକ ବିଜ୍ଞାନ ଓ ଜୀବ ବିଜ୍ଞାନ ପ୍ରାକ୍ଟିକାଲ୍ ଖାତା ବିଜ୍ଞାନଗାରରେ ଦାଖଲ କରିବେ।',
      'urgent',
      '9',
      null,
      'none',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertNotice.run(
      'Annual Inter-School Sports Meet Registration Open',
      'ବାର୍ଷିକ କ୍ରୀଡ଼ା ପ୍ରତିଯୋଗିତା ପାଇଁ ନାମ ପଞ୍ଜୀକରଣ',
      'Students of Class 9 and Class 10 interested in Athletics, Volleyball, and Kabaddi should give their names to the Sports Teacher before Monday.',
      'ନବମ ଓ ଦଶମ ଶ୍ରେଣୀର ଯେଉଁ ଛାତ୍ରଛାତ୍ରୀମାନେ ଦୌଡ଼କୁଦ, ଭଲିବଲ୍ ଓ କବାଡ଼ିରେ ଭାଗ ନେବାକୁ ଇଚ୍ଛୁକ, ସେମାନେ ସୋମବାର ପୂର୍ବରୁ କ୍ରୀଡ଼ା ଶିକ୍ଷକଙ୍କ ନିକଟରେ ନାମ ଲେଖାନ୍ତୁ।',
      'general',
      'all',
      null,
      'none',
      null,
      'Principal / Super Owner',
      'super_owner',
      now
    );
  }

  // 5. Seed School Photo Gallery if empty
  const galleryCount = (db.prepare('SELECT COUNT(*) as c FROM gallery').get() as { c: number }).c;
  if (galleryCount === 0) {
    const insertGallery = db.prepare(`
      INSERT INTO gallery (
        title, title_or, caption, category, image_url, uploaded_by_name, uploaded_by_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertGallery.run(
      'Annual Inter-School Volleyball & Athletics Meet',
      'ବାର୍ଷିକ କ୍ରୀଡ଼ା ଓ ଭଲିବଲ୍ ପ୍ରତିଯୋଗିତା',
      'Class 9 and Class 10 teams competing with spirit during the Annual Sports Day on the school playground.',
      'tournament',
      '/src/assets/images/gallery_sports_tournament_1795752362598.jpg',
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertGallery.run(
      'Class 9 & 10 Science Model Exhibition',
      'ନବମ ଓ ଦଶମ ଶ୍ରେଣୀ ବିଜ୍ଞାନ ପ୍ରଦର୍ଶନୀ',
      'Students demonstrating hydroelectric and human circulatory system working models to faculty members.',
      'event',
      '/src/assets/images/gallery_science_exhibition_1795752365344.jpg',
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertGallery.run(
      'Annual Cultural Celebration & Lamp Lighting',
      'ବାର୍ଷିକ ସାଂସ୍କୃତିକ ଉତ୍ସବ ଓ ପ୍ରଦୀପ ପ୍ରଜ୍ଜ୍ୱଳନ',
      'Traditional inaugural lamp lighting ceremony in the L.N.K.S High School courtyard with teachers and students.',
      'event',
      '/src/assets/images/gallery_cultural_event_1795752366108.jpg',
      'Principal / Super Owner',
      'super_owner',
      now
    );

    insertGallery.run(
      'L.N.K.S High School Main Academic Block',
      'ଏଲ୍.ଏନ୍.କେ.ଏସ୍ ଉଚ୍ଚ ବିଦ୍ୟାଳୟ ମୁଖ୍ୟ ଭବନ',
      'Morning assembly verandah and sunlit academic courtyard welcoming Class 9 and Class 10 students.',
      'campus',
      '/src/assets/images/school_campus_hero_1795752362082.jpg',
      'Principal / Super Owner',
      'super_owner',
      now
    );
  }

  // 6. Seed Class 9 & Class 10 MCQ Practice Quiz Questions if empty
  const quizCount = (db.prepare('SELECT COUNT(*) as c FROM quiz_questions').get() as { c: number }).c;
  if (quizCount === 0) {
    const insertQuiz = db.prepare(`
      INSERT INTO quiz_questions (
        class_level, subject_id, question, question_or, options_json, correct_index, explanation, created_by_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedQuizzes: Array<[number, string, string, string, string[], number, string]> = [
      // Class 10 Questions
      [
        10,
        'mathematics',
        'What is the discriminant of the quadratic equation 2x² - 4x + 2 = 0?',
        '2x² - 4x + 2 = 0 ଦ୍ୱିଘାତ ସମୀକରଣର ପ୍ରଭେଦକ (D) କେତେ?',
        ['0', '4', '8', '-4'],
        0,
        'D = b² - 4ac = (-4)² - 4(2)(2) = 16 - 16 = 0.',
      ],
      [
        10,
        'mathematics',
        'If sin θ = 1/2 (0° < θ < 90°), what is the value of θ?',
        'ଯଦି sin θ = 1/2 ହୁଏ, ତେବେ θ ର ମାନ କେତେ?',
        ['30°', '45°', '60°', '90°'],
        0,
        'sin 30° = 1/2 in standard trigonometric ratios.',
      ],
      [
        10,
        'physical_science',
        'What is the SI unit of electrical resistance?',
        'ବିଦ୍ୟୁତ୍ ପ୍ରତିରୋଧର SI ଏକକ କ’ଣ?',
        ['Volt', 'Ampere', 'Ohm', 'Watt'],
        2,
        'Electrical resistance is measured in Ohms (Ω).',
      ],
      [
        10,
        'physical_science',
        'Which gas is evolved when zinc reacts with dilute hydrochloric acid?',
        'ଜିଙ୍କ୍ ଲଘୁ ହାଇଡ୍ରୋକ୍ଲୋରିକ୍ ଅମ୍ଳ ସହିତ ପ୍ରତିକ୍ରିୟା କଲେ କେଉଁ ଗ୍ୟାସ୍ ନିର୍ଗତ ହୁଏ?',
        ['Oxygen', 'Hydrogen', 'Nitrogen', 'Carbon Dioxide'],
        1,
        'Zn + 2HCl → ZnCl₂ + H₂↑ (Hydrogen gas).',
      ],
      [
        10,
        'life_science',
        'Which part of the plant conducts photosynthesis primarily?',
        'ଉଦ୍ଭିଦର କେଉଁ ଅଙ୍ଗ ମୁଖ୍ୟତଃ ଆଲୋକଶ୍ଳେଷଣ କରେ?',
        ['Root', 'Leaf (Chloroplast)', 'Bark', 'Seed'],
        1,
        'Chloroplasts inside green leaves capture sunlight for photosynthesis.',
      ],
      [
        10,
        'english',
        'Choose the correct passive voice: "The teacher praised the student."',
        'ସଠିକ୍ Passive Voice ବାଛନ୍ତୁ: "The teacher praised the student."',
        [
          'The student is praised by the teacher.',
          'The student was praised by the teacher.',
          'The student has praised the teacher.',
          'The teacher was praised by the student.',
        ],
        1,
        'Simple past active "praised" changes to "was praised" in passive voice.',
      ],
      [
        10,
        'mil_odia',
        '‘ବନ୍ଦେ ଉତ୍କଳ ଜନନୀ’ କବିତାର ରଚୟିତା କିଏ?',
        '‘ବନ୍ଦେ ଉତ୍କଳ ଜନନୀ’ କବିତାର ରଚୟିତା କିଏ?',
        ['କାନ୍ତକବି ଲକ୍ଷ୍ମୀକାନ୍ତ ମହାପାତ୍ର', 'ବ୍ୟାସକବି ଫକୀରମୋହନ ସେନାପତି', 'କବିବର ରାଧାନାଥ ରାୟ', 'ସ୍ୱଭାବକବି ଗଙ୍ଗାଧର ମେହେର'],
        0,
        'କାନ୍ତକବି ଲକ୍ଷ୍ମୀକାନ୍ତ ମହାପାତ୍ର ଓଡ଼ିଶାର ରାଜ୍ୟ ସଙ୍ଗୀତ ‘ବନ୍ଦେ ଉତ୍କଳ ଜନନୀ’ ରଚନା କରିଥିଲେ।',
      ],
      [
        10,
        'history_polity',
        'In which year did Odisha become a separate province?',
        'ଓଡ଼ିଶା କେଉଁ ମସିହାରେ ଏକ ସ୍ୱତନ୍ତ୍ର ପ୍ରଦେଶ ଭାବେ ଗଠିତ ହେଲା?',
        ['1930', '1936', '1942', '1947'],
        1,
        'Odisha became a separate state on 1st April 1936 (Utkal Dibasa).',
      ],
      [
        10,
        'geography',
        'Which is the largest brackish water lagoon in Odisha?',
        'ଓଡ଼ିଶାର ସର୍ବବୃହତ ଲୁଣି ହ୍ରଦ କେଉଁଟି?',
        ['Ansupa Lake', 'Chilika Lake', 'Kanjia Lake', 'Tampara Lake'],
        1,
        'Chilika Lake is Asia’s largest brackish water lagoon located in Odisha.',
      ],
      [
        10,
        'sanskrit',
        '‘विद्या ददाति विनयम्’ — What does ‘विनयम्’ mean?',
        '‘विद्या ददाति विनयम्’ — ଏଠାରେ ‘विनयम्’ ର ଅର୍ଥ କ’ଣ?',
        ['Wealth', 'Humility / Discipline', 'Anger', 'Power'],
        1,
        'Knowledge bestows humility and discipline (विनयम्).',
      ],
      // Class 9 Questions
      [
        9,
        'mathematics',
        'What is the sum of the interior angles of any triangle?',
        'ଯେକୌଣସି ତ୍ରିଭୁଜର ତିନୋଟି ଅନ୍ତଃସ୍ଥ କୋଣର ସମଷ୍ଟି କେତେ?',
        ['90°', '180°', '270°', '360°'],
        1,
        'The interior angles of every Euclidean triangle sum to 180 degrees.',
      ],
      [
        9,
        'mathematics',
        'Which of the following numbers is an irrational number?',
        'ନିମ୍ନଲିଖିତ ମଧ୍ୟରୁ କେଉଁଟି ଏକ ଅପରିମେୟ ସଂଖ୍ୟା?',
        ['√4', '22/7', '√2', '0.75'],
        2,
        '√2 cannot be expressed as a ratio p/q of two integers.',
      ],
      [
        9,
        'physical_science',
        'According to Newton’s Second Law of Motion, Force equals:',
        'ନିଉଟନଙ୍କ ଦ୍ୱିତୀୟ ଗତି ନିୟମ ଅନୁସାରେ ବଳ (F) ର ସୂତ୍ର କ’ଣ?',
        ['Mass × Velocity', 'Mass × Acceleration', 'Mass / Acceleration', 'Velocity / Time'],
        1,
        'F = m × a (Mass multiplied by Acceleration).',
      ],
      [
        9,
        'life_science',
        'Which cell organelle is known as the "Powerhouse of the Cell"?',
        'କୋଷର କେଉଁ ଅଙ୍ଗିକାକୁ ‘କୋଷର ଶକ୍ତିକେନ୍ଦ୍ର’ କୁହାଯାଏ?',
        ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi Apparatus'],
        2,
        'Mitochondria release energy in the form of ATP molecules.',
      ],
      [
        9,
        'geography',
        'Which latitude line passes almost through the middle of India?',
        'କେଉଁ ଅକ୍ଷାଂଶ ରେଖା ଭାରତର ପ୍ରାୟ ମଧ୍ୟଭାଗ ଦେଇ ଯାଇଛି?',
        ['Equator', 'Tropic of Cancer', 'Tropic of Capricorn', 'Arctic Circle'],
        1,
        'The Tropic of Cancer (23°30′ N) divides India almost into two equal halves.',
      ],
      [
        9,
        'english',
        'Identify the synonym of the word "Diligent":',
        '"Diligent" ଶବ୍ଦର ସମାର୍ଥକ ଶବ୍ଦ ବାଛନ୍ତୁ:',
        ['Lazy', 'Hardworking', 'Careless', 'Silent'],
        1,
        'Diligent means showing steady, careful, hardworking effort.',
      ],
    ];

    for (const q of seedQuizzes) {
      insertQuiz.run(q[0], q[1], q[2], q[3], JSON.stringify(q[4]), q[5], q[6], 'Principal / Super Owner', now);
    }
  }

  // 7. Seed L.N.K.S High School Teachers Directory if empty
  const teacherCount = (db.prepare('SELECT COUNT(*) as c FROM teachers').get() as { c: number }).c;
  if (teacherCount === 0) {
    const insertTeacher = db.prepare(
      `INSERT INTO teachers (name, designation, subject, class_assigned, phone, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const seedTeachers: Array<[string, string, string, string, string]> = [
      ['Headmaster, L.N.K.S High School', 'Headmaster', 'Administration & Supervision', 'Class 9 & 10', '9437000001'],
      ['Ramesh Chandra Sahoo', 'Senior Assistant Teacher', 'Mathematics (ଗଣିତ)', 'Class 9 & 10', '9437000002'],
      ['Pradeep Kumar Mohanty', 'Science Teacher', 'Physical Science (ଭୌତିକ ବିଜ୍ଞାନ)', 'Class 9 & 10', '9437000003'],
      ['Smita Rani Panda', 'Science Teacher', 'Life Science (ଜୀବ ବିଜ୍ଞାନ)', 'Class 9 & 10', '9437000004'],
      ['Bikash Ranjan Dash', 'Assistant Teacher', 'English (ଇଂରାଜୀ)', 'Class 9 & 10', '9437000005'],
      ['Subhashree Swain', 'Assistant Teacher', 'MIL Odia (ସାହିତ୍ୟ)', 'Class 9 & 10', '9437000006'],
      ['Narayan Prasad Mishra', 'Classical Teacher', 'Sanskrit (ସଂସ୍କୃତ)', 'Class 9 & 10', '9437000007'],
      ['Manoj Kumar Behera', 'Assistant Teacher', 'History, Polity & Geography', 'Class 9 & 10', '9437000008'],
    ];
    for (const t of seedTeachers) {
      insertTeacher.run(t[0], t[1], t[2], t[3], t[4], now);
    }
  }
}

