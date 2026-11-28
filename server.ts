import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, dbAll, dbGet, dbRun, initializeDatabase, UPLOAD_DIR } from './server/db.ts';
import {
  cleanText,
  generateSessionToken,
  hashPassword,
  hashToken,
  isValidHttpUrl,
  sanitizeCsvCell,
  timingSafeStringEqual,
  verifyPassword,
  verifyTokenSignature,
} from './server/security.ts';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));

const SESSION_COOKIE_NAME = 'lnks_session';
const DEFAULT_LOGO_URL = '/src/assets/images/school_crest_emblem_1795752364851.jpg';
const STAFF_VERIFICATION_PASSWORD = process.env.STAFF_VERIFICATION_PASSWORD || 'LNKS@1234HIGHSCHOOL';

// Types attached to authenticated requests
export interface AuthUser {
  role: 'super_owner' | 'admin' | 'student';
  id: number; // 1 for super_owner, slot_number (1..5) for admin, student.id for student
  name: string;
  loginId?: string;
  mobile?: string;
  slotNumber?: number;
  student?: {
    id: number;
    reg_code: string;
    full_name: string;
    gender: 'Boy' | 'Girl';
    class_level: 9 | 10;
    roll_number: string;
    mobile: string;
    created_at: string;
  };
}

interface AuthedRequest extends Request {
  user?: AuthUser;
  tokenHash?: string;
  rawSessionToken?: string;
}

const asyncHandler =
  (fn: (req: AuthedRequest, res: Response, next: NextFunction) => Promise<void>) =>
  (req: AuthedRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const VALID_SUBJECTS = new Set([
  'mathematics',
  'physical_science',
  'life_science',
  'english',
  'mil_odia',
  'sanskrit',
  'history_polity',
  'geography',
]);

// Multer in-memory storage — every uploaded file is persisted permanently in Turso (uploaded_files / app_settings)
const ALLOWED_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, PNG, and WEBP files are allowed.'));
    }
  },
});

async function saveUploadedFile(file: Express.Multer.File): Promise<string> {
  const ext = ALLOWED_MIME[file.mimetype] || '';
  const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
  const now = new Date().toISOString();
  await dbRun(
    `INSERT INTO uploaded_files (filename, mime_type, data_base64, created_at)
     VALUES (?, ?, ?, ?)`,
    [filename, file.mimetype, file.buffer.toString('base64'), now]
  );
  return `/api/uploads/${filename}`;
}

function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  const result: Record<string, string> = {};
  if (!raw) return result;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        result[k] = decodeURIComponent(v);
      } catch {
        result[k] = v;
      }
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return req.secure || proto === 'https';
}

function setSessionCookie(req: Request, res: Response, rawToken: string): void {
  const maxAgeSec = 30 * 24 * 60 * 60; // 30 days
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: Request, res: Response): void {
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttpsRequest(req)) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

async function createSession(role: 'super_owner' | 'admin' | 'student', subjectId: number): Promise<string> {
  const { rawToken, tokenHash } = generateSessionToken();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await dbRun(
    `INSERT INTO sessions (token_hash, role, subject_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tokenHash, role, subjectId, expires.toISOString(), now.toISOString()]
  );
  return rawToken;
}

async function revokeSessionsFor(role: string, subjectId: number): Promise<void> {
  await dbRun('DELETE FROM sessions WHERE role = ? AND subject_id = ?', [role, subjectId]);
}

const requireAuth = asyncHandler(async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  let rawToken = '';
  let authenticatedViaCookie = false;

  if (header && header.startsWith('Bearer ')) {
    rawToken = header.slice(7).trim();
  } else {
    const cookies = parseCookies(req);
    if (cookies[SESSION_COOKIE_NAME]) {
      rawToken = cookies[SESSION_COOKIE_NAME];
      authenticatedViaCookie = true;
    }
  }

  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // CSRF defense for cookie-authenticated state-changing requests
  if (authenticatedViaCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const xrw = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const expectedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
    let originMatches = false;
    if (origin && expectedHost) {
      try {
        originMatches = new URL(origin).host.toLowerCase() === expectedHost;
      } catch {
        originMatches = false;
      }
    }
    if (xrw !== 'XMLHttpRequest' && !originMatches) {
      res.status(403).json({ error: 'Cross-site request blocked' });
      return;
    }
  }

  if (!verifyTokenSignature(rawToken)) {
    res.status(401).json({ error: 'Invalid session token' });
    return;
  }
  const tokenHash = hashToken(rawToken);
  const session = await dbGet<{
    token_hash: string;
    role: 'super_owner' | 'admin' | 'student';
    subject_id: number;
    expires_at: string;
  }>('SELECT token_hash, role, subject_id, expires_at FROM sessions WHERE token_hash = ?', [tokenHash]);

  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    if (session) await dbRun('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }
  req.rawSessionToken = rawToken;

  if (session.role === 'super_owner') {
    const owner = await dbGet<{ id: number; name: string; login_id: string; mobile: string }>(
      'SELECT id, name, login_id, mobile FROM owner WHERE id = 1'
    );
    if (!owner) {
      res.status(401).json({ error: 'Owner account not found' });
      return;
    }
    req.user = {
      role: 'super_owner',
      id: 1,
      name: owner.name,
      loginId: owner.login_id,
      mobile: owner.mobile,
    };
  } else if (session.role === 'admin') {
    const admin = await dbGet<{
      slot_number: number;
      name: string | null;
      login_id: string | null;
      is_active: number;
    }>('SELECT slot_number, name, login_id, is_active FROM admin_slots WHERE slot_number = ?', [session.subject_id]);
    if (!admin || !admin.is_active || !admin.name || !admin.login_id) {
      await dbRun('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
      res.status(401).json({ error: 'Admin access has been deactivated' });
      return;
    }
    req.user = {
      role: 'admin',
      id: admin.slot_number,
      slotNumber: admin.slot_number,
      name: admin.name,
      loginId: admin.login_id,
    };
  } else {
    const student = await dbGet<{
      id: number;
      reg_code: string;
      full_name: string;
      gender: 'Boy' | 'Girl';
      class_level: 9 | 10;
      roll_number: string;
      mobile: string;
      is_active: number;
      created_at: string;
    }>(
      `SELECT id, reg_code, full_name, gender, class_level, roll_number, mobile, is_active, created_at
       FROM students WHERE id = ?`,
      [session.subject_id]
    );
    if (!student || !student.is_active) {
      await dbRun('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
      res.status(401).json({ error: 'Student account is inactive or removed' });
      return;
    }
    req.user = {
      role: 'student',
      id: student.id,
      name: student.full_name,
      mobile: student.mobile,
      student: {
        id: student.id,
        reg_code: student.reg_code,
        full_name: student.full_name,
        gender: student.gender,
        class_level: student.class_level,
        roll_number: student.roll_number,
        mobile: student.mobile,
        created_at: student.created_at,
      },
    };
  }

  req.tokenHash = tokenHash;
  next();
});

function requireStaff(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== 'super_owner' && req.user.role !== 'admin')) {
    res.status(403).json({ error: 'Teacher / Admin or Super Owner permission required' });
    return;
  }
  next();
}

function requireSuperOwner(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'super_owner') {
    res.status(403).json({ error: 'Exclusive Super Owner permission required' });
    return;
  }
  next();
}

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Student Registration (Boys & Girls — Class 9 & Class 10 strictly)
app.post(
  '/api/auth/student/register',
  asyncHandler(async (req: Request, res: Response) => {
    const fullName = cleanText(req.body?.full_name, 100);
    const gender = req.body?.gender;
    const classLevel = Number(req.body?.class_level);
    const rollNumber = cleanText(req.body?.roll_number, 30);
    const mobile = cleanText(req.body?.mobile, 20).replace(/\s+/g, '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter a valid full name.' });
      return;
    }
    if (gender !== 'Boy' && gender !== 'Girl') {
      res.status(400).json({ error: 'Gender must be Boy or Girl.' });
      return;
    }
    if (classLevel !== 9 && classLevel !== 10) {
      res.status(400).json({ error: 'Registration is strictly for Class 9 and Class 10 only.' });
      return;
    }
    if (!rollNumber) {
      res.status(400).json({ error: 'Roll number is required.' });
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existing = await dbGet<{ id: number }>('SELECT id FROM students WHERE mobile = ?', [mobile]);
    if (existing) {
      res.status(409).json({ error: 'This mobile number is already registered. Please log in.' });
      return;
    }

    const now = new Date().toISOString();
    const suffix = crypto.randomInt(1000, 9999);
    const regCode = `LNKS-2026-C${classLevel}-${suffix}`;
    const passwordHash = hashPassword(password);

    const result = await dbRun(
      `INSERT INTO students (reg_code, full_name, gender, class_level, roll_number, mobile, password_hash, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [regCode, fullName, gender, classLevel, rollNumber, mobile, passwordHash, now]
    );

    const studentId = result.lastInsertRowid;
    const token = await createSession('student', studentId);
    setSessionCookie(req, res, token);

    res.status(201).json({
      token,
      user: {
        role: 'student',
        id: studentId,
        name: fullName,
        mobile,
        student: {
          id: studentId,
          reg_code: regCode,
          full_name: fullName,
          gender,
          class_level: classLevel,
          roll_number: rollNumber,
          mobile,
          created_at: now,
        },
      },
    });
  })
);

// Student Login (Mobile Number + Password)
app.post(
  '/api/auth/student/login',
  asyncHandler(async (req: Request, res: Response) => {
    const mobile = cleanText(req.body?.mobile, 20).replace(/\s+/g, '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!mobile || !password) {
      res.status(400).json({ error: 'Mobile number and password are required.' });
      return;
    }

    const student = await dbGet<{
      id: number;
      reg_code: string;
      full_name: string;
      gender: 'Boy' | 'Girl';
      class_level: 9 | 10;
      roll_number: string;
      mobile: string;
      password_hash: string;
      is_active: number;
      created_at: string;
    }>(
      `SELECT id, reg_code, full_name, gender, class_level, roll_number, mobile, password_hash, is_active, created_at
       FROM students WHERE mobile = ?`,
      [mobile]
    );

    if (!student || !verifyPassword(password, student.password_hash)) {
      res.status(401).json({ error: 'Invalid mobile number or password.' });
      return;
    }
    if (!student.is_active) {
      res.status(403).json({ error: 'Your student account has been suspended. Contact the School Office.' });
      return;
    }

    const token = await createSession('student', student.id);
    setSessionCookie(req, res, token);
    res.json({
      token,
      user: {
        role: 'student',
        id: student.id,
        name: student.full_name,
        mobile: student.mobile,
        student: {
          id: student.id,
          reg_code: student.reg_code,
          full_name: student.full_name,
          gender: student.gender,
          class_level: student.class_level,
          roll_number: student.roll_number,
          mobile: student.mobile,
          created_at: student.created_at,
        },
      },
    });
  })
);

// Dedicated Owner / Admin Login (Login ID or Mobile + Password)
app.post(
  '/api/auth/staff/login',
  asyncHandler(async (req: Request, res: Response) => {
    const identifier = cleanText(req.body?.identifier, 100).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      res.status(400).json({ error: 'Login ID / Mobile and password are required.' });
      return;
    }

    // 1. Check Super Owner first (matches login_id OR mobile)
    const owner = await dbGet<{
      id: number;
      name: string;
      login_id: string;
      mobile: string;
      password_hash: string;
    }>('SELECT id, name, login_id, mobile, password_hash FROM owner WHERE id = 1');

    if (
      owner &&
      (owner.login_id.toLowerCase() === identifier || owner.mobile.toLowerCase() === identifier)
    ) {
      if (!verifyPassword(password, owner.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }
      const token = await createSession('super_owner', 1);
      setSessionCookie(req, res, token);
      res.json({
        token,
        user: {
          role: 'super_owner',
          id: 1,
          name: owner.name,
          loginId: owner.login_id,
          mobile: owner.mobile,
        },
      });
      return;
    }

    // 2. Check the 5 Admin Slots
    const admin = await dbGet<{
      slot_number: number;
      name: string;
      login_id: string;
      password_hash: string;
      is_active: number;
    }>(
      `SELECT slot_number, name, login_id, password_hash, is_active
       FROM admin_slots WHERE LOWER(login_id) = ?`,
      [identifier]
    );

    if (admin && admin.password_hash && verifyPassword(password, admin.password_hash)) {
      if (!admin.is_active) {
        res.status(403).json({ error: 'This Admin slot is currently deactivated by the Super Owner.' });
        return;
      }
      const token = await createSession('admin', admin.slot_number);
      setSessionCookie(req, res, token);
      res.json({
        token,
        user: {
          role: 'admin',
          id: admin.slot_number,
          slotNumber: admin.slot_number,
          name: admin.name,
          loginId: admin.login_id,
        },
      });
      return;
    }

    res.status(401).json({ error: 'Invalid Owner / Admin ID or password.' });
  })
);

// Owner & Admin Registration using Mobile Number + Secret Master Password ("LNKS@1234HIGHSCHOOL")
app.post(
  '/api/auth/staff/register',
  asyncHandler(async (req: Request, res: Response) => {
    const role = req.body?.role === 'super_owner' ? 'super_owner' : req.body?.role === 'admin' ? 'admin' : null;
    const fullName = cleanText(req.body?.full_name, 100);
    const mobile = cleanText(req.body?.mobile, 20).replace(/\s+/g, '');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const verificationPassword =
      typeof req.body?.verification_password === 'string' ? req.body.verification_password.trim() : '';

    if (!role) {
      res.status(400).json({ error: 'Please select Owner or Admin role.' });
      return;
    }
    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter a valid full name.' });
      return;
    }
    if (!/^\d{10}$/.test(mobile)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Personal password must be at least 6 characters.' });
      return;
    }
    if (!timingSafeStringEqual(verificationPassword, STAFF_VERIFICATION_PASSWORD)) {
      res.status(403).json({ error: 'Invalid school verification password. Registration denied.' });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    if (role === 'super_owner') {
      const adminConflict = await dbGet<{ slot_number: number }>(
        'SELECT slot_number FROM admin_slots WHERE LOWER(login_id) = ?',
        [mobile]
      );
      if (adminConflict) {
        res.status(409).json({ error: 'This mobile number is already assigned to an Admin slot.' });
        return;
      }

      await dbRun(
        `UPDATE owner
         SET name = ?, login_id = ?, mobile = ?, password_hash = ?, updated_at = ?
         WHERE id = 1`,
        [fullName, mobile, mobile, passwordHash, now]
      );

      await revokeSessionsFor('super_owner', 1);
      const token = await createSession('super_owner', 1);
      setSessionCookie(req, res, token);

      res.status(201).json({
        token,
        user: {
          role: 'super_owner',
          id: 1,
          name: fullName,
          loginId: mobile,
          mobile,
        },
      });
      return;
    }

    // Admin Registration: assign to first open slot (1..5)
    const ownerRow = await dbGet<{ login_id: string; mobile: string }>(
      'SELECT login_id, mobile FROM owner WHERE id = 1'
    );
    if (ownerRow && (ownerRow.login_id.toLowerCase() === mobile || ownerRow.mobile === mobile)) {
      res.status(409).json({ error: 'This mobile number is registered to the Super Owner.' });
      return;
    }

    const existingAdmin = await dbGet<{ slot_number: number }>(
      'SELECT slot_number FROM admin_slots WHERE LOWER(login_id) = ?',
      [mobile]
    );
    if (existingAdmin) {
      res.status(409).json({ error: 'This mobile number is already registered as an Admin. Please log in.' });
      return;
    }

    const freeSlot = await dbGet<{ slot_number: number }>(
      'SELECT slot_number FROM admin_slots WHERE login_id IS NULL ORDER BY slot_number ASC LIMIT 1'
    );
    if (!freeSlot) {
      res.status(409).json({ error: 'All 5 Admin slots are currently assigned. Contact the Super Owner.' });
      return;
    }

    await dbRun(
      `UPDATE admin_slots
       SET name = ?, login_id = ?, password_hash = ?, is_active = 1, assigned_at = ?, updated_at = ?
       WHERE slot_number = ?`,
      [fullName, mobile, passwordHash, now, now, freeSlot.slot_number]
    );

    const token = await createSession('admin', freeSlot.slot_number);
    setSessionCookie(req, res, token);

    res.status(201).json({
      token,
      user: {
        role: 'admin',
        id: freeSlot.slot_number,
        slotNumber: freeSlot.slot_number,
        name: fullName,
        loginId: mobile,
      },
    });
  })
);

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
  res.json({ user: req.user, token: req.rawSessionToken });
});

app.post(
  '/api/auth/logout',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (req.tokenHash) {
      await dbRun('DELETE FROM sessions WHERE token_hash = ?', [req.tokenHash]);
    }
    clearSessionCookie(req, res);
    res.json({ ok: true });
  })
);

// ============================================================================
// PUBLIC SETTINGS & PERMANENT APP ICON/LOGO MANAGEMENT (Owner / Admin Only)
// Saved as Base64 Data URI or HTTPS URL directly inside Turso app_settings
// ============================================================================
app.get(
  '/api/settings/public',
  asyncHandler(async (_req: Request, res: Response) => {
    const logoRow = await dbGet<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = 'school_logo_url'"
    );
    res.json({ logoUrl: logoRow?.value || DEFAULT_LOGO_URL });
  })
);

app.post(
  '/api/settings/logo',
  requireAuth,
  requireStaff,
  upload.single('logo'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    let logoValue = '';

    if (req.file) {
      if (!ALLOWED_IMAGE_MIME.has(req.file.mimetype)) {
        res.status(400).json({ error: 'Please upload a valid PNG, JPG, or WEBP image.' });
        return;
      }
      if (req.file.size > 2 * 1024 * 1024) {
        res.status(400).json({ error: 'School icon image must be 2 MB or smaller.' });
        return;
      }
      logoValue = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    } else if (typeof req.body?.logo_url === 'string' && req.body.logo_url.trim()) {
      const candidate = cleanText(req.body.logo_url, 1000);
      if (!isValidHttpUrl(candidate)) {
        res.status(400).json({ error: 'Please provide a valid http:// or https:// image URL.' });
        return;
      }
      logoValue = candidate;
    } else {
      res.status(400).json({ error: 'Please upload a PNG/JPG/WEBP logo image or provide an image URL.' });
      return;
    }

    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('school_logo_url', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [logoValue, now]
    );

    res.json({ logoUrl: logoValue });
  })
);

app.delete(
  '/api/settings/logo',
  requireAuth,
  requireStaff,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    await dbRun("DELETE FROM app_settings WHERE key = 'school_logo_url'");
    res.json({ logoUrl: DEFAULT_LOGO_URL });
  })
);

// ============================================================================
// TEACHERS DIRECTORY & PERMANENTLY EDITABLE CONTACTS (Owner / Admin Editable)
// ============================================================================
app.get(
  '/api/teachers',
  requireAuth,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const teachers = await dbAll('SELECT * FROM teachers ORDER BY id ASC');
    res.json({ teachers });
  })
);

app.post(
  '/api/teachers',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const name = cleanText(req.body?.name, 100);
    const designation = cleanText(req.body?.designation, 100) || 'Assistant Teacher';
    const subject = cleanText(req.body?.subject, 120);
    const classAssigned = cleanText(req.body?.class_assigned, 50) || 'Class 9 & 10';
    const phone = cleanText(req.body?.phone, 25);

    if (name.length < 2 || !subject || !phone) {
      res.status(400).json({ error: 'Teacher name, subject, and contact number are required.' });
      return;
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO teachers (name, designation, subject, class_assigned, phone, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, designation, subject, classAssigned, phone, now]
    );

    const created = await dbGet('SELECT * FROM teachers WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ teacher: created });
  })
);

app.put(
  '/api/teachers/:id',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{
      id: number;
      name: string;
      designation: string;
      subject: string;
      class_assigned: string;
      phone: string;
    }>('SELECT * FROM teachers WHERE id = ?', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Teacher record not found.' });
      return;
    }

    const name = cleanText(req.body?.name, 100) || existing.name;
    const designation = cleanText(req.body?.designation, 100) || existing.designation;
    const subject = cleanText(req.body?.subject, 120) || existing.subject;
    const classAssigned = cleanText(req.body?.class_assigned, 50) || existing.class_assigned;
    const phone = cleanText(req.body?.phone, 25);

    if (!phone || phone.length < 7) {
      res.status(400).json({ error: 'Please enter a valid contact number.' });
      return;
    }

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE teachers
       SET name = ?, designation = ?, subject = ?, class_assigned = ?, phone = ?, updated_at = ?
       WHERE id = ?`,
      [name, designation, subject, classAssigned, phone, now, id]
    );

    const updated = await dbGet('SELECT * FROM teachers WHERE id = ?', [id]);
    res.json({ teacher: updated });
  })
);

app.delete(
  '/api/teachers/:id',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const del = await dbRun('DELETE FROM teachers WHERE id = ?', [id]);
    if (del.changes === 0) {
      res.status(404).json({ error: 'Teacher not found.' });
      return;
    }
    res.json({ ok: true });
  })
);

// ============================================================================
// PERMANENT FILE SERVING (Turso uploaded_files + local fallback)
// ============================================================================
app.get(
  '/api/uploads/:filename',
  asyncHandler(async (req: Request, res: Response) => {
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename.includes('..') || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      res.status(400).json({ error: 'Invalid file name' });
      return;
    }

    // 1. Serve from permanent Turso uploaded_files table
    const stored = await dbGet<{ mime_type: string; data_base64: string }>(
      'SELECT mime_type, data_base64 FROM uploaded_files WHERE filename = ?',
      [filename]
    );
    if (stored) {
      const buf = Buffer.from(stored.data_base64, 'base64');
      res.setHeader('Content-Type', stored.mime_type);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      } else {
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      }
      res.send(buf);
      return;
    }

    // 2. Fallback to local uploads directory (for legacy files)
    const resolved = path.resolve(UPLOAD_DIR, filename);
    if (!resolved.startsWith(UPLOAD_DIR + path.sep)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.query.download === '1') {
      res.download(resolved, filename);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.sendFile(resolved);
    }
  })
);

// ============================================================================
// DASHBOARD SUMMARY STATS
// ============================================================================
app.get(
  '/api/dashboard/summary',
  requireAuth,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const [
      studentsTotal,
      boysCount,
      girlsCount,
      class9Count,
      class10Count,
      materialsCount,
      noticesCount,
      galleryCount,
      messagesCount,
      quizzesCount,
      activeAdminsCount,
    ] = await Promise.all([
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM students'),
      dbGet<{ c: number }>("SELECT COUNT(*) as c FROM students WHERE gender = 'Boy'"),
      dbGet<{ c: number }>("SELECT COUNT(*) as c FROM students WHERE gender = 'Girl'"),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM students WHERE class_level = 9'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM students WHERE class_level = 10'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM materials'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM notices'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM gallery'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM messages'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM quiz_questions'),
      dbGet<{ c: number }>('SELECT COUNT(*) as c FROM admin_slots WHERE is_active = 1 AND login_id IS NOT NULL'),
    ]);

    res.json({
      studentsTotal: studentsTotal?.c ?? 0,
      boysCount: boysCount?.c ?? 0,
      girlsCount: girlsCount?.c ?? 0,
      class9Count: class9Count?.c ?? 0,
      class10Count: class10Count?.c ?? 0,
      materialsCount: materialsCount?.c ?? 0,
      noticesCount: noticesCount?.c ?? 0,
      galleryCount: galleryCount?.c ?? 0,
      messagesCount: messagesCount?.c ?? 0,
      quizzesCount: quizzesCount?.c ?? 0,
      activeAdminsCount: activeAdminsCount?.c ?? 0,
    });
  })
);

// ============================================================================
// STUDY MATERIALS (Class 9 & Class 10 Academic Portal)
// ============================================================================
app.get(
  '/api/materials',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const classFilter = req.query.class_level ? Number(req.query.class_level) : null;
    const subjectFilter = typeof req.query.subject_id === 'string' ? req.query.subject_id : null;

    let query = 'SELECT * FROM materials WHERE 1=1';
    const params: Array<string | number> = [];

    if (classFilter === 9 || classFilter === 10) {
      query += ' AND class_level = ?';
      params.push(classFilter);
    }
    if (subjectFilter && VALID_SUBJECTS.has(subjectFilter)) {
      query += ' AND subject_id = ?';
      params.push(subjectFilter);
    }
    query += ' ORDER BY created_at DESC, id DESC';

    const rows = await dbAll(query, params);
    res.json({ materials: rows });
  })
);

app.post(
  '/api/materials',
  requireAuth,
  requireStaff,
  upload.single('file'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const title = cleanText(req.body?.title, 200);
    const titleOr = cleanText(req.body?.title_or, 200) || null;
    const description = cleanText(req.body?.description, 1000) || null;
    const classLevel = Number(req.body?.class_level);
    const subjectId = cleanText(req.body?.subject_id, 50);
    const resourceType = req.body?.resource_type;
    const externalUrl = cleanText(req.body?.external_url, 500) || null;

    if (!title) {
      res.status(400).json({ error: 'Material title is required.' });
      return;
    }
    if (classLevel !== 9 && classLevel !== 10) {
      res.status(400).json({ error: 'Only Class 9 and Class 10 are supported.' });
      return;
    }
    if (!VALID_SUBJECTS.has(subjectId)) {
      res.status(400).json({ error: 'Invalid subject selected.' });
      return;
    }
    if (!['pdf', 'photo', 'link'].includes(resourceType)) {
      res.status(400).json({ error: 'Resource type must be pdf, photo, or link.' });
      return;
    }

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (resourceType === 'link') {
      if (!externalUrl || !isValidHttpUrl(externalUrl)) {
        res.status(400).json({ error: 'Please provide a valid http:// or https:// document link.' });
        return;
      }
    } else {
      if (!req.file) {
        res.status(400).json({ error: `Please upload a ${resourceType === 'pdf' ? 'PDF' : 'Photo'} file.` });
        return;
      }
      if (resourceType === 'pdf' && req.file.mimetype !== 'application/pdf') {
        res.status(400).json({ error: 'Uploaded file must be a PDF document.' });
        return;
      }
      if (resourceType === 'photo' && !ALLOWED_IMAGE_MIME.has(req.file.mimetype)) {
        res.status(400).json({ error: 'Uploaded file must be an image (JPG, PNG, WEBP).' });
        return;
      }
      fileUrl = await saveUploadedFile(req.file);
      fileName = cleanText(req.file.originalname, 180);
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO materials (
        title, title_or, description, class_level, subject_id, resource_type,
        file_url, file_name, external_url, uploaded_by_name, uploaded_by_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        titleOr,
        description,
        classLevel,
        subjectId,
        resourceType,
        fileUrl,
        fileName,
        resourceType === 'link' ? externalUrl : null,
        req.user!.name,
        req.user!.role,
        now,
      ]
    );

    const created = await dbGet('SELECT * FROM materials WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ material: created });
  })
);

app.put(
  '/api/materials/:id',
  requireAuth,
  requireStaff,
  upload.single('file'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{
      id: number;
      title: string;
      title_or: string | null;
      description: string | null;
      class_level: number;
      subject_id: string;
      resource_type: string;
      file_url: string | null;
      file_name: string | null;
      external_url: string | null;
    }>('SELECT * FROM materials WHERE id = ?', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    const title = cleanText(req.body?.title, 200) || existing.title;
    const titleOr = req.body?.title_or !== undefined ? cleanText(req.body.title_or, 200) || null : existing.title_or;
    const description =
      req.body?.description !== undefined ? cleanText(req.body.description, 1000) || null : existing.description;
    const classLevel = req.body?.class_level ? Number(req.body.class_level) : existing.class_level;
    const subjectId = req.body?.subject_id ? cleanText(req.body.subject_id, 50) : existing.subject_id;
    const resourceType = req.body?.resource_type || existing.resource_type;

    if (classLevel !== 9 && classLevel !== 10) {
      res.status(400).json({ error: 'Class must be 9 or 10.' });
      return;
    }
    if (!VALID_SUBJECTS.has(subjectId)) {
      res.status(400).json({ error: 'Invalid subject.' });
      return;
    }

    let fileUrl = existing.file_url;
    let fileName = existing.file_name;
    let externalUrl = existing.external_url;

    if (resourceType === 'link') {
      const newUrl = cleanText(req.body?.external_url, 500) || existing.external_url;
      if (!newUrl || !isValidHttpUrl(newUrl)) {
        res.status(400).json({ error: 'Valid http/https URL required.' });
        return;
      }
      externalUrl = newUrl;
      fileUrl = null;
      fileName = null;
    } else if (req.file) {
      fileUrl = await saveUploadedFile(req.file);
      fileName = cleanText(req.file.originalname, 180);
      externalUrl = null;
    }

    await dbRun(
      `UPDATE materials
       SET title = ?, title_or = ?, description = ?, class_level = ?, subject_id = ?,
           resource_type = ?, file_url = ?, file_name = ?, external_url = ?
       WHERE id = ?`,
      [title, titleOr, description, classLevel, subjectId, resourceType, fileUrl, fileName, externalUrl, id]
    );

    const updated = await dbGet('SELECT * FROM materials WHERE id = ?', [id]);
    res.json({ material: updated });
  })
);

app.delete(
  '/api/materials/:id',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{ id: number; file_url: string | null }>(
      'SELECT id, file_url FROM materials WHERE id = ?',
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Material not found.' });
      return;
    }
    await dbRun('DELETE FROM materials WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

// ============================================================================
// SCHOOL NOTICES & ANNOUNCEMENTS
// ============================================================================
app.get(
  '/api/notices',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const targetClass = typeof req.query.target_class === 'string' ? req.query.target_class : null;
    let rows;
    if (targetClass === '9' || targetClass === '10') {
      rows = await dbAll(
        "SELECT * FROM notices WHERE target_class = 'all' OR target_class = ? ORDER BY created_at DESC, id DESC",
        [targetClass]
      );
    } else {
      rows = await dbAll('SELECT * FROM notices ORDER BY created_at DESC, id DESC');
    }
    res.json({ notices: rows });
  })
);

app.post(
  '/api/notices',
  requireAuth,
  requireStaff,
  upload.single('attachment'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const title = cleanText(req.body?.title, 200);
    const titleOr = cleanText(req.body?.title_or, 200) || null;
    const content = cleanText(req.body?.content, 3000);
    const contentOr = cleanText(req.body?.content_or, 3000) || null;
    const priority = ['general', 'urgent', 'exam'].includes(req.body?.priority) ? req.body.priority : 'general';
    const targetClass = ['all', '9', '10'].includes(req.body?.target_class) ? req.body.target_class : 'all';

    if (!title || !content) {
      res.status(400).json({ error: 'Notice title and content are required.' });
      return;
    }

    let attachmentUrl: string | null = null;
    let attachmentType: 'none' | 'pdf' | 'photo' = 'none';
    let attachmentName: string | null = null;

    if (req.file) {
      attachmentUrl = await saveUploadedFile(req.file);
      attachmentType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'photo';
      attachmentName = cleanText(req.file.originalname, 180);
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO notices (
        title, title_or, content, content_or, priority, target_class,
        attachment_url, attachment_type, attachment_name, posted_by_name, posted_by_role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        titleOr,
        content,
        contentOr,
        priority,
        targetClass,
        attachmentUrl,
        attachmentType,
        attachmentName,
        req.user!.name,
        req.user!.role,
        now,
      ]
    );

    const created = await dbGet('SELECT * FROM notices WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ notice: created });
  })
);

app.put(
  '/api/notices/:id',
  requireAuth,
  requireStaff,
  upload.single('attachment'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{
      id: number;
      title: string;
      title_or: string | null;
      content: string;
      content_or: string | null;
      priority: string;
      target_class: string;
      attachment_url: string | null;
      attachment_type: string;
      attachment_name: string | null;
    }>('SELECT * FROM notices WHERE id = ?', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Notice not found.' });
      return;
    }

    const title = cleanText(req.body?.title, 200) || existing.title;
    const titleOr = req.body?.title_or !== undefined ? cleanText(req.body.title_or, 200) || null : existing.title_or;
    const content = cleanText(req.body?.content, 3000) || existing.content;
    const contentOr =
      req.body?.content_or !== undefined ? cleanText(req.body.content_or, 3000) || null : existing.content_or;
    const priority = ['general', 'urgent', 'exam'].includes(req.body?.priority) ? req.body.priority : existing.priority;
    const targetClass = ['all', '9', '10'].includes(req.body?.target_class)
      ? req.body.target_class
      : existing.target_class;

    let attachmentUrl = existing.attachment_url;
    let attachmentType = existing.attachment_type;
    let attachmentName = existing.attachment_name;

    if (req.file) {
      attachmentUrl = await saveUploadedFile(req.file);
      attachmentType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'photo';
      attachmentName = cleanText(req.file.originalname, 180);
    }

    await dbRun(
      `UPDATE notices
       SET title = ?, title_or = ?, content = ?, content_or = ?, priority = ?, target_class = ?,
           attachment_url = ?, attachment_type = ?, attachment_name = ?
       WHERE id = ?`,
      [title, titleOr, content, contentOr, priority, targetClass, attachmentUrl, attachmentType, attachmentName, id]
    );

    const updated = await dbGet('SELECT * FROM notices WHERE id = ?', [id]);
    res.json({ notice: updated });
  })
);

app.delete(
  '/api/notices/:id',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const resDel = await dbRun('DELETE FROM notices WHERE id = ?', [id]);
    if (resDel.changes === 0) {
      res.status(404).json({ error: 'Notice not found.' });
      return;
    }
    res.json({ ok: true });
  })
);

// ============================================================================
// SCHOOL PHOTO GALLERY & EVENTS
// ============================================================================
app.get(
  '/api/gallery',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const category = typeof req.query.category === 'string' ? req.query.category : null;
    let rows;
    if (category && ['tournament', 'event', 'notice', 'campus'].includes(category)) {
      rows = await dbAll('SELECT * FROM gallery WHERE category = ? ORDER BY created_at DESC, id DESC', [category]);
    } else {
      rows = await dbAll('SELECT * FROM gallery ORDER BY created_at DESC, id DESC');
    }
    res.json({ photos: rows });
  })
);

app.post(
  '/api/gallery',
  requireAuth,
  requireStaff,
  upload.single('photo'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const title = cleanText(req.body?.title, 200);
    const titleOr = cleanText(req.body?.title_or, 200) || null;
    const caption = cleanText(req.body?.caption, 500) || null;
    const category = ['tournament', 'event', 'notice', 'campus'].includes(req.body?.category)
      ? req.body.category
      : 'event';

    if (!title) {
      res.status(400).json({ error: 'Photo title is required.' });
      return;
    }
    if (!req.file || !ALLOWED_IMAGE_MIME.has(req.file.mimetype)) {
      res.status(400).json({ error: 'Please upload a valid image (JPG, PNG, or WEBP).' });
      return;
    }

    const imageUrl = await saveUploadedFile(req.file);
    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO gallery (title, title_or, caption, category, image_url, uploaded_by_name, uploaded_by_role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, titleOr, caption, category, imageUrl, req.user!.name, req.user!.role, now]
    );

    const created = await dbGet('SELECT * FROM gallery WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ photo: created });
  })
);

app.put(
  '/api/gallery/:id',
  requireAuth,
  requireStaff,
  upload.single('photo'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{
      id: number;
      title: string;
      title_or: string | null;
      caption: string | null;
      category: string;
      image_url: string;
    }>('SELECT * FROM gallery WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Photo not found.' });
      return;
    }

    const title = cleanText(req.body?.title, 200) || existing.title;
    const titleOr = req.body?.title_or !== undefined ? cleanText(req.body.title_or, 200) || null : existing.title_or;
    const caption = req.body?.caption !== undefined ? cleanText(req.body.caption, 500) || null : existing.caption;
    const category = ['tournament', 'event', 'notice', 'campus'].includes(req.body?.category)
      ? req.body.category
      : existing.category;
    const imageUrl =
      req.file && ALLOWED_IMAGE_MIME.has(req.file.mimetype)
        ? await saveUploadedFile(req.file)
        : existing.image_url;

    await dbRun(
      'UPDATE gallery SET title = ?, title_or = ?, caption = ?, category = ?, image_url = ? WHERE id = ?',
      [title, titleOr, caption, category, imageUrl, id]
    );
    const updated = await dbGet('SELECT * FROM gallery WHERE id = ?', [id]);
    res.json({ photo: updated });
  })
);

app.delete(
  '/api/gallery/:id',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const del = await dbRun('DELETE FROM gallery WHERE id = ?', [id]);
    if (del.changes === 0) {
      res.status(404).json({ error: 'Photo not found.' });
      return;
    }
    res.json({ ok: true });
  })
);

// ============================================================================
// BOYS & GIRLS INTERACTIVE MESSAGE BOARD
// ============================================================================
app.get(
  '/api/messages',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const genderFilter = req.query.gender === 'Boy' || req.query.gender === 'Girl' ? req.query.gender : null;
    const classFilter = req.query.class_level ? Number(req.query.class_level) : null;
    const mineOnly = req.query.mine === '1';

    let query = 'SELECT * FROM messages WHERE 1=1';
    const params: Array<string | number> = [];

    if (req.user!.role === 'student' && mineOnly) {
      query += ' AND student_id = ?';
      params.push(req.user!.id);
    }
    if (genderFilter) {
      query += ' AND student_gender = ?';
      params.push(genderFilter);
    }
    if (classFilter === 9 || classFilter === 10) {
      query += ' AND student_class = ?';
      params.push(classFilter);
    }
    query += ' ORDER BY created_at DESC, id DESC';

    const messages = await dbAll<Record<string, unknown> & { id: number }>(query, params);
    const allReplies = await dbAll<Record<string, unknown> & { message_id: number }>(
      'SELECT * FROM message_replies ORDER BY created_at ASC, id ASC'
    );
    const repliesByMsg = new Map<number, Array<Record<string, unknown>>>();
    for (const r of allReplies) {
      const list = repliesByMsg.get(r.message_id) || [];
      list.push(r);
      repliesByMsg.set(r.message_id, list);
    }

    const enriched = messages.map((m) => ({
      ...m,
      replies: repliesByMsg.get(m.id) || [],
    }));

    res.json({ messages: enriched });
  })
);

app.post(
  '/api/messages',
  requireAuth,
  upload.single('attachment'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (!req.user || req.user.role !== 'student' || !req.user.student) {
      res.status(403).json({ error: 'Only registered students post new doubt threads; staff reply directly to messages.' });
      return;
    }

    const content = cleanText(req.body?.content, 2000);
    const subjectTag = cleanText(req.body?.subject_tag, 50) || null;

    if (!content) {
      res.status(400).json({ error: 'Please write your message or doubt before sending.' });
      return;
    }

    let attachmentUrl: string | null = null;
    let attachmentType: 'none' | 'pdf' | 'photo' = 'none';
    let attachmentName: string | null = null;

    if (req.file) {
      attachmentUrl = await saveUploadedFile(req.file);
      attachmentType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'photo';
      attachmentName = cleanText(req.file.originalname, 180);
    }

    const s = req.user.student;
    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO messages (
        student_id, student_name, student_gender, student_class, student_roll,
        subject_tag, content, attachment_url, attachment_type, attachment_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.full_name,
        s.gender,
        s.class_level,
        s.roll_number,
        subjectTag,
        content,
        attachmentUrl,
        attachmentType,
        attachmentName,
        now,
      ]
    );

    const created = await dbGet<Record<string, unknown>>('SELECT * FROM messages WHERE id = ?', [
      result.lastInsertRowid,
    ]);
    res.status(201).json({ message: { ...created, replies: [] } });
  })
);

app.post(
  '/api/messages/:id/replies',
  requireAuth,
  requireStaff,
  upload.single('attachment'),
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const messageId = Number(req.params.id);
    const parent = await dbGet<{ id: number }>('SELECT id FROM messages WHERE id = ?', [messageId]);
    if (!parent) {
      res.status(404).json({ error: 'Message thread not found.' });
      return;
    }

    const content = cleanText(req.body?.content, 2000);
    if (!content && !req.file) {
      res.status(400).json({ error: 'Please enter a reply or attach a PDF/Photo.' });
      return;
    }

    let attachmentUrl: string | null = null;
    let attachmentType: 'none' | 'pdf' | 'photo' = 'none';
    let attachmentName: string | null = null;

    if (req.file) {
      attachmentUrl = await saveUploadedFile(req.file);
      attachmentType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'photo';
      attachmentName = cleanText(req.file.originalname, 180);
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO message_replies (
        message_id, sender_name, sender_role, content, attachment_url, attachment_type, attachment_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        req.user!.name,
        req.user!.role,
        content || (attachmentType === 'pdf' ? 'Shared PDF attachment' : 'Shared Photo attachment'),
        attachmentUrl,
        attachmentType,
        attachmentName,
        now,
      ]
    );

    const created = await dbGet('SELECT * FROM message_replies WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ reply: created });
  })
);

app.delete(
  '/api/messages/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{ id: number; student_id: number }>(
      'SELECT id, student_id FROM messages WHERE id = ?',
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }
    const isStaff = req.user!.role === 'super_owner' || req.user!.role === 'admin';
    const isAuthor = req.user!.role === 'student' && existing.student_id === req.user!.id;
    if (!isStaff && !isAuthor) {
      res.status(403).json({ error: 'You cannot delete another student’s message.' });
      return;
    }
    await dbRun('DELETE FROM messages WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

app.delete(
  '/api/messages/replies/:replyId',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const replyId = Number(req.params.replyId);
    await dbRun('DELETE FROM message_replies WHERE id = ?', [replyId]);
    res.json({ ok: true });
  })
);

// ============================================================================
// ONLINE EXAM / MCQ PRACTICE QUIZ
// ============================================================================
app.get(
  '/api/quizzes',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const classFilter = req.query.class_level ? Number(req.query.class_level) : null;
    const subjectFilter = typeof req.query.subject_id === 'string' ? req.query.subject_id : null;

    let query = 'SELECT * FROM quiz_questions WHERE 1=1';
    const params: Array<string | number> = [];

    if (classFilter === 9 || classFilter === 10) {
      query += ' AND class_level = ?';
      params.push(classFilter);
    }
    if (subjectFilter && VALID_SUBJECTS.has(subjectFilter)) {
      query += ' AND subject_id = ?';
      params.push(subjectFilter);
    }
    query += ' ORDER BY id DESC';

    const rows = await dbAll<{
      id: number;
      class_level: number;
      subject_id: string;
      question: string;
      question_or: string | null;
      options_json: string;
      correct_index: number;
      explanation: string | null;
      created_by_name: string;
      created_at: string;
    }>(query, params);

    const questions = rows.map((r) => ({
      ...r,
      options: JSON.parse(r.options_json) as string[],
    }));

    const attempts =
      req.user!.role === 'student'
        ? await dbAll('SELECT * FROM quiz_attempts WHERE student_id = ? ORDER BY created_at DESC LIMIT 15', [
            req.user!.id,
          ])
        : [];

    res.json({ questions, attempts });
  })
);

app.post(
  '/api/quizzes',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const classLevel = Number(req.body?.class_level);
    const subjectId = cleanText(req.body?.subject_id, 50);
    const question = cleanText(req.body?.question, 600);
    const questionOr = cleanText(req.body?.question_or, 600) || null;
    const options = Array.isArray(req.body?.options)
      ? req.body.options.map((o: unknown) => cleanText(o, 250))
      : [];
    const correctIndex = Number(req.body?.correct_index);
    const explanation = cleanText(req.body?.explanation, 600) || null;

    if (classLevel !== 9 && classLevel !== 10) {
      res.status(400).json({ error: 'Class must be 9 or 10.' });
      return;
    }
    if (!VALID_SUBJECTS.has(subjectId)) {
      res.status(400).json({ error: 'Invalid subject.' });
      return;
    }
    if (!question || options.length !== 4 || options.some((o: string) => !o)) {
      res.status(400).json({ error: 'Question and all 4 options are required.' });
      return;
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      res.status(400).json({ error: 'Correct option index must be 0, 1, 2, or 3.' });
      return;
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO quiz_questions (
        class_level, subject_id, question, question_or, options_json, correct_index, explanation, created_by_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [classLevel, subjectId, question, questionOr, JSON.stringify(options), correctIndex, explanation, req.user!.name, now]
    );

    const created = await dbGet<{ options_json: string }>('SELECT * FROM quiz_questions WHERE id = ?', [
      result.lastInsertRowid,
    ]);
    res.status(201).json({ question: { ...created, options: JSON.parse(created!.options_json) } });
  })
);

app.delete(
  '/api/quizzes/:id',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    await dbRun('DELETE FROM quiz_questions WHERE id = ?', [id]);
    res.json({ ok: true });
  })
);

app.post(
  '/api/quizzes/attempts',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    if (req.user!.role !== 'student') {
      res.json({ ok: true });
      return;
    }
    const classLevel = Number(req.body?.class_level);
    const subjectId = cleanText(req.body?.subject_id, 50) || 'all';
    const score = Number(req.body?.score);
    const total = Number(req.body?.total);
    if ((classLevel !== 9 && classLevel !== 10) || !Number.isInteger(score) || !Number.isInteger(total) || total <= 0) {
      res.status(400).json({ error: 'Invalid attempt payload.' });
      return;
    }
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO quiz_attempts (student_id, class_level, subject_id, score, total, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user!.id, classLevel, subjectId, score, total, now]
    );
    res.status(201).json({ ok: true });
  })
);

// ============================================================================
// SUPER OWNER EXCLUSIVE CONTROLS (5 Admin Slots, Students, Transfer, Backup)
// ============================================================================

// List 5 Admin Slots
app.get(
  '/api/owner/admins',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const slots = await dbAll(
      `SELECT slot_number, name, login_id, is_active, assigned_at, updated_at
       FROM admin_slots ORDER BY slot_number ASC`
    );
    res.json({ slots });
  })
);

// Assign / Update Admin Slot (1 to 5)
app.put(
  '/api/owner/admins/:slot',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
      res.status(400).json({ error: 'Admin slot must be between 1 and 5.' });
      return;
    }

    const name = cleanText(req.body?.name, 100);
    const loginId = cleanText(req.body?.login_id, 100).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const isActive = req.body?.is_active === false ? 0 : 1;

    if (!name || !loginId) {
      res.status(400).json({ error: 'Admin Name and Mobile Number / Login ID are required.' });
      return;
    }

    const owner = await dbGet<{ login_id: string; mobile: string }>('SELECT login_id, mobile FROM owner WHERE id = 1');
    if (owner && (owner.login_id.toLowerCase() === loginId || owner.mobile.toLowerCase() === loginId)) {
      res.status(409).json({ error: 'Admin Login ID cannot match the Super Owner ID or Mobile.' });
      return;
    }

    const duplicate = await dbGet<{ slot_number: number }>(
      'SELECT slot_number FROM admin_slots WHERE LOWER(login_id) = ? AND slot_number != ?',
      [loginId, slot]
    );
    if (duplicate) {
      res.status(409).json({ error: 'This Mobile / Login ID is already assigned to another Admin slot.' });
      return;
    }

    const existing = await dbGet<{ password_hash: string | null; assigned_at: string | null }>(
      'SELECT password_hash, assigned_at FROM admin_slots WHERE slot_number = ?',
      [slot]
    );

    let passwordHash = existing?.password_hash || null;
    if (password) {
      if (password.length < 6) {
        res.status(400).json({ error: 'Admin password must be at least 6 characters.' });
        return;
      }
      passwordHash = hashPassword(password);
    }
    if (!passwordHash) {
      res.status(400).json({ error: 'A password (min 6 characters) is required when assigning a new Admin.' });
      return;
    }

    const now = new Date().toISOString();
    await dbRun(
      `UPDATE admin_slots
       SET name = ?, login_id = ?, password_hash = ?, is_active = ?, assigned_at = COALESCE(assigned_at, ?), updated_at = ?
       WHERE slot_number = ?`,
      [name, loginId, passwordHash, isActive, now, now, slot]
    );

    if (password || isActive === 0) {
      await revokeSessionsFor('admin', slot);
    }

    const updated = await dbGet(
      'SELECT slot_number, name, login_id, is_active, assigned_at, updated_at FROM admin_slots WHERE slot_number = ?',
      [slot]
    );
    res.json({ slot: updated });
  })
);

// Toggle active status of an Admin Slot
app.patch(
  '/api/owner/admins/:slot/status',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
      res.status(400).json({ error: 'Invalid Admin slot.' });
      return;
    }
    const existing = await dbGet<{ login_id: string | null }>(
      'SELECT login_id FROM admin_slots WHERE slot_number = ?',
      [slot]
    );
    if (!existing || !existing.login_id) {
      res.status(400).json({ error: 'Cannot toggle an unassigned Admin slot.' });
      return;
    }
    const isActive = req.body?.is_active ? 1 : 0;
    const now = new Date().toISOString();
    await dbRun('UPDATE admin_slots SET is_active = ?, updated_at = ? WHERE slot_number = ?', [isActive, now, slot]);
    if (isActive === 0) {
      await revokeSessionsFor('admin', slot);
    }
    const updated = await dbGet(
      'SELECT slot_number, name, login_id, is_active, assigned_at, updated_at FROM admin_slots WHERE slot_number = ?',
      [slot]
    );
    res.json({ slot: updated });
  })
);

// Clear / Remove an Admin Slot
app.delete(
  '/api/owner/admins/:slot',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const slot = Number(req.params.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) {
      res.status(400).json({ error: 'Invalid Admin slot.' });
      return;
    }
    const now = new Date().toISOString();
    await dbRun(
      `UPDATE admin_slots
       SET name = NULL, login_id = NULL, password_hash = NULL, is_active = 0, assigned_at = NULL, updated_at = ?
       WHERE slot_number = ?`,
      [now, slot]
    );
    await revokeSessionsFor('admin', slot);
    res.json({ ok: true });
  })
);

// Registered Students Directory
app.get(
  '/api/students',
  requireAuth,
  requireStaff,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const gender = req.query.gender === 'Boy' || req.query.gender === 'Girl' ? req.query.gender : null;
    const classLevel = req.query.class_level ? Number(req.query.class_level) : null;
    const search = cleanText(req.query.search, 100).toLowerCase();

    let query =
      'SELECT id, reg_code, full_name, gender, class_level, roll_number, mobile, is_active, created_at FROM students WHERE 1=1';
    const params: Array<string | number> = [];

    if (gender) {
      query += ' AND gender = ?';
      params.push(gender);
    }
    if (classLevel === 9 || classLevel === 10) {
      query += ' AND class_level = ?';
      params.push(classLevel);
    }
    if (search) {
      query += ' AND (LOWER(full_name) LIKE ? OR LOWER(roll_number) LIKE ? OR mobile LIKE ? OR LOWER(reg_code) LIKE ?)';
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
    query += ' ORDER BY class_level ASC, CAST(roll_number AS INTEGER) ASC, created_at DESC';

    const students = await dbAll(query, params);
    res.json({ students });
  })
);

app.put(
  '/api/owner/students/:id',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = await dbGet<{
      id: number;
      full_name: string;
      gender: string;
      class_level: number;
      roll_number: string;
      mobile: string;
      is_active: number;
      password_hash: string;
    }>('SELECT * FROM students WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const fullName = cleanText(req.body?.full_name, 100) || existing.full_name;
    const gender = req.body?.gender === 'Boy' || req.body?.gender === 'Girl' ? req.body.gender : existing.gender;
    const classLevel =
      req.body?.class_level === 9 || req.body?.class_level === 10 ? Number(req.body.class_level) : existing.class_level;
    const rollNumber = cleanText(req.body?.roll_number, 30) || existing.roll_number;
    const mobile = cleanText(req.body?.mobile, 20).replace(/\s+/g, '') || existing.mobile;
    const isActive = req.body?.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;
    const newPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!/^\d{10}$/.test(mobile)) {
      res.status(400).json({ error: 'Mobile must be 10 digits.' });
      return;
    }

    const conflict = await dbGet<{ id: number }>('SELECT id FROM students WHERE mobile = ? AND id != ?', [mobile, id]);
    if (conflict) {
      res.status(409).json({ error: 'Another student already uses this mobile number.' });
      return;
    }

    let passwordHash = existing.password_hash;
    if (newPassword) {
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      passwordHash = hashPassword(newPassword);
    }

    await dbRun(
      `UPDATE students
       SET full_name = ?, gender = ?, class_level = ?, roll_number = ?, mobile = ?, is_active = ?, password_hash = ?
       WHERE id = ?`,
      [fullName, gender, classLevel, rollNumber, mobile, isActive, passwordHash, id]
    );

    if (isActive === 0 || newPassword) {
      await revokeSessionsFor('student', id);
    }

    const updated = await dbGet(
      'SELECT id, reg_code, full_name, gender, class_level, roll_number, mobile, is_active, created_at FROM students WHERE id = ?',
      [id]
    );
    res.json({ student: updated });
  })
);

app.delete(
  '/api/owner/students/:id',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const id = Number(req.params.id);
    await revokeSessionsFor('student', id);
    const del = await dbRun('DELETE FROM students WHERE id = ?', [id]);
    if (del.changes === 0) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    res.json({ ok: true });
  })
);

// SELL / TRANSFER OWNERSHIP SETTINGS (Super Owner Exclusive)
app.get(
  '/api/owner/profile',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const owner = await dbGet('SELECT id, name, login_id, mobile, updated_at FROM owner WHERE id = 1');
    res.json({ owner });
  })
);

app.post(
  '/api/owner/transfer-ownership',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const currentPassword = typeof req.body?.current_password === 'string' ? req.body.current_password : '';
    const newName = cleanText(req.body?.new_name, 100);
    const newLoginId = cleanText(req.body?.new_login_id, 100).toLowerCase();
    const newMobile = cleanText(req.body?.new_mobile, 20).replace(/\s+/g, '');
    const newPassword = typeof req.body?.new_password === 'string' ? req.body.new_password : '';

    const owner = await dbGet<{
      id: number;
      name: string;
      login_id: string;
      mobile: string;
      password_hash: string;
    }>('SELECT * FROM owner WHERE id = 1');

    if (!owner || !verifyPassword(currentPassword, owner.password_hash)) {
      res.status(401).json({ error: 'Current Super Owner password is incorrect.' });
      return;
    }
    if (newName.length < 2) {
      res.status(400).json({ error: 'New Owner Name is required.' });
      return;
    }
    if (newLoginId.length < 4) {
      res.status(400).json({ error: 'New Owner Login ID must be at least 4 characters.' });
      return;
    }
    if (!/^\d{10}$/.test(newMobile)) {
      res.status(400).json({ error: 'New Owner Mobile Number must be 10 digits.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New Owner Password must be at least 6 characters.' });
      return;
    }

    const adminConflict = await dbGet<{ slot_number: number }>(
      'SELECT slot_number FROM admin_slots WHERE LOWER(login_id) = ? OR LOWER(login_id) = ?',
      [newLoginId, newMobile]
    );
    if (adminConflict) {
      res.status(409).json({
        error: 'The new Owner ID or Mobile conflicts with an existing Admin slot. Clear or edit that Admin slot first.',
      });
      return;
    }

    const now = new Date().toISOString();
    const newHash = hashPassword(newPassword);

    await dbRun(
      `UPDATE owner
       SET name = ?, login_id = ?, mobile = ?, password_hash = ?, updated_at = ?
       WHERE id = 1`,
      [newName, newLoginId, newMobile, newHash, now]
    );

    await revokeSessionsFor('super_owner', 1);
    const newToken = await createSession('super_owner', 1);
    setSessionCookie(req, res, newToken);

    res.json({
      ok: true,
      token: newToken,
      user: {
        role: 'super_owner',
        id: 1,
        name: newName,
        loginId: newLoginId,
        mobile: newMobile,
      },
      updated_at: now,
    });
  })
);

// CSV EXPORT OF REGISTERED STUDENTS (Super Owner Exclusive)
app.get(
  '/api/owner/export/students.csv',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const gender = req.query.gender === 'Boy' || req.query.gender === 'Girl' ? req.query.gender : null;
    const classLevel = req.query.class_level ? Number(req.query.class_level) : null;

    let query =
      'SELECT reg_code, full_name, gender, class_level, roll_number, mobile, is_active, created_at FROM students WHERE 1=1';
    const params: Array<string | number> = [];
    if (gender) {
      query += ' AND gender = ?';
      params.push(gender);
    }
    if (classLevel === 9 || classLevel === 10) {
      query += ' AND class_level = ?';
      params.push(classLevel);
    }
    query += ' ORDER BY class_level ASC, CAST(roll_number AS INTEGER) ASC';

    const rows = await dbAll<{
      reg_code: string;
      full_name: string;
      gender: string;
      class_level: number;
      roll_number: string;
      mobile: string;
      is_active: number;
      created_at: string;
    }>(query, params);

    const header = ['Registration Code', 'Full Name', 'Gender', 'Class', 'Roll Number', 'Mobile Number', 'Status', 'Registered At'];
    const csvLines = [
      header.join(','),
      ...rows.map((r) =>
        [
          r.reg_code,
          r.full_name,
          r.gender,
          `Class ${r.class_level}`,
          r.roll_number,
          r.mobile,
          r.is_active ? 'Active' : 'Suspended',
          r.created_at,
        ]
          .map(sanitizeCsvCell)
          .join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lnks-high-school-students.csv"');
    res.send(csvLines.join('\n'));
  })
);

// FULL BACKUP EXPORT JSON (Super Owner Exclusive)
app.get(
  '/api/owner/backup/export',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (_req: AuthedRequest, res: Response) => {
    const [students, adminSlots, materials, notices, gallery, messages, messageReplies, quizQuestions, teachers] =
      await Promise.all([
        dbAll('SELECT id, reg_code, full_name, gender, class_level, roll_number, mobile, is_active, created_at FROM students'),
        dbAll('SELECT slot_number, name, login_id, is_active, assigned_at, updated_at FROM admin_slots ORDER BY slot_number ASC'),
        dbAll('SELECT * FROM materials'),
        dbAll('SELECT * FROM notices'),
        dbAll('SELECT * FROM gallery'),
        dbAll('SELECT * FROM messages'),
        dbAll('SELECT * FROM message_replies'),
        dbAll('SELECT * FROM quiz_questions'),
        dbAll('SELECT * FROM teachers'),
      ]);

    const backup = {
      schema_version: '1.1',
      school: 'L.N.K.S HIGH SCHOOL',
      exported_at: new Date().toISOString(),
      data: {
        students,
        admin_slots: adminSlots,
        materials,
        notices,
        gallery,
        messages,
        message_replies: messageReplies,
        quiz_questions: quizQuestions,
        teachers,
      },
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lnks-high-school-backup.json"');
    res.json(backup);
  })
);

// FULL BACKUP RESTORE / IMPORT JSON (Super Owner Exclusive)
app.post(
  '/api/owner/backup/import',
  requireAuth,
  requireSuperOwner,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const payload = req.body?.data;
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid backup file format. Missing "data" object.' });
      return;
    }

    const safeInternalAsset = (val: unknown): string | null => {
      if (typeof val !== 'string') return null;
      const trimmed = val.trim();
      if (trimmed.startsWith('/api/uploads/') || trimmed.startsWith('/src/assets/images/')) {
        return trimmed.slice(0, 300);
      }
      return null;
    };

    const tx = await db.transaction('write');
    try {
      const restoredCounts = {
        notices: 0,
        materials: 0,
        gallery: 0,
        quiz_questions: 0,
        students: 0,
        teachers: 0,
      };

      if (Array.isArray(payload.notices)) {
        await tx.execute('DELETE FROM notices');
        for (const n of payload.notices) {
          if (n?.title && n?.content) {
            const safeAtt = safeInternalAsset(n.attachment_url);
            await tx.execute({
              sql: `INSERT INTO notices (title, title_or, content, content_or, priority, target_class, attachment_url, attachment_type, attachment_name, posted_by_name, posted_by_role, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                cleanText(n.title, 200),
                cleanText(n.title_or, 200) || null,
                cleanText(n.content, 3000),
                cleanText(n.content_or, 3000) || null,
                ['general', 'urgent', 'exam'].includes(n.priority) ? n.priority : 'general',
                ['all', '9', '10'].includes(String(n.target_class)) ? String(n.target_class) : 'all',
                safeAtt,
                safeAtt && ['pdf', 'photo'].includes(n.attachment_type) ? n.attachment_type : 'none',
                safeAtt ? cleanText(n.attachment_name, 180) || null : null,
                cleanText(n.posted_by_name, 100) || 'Restored',
                cleanText(n.posted_by_role, 30) || 'super_owner',
                n.created_at || new Date().toISOString(),
              ],
            });
            restoredCounts.notices++;
          }
        }
      }

      if (Array.isArray(payload.materials)) {
        await tx.execute('DELETE FROM materials');
        for (const m of payload.materials) {
          const cl = Number(m?.class_level);
          if (m?.title && (cl === 9 || cl === 10) && VALID_SUBJECTS.has(m?.subject_id)) {
            const rType = ['pdf', 'photo', 'link'].includes(m.resource_type) ? m.resource_type : 'link';
            const extUrl = rType === 'link' && isValidHttpUrl(m.external_url) ? m.external_url : null;
            const safeFile = rType !== 'link' ? safeInternalAsset(m.file_url) : null;
            await tx.execute({
              sql: `INSERT INTO materials (title, title_or, description, class_level, subject_id, resource_type, file_url, file_name, external_url, uploaded_by_name, uploaded_by_role, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                cleanText(m.title, 200),
                cleanText(m.title_or, 200) || null,
                cleanText(m.description, 1000) || null,
                cl,
                m.subject_id,
                rType,
                safeFile,
                safeFile ? cleanText(m.file_name, 180) || null : null,
                extUrl,
                cleanText(m.uploaded_by_name, 100) || 'Restored',
                cleanText(m.uploaded_by_role, 30) || 'super_owner',
                m.created_at || new Date().toISOString(),
              ],
            });
            restoredCounts.materials++;
          }
        }
      }

      if (Array.isArray(payload.gallery)) {
        await tx.execute('DELETE FROM gallery');
        for (const g of payload.gallery) {
          const safeImg = safeInternalAsset(g?.image_url);
          if (g?.title && safeImg) {
            await tx.execute({
              sql: `INSERT INTO gallery (title, title_or, caption, category, image_url, uploaded_by_name, uploaded_by_role, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                cleanText(g.title, 200),
                cleanText(g.title_or, 200) || null,
                cleanText(g.caption, 500) || null,
                ['tournament', 'event', 'notice', 'campus'].includes(g.category) ? g.category : 'event',
                safeImg,
                cleanText(g.uploaded_by_name, 100) || 'Restored',
                cleanText(g.uploaded_by_role, 30) || 'super_owner',
                g.created_at || new Date().toISOString(),
              ],
            });
            restoredCounts.gallery++;
          }
        }
      }

      if (Array.isArray(payload.quiz_questions)) {
        await tx.execute('DELETE FROM quiz_questions');
        for (const q of payload.quiz_questions) {
          const cl = Number(q?.class_level);
          const opts = typeof q?.options_json === 'string' ? q.options_json : JSON.stringify(q?.options || []);
          const ci = Number(q?.correct_index);
          if (q?.question && (cl === 9 || cl === 10) && VALID_SUBJECTS.has(q?.subject_id) && ci >= 0 && ci <= 3) {
            await tx.execute({
              sql: `INSERT INTO quiz_questions (class_level, subject_id, question, question_or, options_json, correct_index, explanation, created_by_name, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                cl,
                q.subject_id,
                cleanText(q.question, 600),
                cleanText(q.question_or, 600) || null,
                opts,
                ci,
                cleanText(q.explanation, 600) || null,
                cleanText(q.created_by_name, 100) || 'Restored',
                q.created_at || new Date().toISOString(),
              ],
            });
            restoredCounts.quiz_questions++;
          }
        }
      }

      if (Array.isArray(payload.teachers)) {
        await tx.execute('DELETE FROM teachers');
        for (const t of payload.teachers) {
          const name = cleanText(t?.name, 100);
          const phone = cleanText(t?.phone, 25);
          if (name && phone) {
            await tx.execute({
              sql: `INSERT INTO teachers (name, designation, subject, class_assigned, phone, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)`,
              args: [
                name,
                cleanText(t.designation, 100) || 'Assistant Teacher',
                cleanText(t.subject, 120) || 'General',
                cleanText(t.class_assigned, 50) || 'Class 9 & 10',
                phone,
                t.updated_at || new Date().toISOString(),
              ],
            });
            restoredCounts.teachers++;
          }
        }
      }

      if (Array.isArray(payload.students)) {
        for (const s of payload.students) {
          const mobile = cleanText(s?.mobile, 20).replace(/\s+/g, '');
          const cl = Number(s?.class_level);
          if (!/^\d{10}$/.test(mobile) || (cl !== 9 && cl !== 10) || (s?.gender !== 'Boy' && s?.gender !== 'Girl')) {
            continue;
          }
          const existingRes = await tx.execute({
            sql: 'SELECT id FROM students WHERE mobile = ?',
            args: [mobile],
          });
          if (existingRes.rows.length > 0) {
            const existingId = Number(existingRes.rows[0].id);
            await tx.execute({
              sql: 'UPDATE students SET full_name = ?, gender = ?, class_level = ?, roll_number = ?, is_active = ? WHERE id = ?',
              args: [
                cleanText(s.full_name, 100),
                s.gender,
                cl,
                cleanText(s.roll_number, 30),
                s.is_active ? 1 : 0,
                existingId,
              ],
            });
          } else {
            await tx.execute({
              sql: `INSERT INTO students (reg_code, full_name, gender, class_level, roll_number, mobile, password_hash, is_active, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              args: [
                cleanText(s.reg_code, 40) || `LNKS-2026-C${cl}-${crypto.randomInt(1000, 9999)}`,
                cleanText(s.full_name, 100),
                s.gender,
                cl,
                cleanText(s.roll_number, 30),
                mobile,
                hashPassword(mobile),
                s.is_active ? 1 : 0,
                s.created_at || new Date().toISOString(),
              ],
            });
          }
          restoredCounts.students++;
        }
      }

      await tx.commit();
      res.json({ ok: true, restored: restoredCounts });
    } catch (err: unknown) {
      await tx.rollback();
      const message = err instanceof Error ? err.message : 'Restore failed';
      res.status(400).json({ error: message });
    }
  })
);

// Multer & Express JSON error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds 10MB limit.' : err.message });
    return;
  }
  const msg = err instanceof Error ? err.message : 'Internal server error';
  res.status(400).json({ error: msg });
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING
// ============================================================================
async function startServer() {
  // Ensure Turso tables, persistent session secret, and initial seed data are ready before serving requests
  await initializeDatabase();

  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`L.N.K.S HIGH SCHOOL Portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start L.N.K.S High School Portal server:', err);
  process.exit(1);
});
