import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { query, checkDbConnection, isDbConfigured, getPool } from './db';

const router = Router();

// General limiter: applies to every route on this router as a baseline.
// Generous enough for normal app usage, tight enough to stop flooding.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

// Strict limiter for login/register specifically — slows down
// brute-force credential attempts far more than the general limit.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Moderate limiter for the unauthenticated device/analytics endpoints —
// legitimate devices call these periodically, so this is looser than
// the auth limiter but still stops spam registration/analytics abuse.
const deviceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

router.use(generalLimiter);

// Extend Request type to include verified authenticated user ID
export interface AuthenticatedRequest extends Request {
  userId?: number;
}

// In-Memory Fallback Stores (used when DATABASE_URL is not yet connected)
interface MemoryUser {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  github_connected?: boolean;
  github_connected_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface MemoryProject {
  id: number;
  user_id: number;
  project_id: string;
  name: string;
  data: any;
  created_at: string;
  updated_at: string;
}

interface MemoryDevice {
  id: number;
  device_id: string;
  fcm_token: string;
  user_id: number | null;
  platform: string;
  app_version: string | null;
  installed_at: string;
  last_seen_at: string;
}

interface MemoryLanguageEvent {
  id: number;
  device_id: string;
  user_id: number | null;
  language: string;
  action: string;
  created_at: string;
}

interface MemoryExtensionEvent {
  id: number;
  device_id: string;
  user_id: number | null;
  extension_id: string;
  extension_name: string | null;
  created_at: string;
}

const memoryUsers: MemoryUser[] = [];
let nextUserId = 1;

const memoryProjects: MemoryProject[] = [];
let nextProjectId = 1;

const memoryDevices: MemoryDevice[] = [
  {
    id: 1,
    device_id: '8f3b21c4-729d-4e92-9388-c4491763a890',
    fcm_token: 'fcm_sample_token_xZa90123891048_test',
    user_id: null,
    platform: 'android',
    app_version: '1.0.0',
    installed_at: new Date(Date.now() - 3600000).toISOString(),
    last_seen_at: new Date().toISOString(),
  },
];
let nextDeviceId = 2;

const memoryLanguageEvents: MemoryLanguageEvent[] = [];
let nextLangEventId = 1;

const memoryExtensionEvents: MemoryExtensionEvent[] = [];
let nextExtEventId = 1;

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
const LOOSE_UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidUuid(id: string): boolean {
  return typeof id === 'string' && (UUID_REGEX.test(id) || LOOSE_UUID_REGEX.test(id));
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '' || secret.includes('generate-a-long-random-string')) {
    return 'default_dev_secret_fallback_do_not_use_in_prod';
  }
  return secret;
}

function generateToken(userId: number): string {
  return jwt.sign({ user_id: userId }, getJwtSecret(), {
    expiresIn: '30d',
  });
}

// ==========================================
// Authentication Middleware
// ==========================================
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token =
    authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

  if (!token) {
    res.status(401).json({
      error: 'Access denied: Missing or malformed Authorization header (Bearer <token> required)',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      user_id?: number | string;
      [key: string]: any;
    };

    if (!decoded || decoded.user_id === undefined || decoded.user_id === null) {
      res.status(401).json({
        error: 'Invalid authentication token: user_id payload missing',
      });
      return;
    }

    req.userId = Number(decoded.user_id);
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Authentication token has expired. Please log in again.',
      });
      return;
    }
    res.status(401).json({
      error: 'Invalid or malformed authentication token',
    });
  }
}

// Soft/Optional Authentication Middleware
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim() : null;
  if (!token) { next(); return; }
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { user_id?: number | string };
    if (decoded && decoded.user_id !== undefined && decoded.user_id !== null) {
      req.userId = Number(decoded.user_id);
    }
  } catch {
    // ignore invalid/expired token here — this route doesn't require auth
  }
  next();
}

// Admin-check Helper (looks up email for authenticated userId and compares against ADMIN_EMAILS)
async function isAdminUser(userId: number): Promise<boolean> {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.length === 0) return false;
  if (getPool()) {
    try {
      const result = await query('SELECT email FROM users WHERE id = $1', [userId]);
      if (result.rows.length > 0) {
        return adminEmails.includes(String(result.rows[0].email).toLowerCase());
      }
    } catch (e: any) {
      console.warn('isAdminUser DB check failed:', e.message);
    }
  }
  const memUser = memoryUsers.find(u => u.id === userId);
  return memUser ? adminEmails.includes(memUser.email.toLowerCase()) : false;
}

// ==========================================
// Public Health Endpoint
// ==========================================
export async function handleHealthCheck(req: Request, res: Response) {
  try {
    const dbStatus = await checkDbConnection();
    const hasGithub = Boolean(
      process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      !process.env.GITHUB_CLIENT_ID.includes('your_')
    );
    const hasJwtSecret = Boolean(
      process.env.JWT_SECRET &&
      !process.env.JWT_SECRET.includes('generate-a-long-random-string')
    );
    const adminEmailsConfigured = Boolean(
      process.env.ADMIN_EMAILS && process.env.ADMIN_EMAILS.trim() !== ''
    );

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        configured: isDbConfigured(),
        connected: dbStatus.connected,
        ...(dbStatus.error ? { error: dbStatus.error } : {}),
      },
      env: {
        jwt_configured: hasJwtSecret,
        github_configured: hasGithub,
        admin_emails_configured: adminEmailsConfigured,
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      },
    });
  } catch (error: any) {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        configured: isDbConfigured(),
        connected: false,
        error: error.message || 'Database check failed',
      },
      env: {
        jwt_configured: false,
        github_configured: false,
        admin_emails_configured: false,
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
      },
    });
  }
}

router.get('/health', handleHealthCheck);

// ==========================================
// Authentication Routes (Public)
// ==========================================

// POST /api/auth/register
// Body: { email, password, name? }
// Hashes password with bcrypt.hash(password, 12) before storage. Never logs plaintext password.
router.post('/auth/register', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({
        error: 'Invalid or missing "email" address in request body',
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({
        error: 'Invalid "password": password must be a plaintext string with at least 6 characters',
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = typeof name === 'string' && name.trim() !== '' ? name.trim() : null;

    // Hash password with salt rounds = 12
    const passwordHash = await bcrypt.hash(password, 12);

    if (getPool()) {
      try {
        // Check if user already exists
        const checkUser = await query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
        if (checkUser.rows.length > 0) {
          res.status(409).json({
            error: 'An account with this email address already exists',
          });
          return;
        }

        const insertQuery = `
          INSERT INTO users (email, password_hash, name, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          RETURNING id, email, name, github_connected, github_connected_at, created_at, updated_at;
        `;
        const result = await query(insertQuery, [cleanEmail, passwordHash, cleanName]);
        const user = result.rows[0];

        const token = generateToken(user.id);

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          user,
          token,
        });
        return;
      } catch (dbErr: any) {
        if (dbErr.code === '23505') {
          // unique_violation
          res.status(409).json({
            error: 'An account with this email address already exists',
          });
          return;
        }
        console.warn('Postgres query failed during register, falling back to memory store:', dbErr.message);
      }
    }

    // In-memory fallback
    const existing = memoryUsers.find((u) => u.email === cleanEmail);
    if (existing) {
      res.status(409).json({
        error: 'An account with this email address already exists',
      });
      return;
    }

    const now = new Date().toISOString();
    const newUser: MemoryUser = {
      id: nextUserId++,
      email: cleanEmail,
      password_hash: passwordHash,
      name: cleanName,
      github_connected: false,
      github_connected_at: null,
      created_at: now,
      updated_at: now,
    };
    memoryUsers.push(newUser);

    const token = generateToken(newUser.id);
    const { password_hash, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      message: 'User registered successfully (memory fallback mode)',
      user: safeUser,
      token,
    });
  } catch (error: any) {
    console.error('Error during /api/auth/register:', error.message);
    res.status(500).json({
      error: 'Registration failed due to an internal server error',
    });
  }
});

// POST /api/auth/login
// Body: { email, password }
// Looks up user by email, compares with bcrypt.compare(password, storedHash). Never direct string equality.
router.post('/auth/login', authLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({
        error: 'Email and plaintext password are required',
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    let userRecord: { id: number; email: string; password_hash: string; name: string | null; github_connected?: boolean; github_connected_at?: any; created_at: any; updated_at?: any } | null = null;

    if (getPool()) {
      try {
        const queryRes = await query('SELECT id, email, password_hash, name, github_connected, github_connected_at, created_at, updated_at FROM users WHERE email = $1', [cleanEmail]);
        if (queryRes.rows.length > 0) {
          userRecord = queryRes.rows[0];
        }
      } catch (dbErr: any) {
        console.warn('Postgres query failed during login, checking memory store:', dbErr.message);
      }
    }

    if (!userRecord) {
      const memoryMatch = memoryUsers.find((u) => u.email === cleanEmail);
      if (memoryMatch) {
        userRecord = memoryMatch;
      }
    }

    if (!userRecord) {
      res.status(401).json({
        error: 'Invalid email or password',
      });
      return;
    }

    // Constant-time hash comparison via bcrypt.compare
    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      res.status(401).json({
        error: 'Invalid email or password',
      });
      return;
    }

    const token = generateToken(userRecord.id);

    const safeUser = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      github_connected: Boolean(userRecord.github_connected),
      github_connected_at: userRecord.github_connected_at || null,
      created_at: userRecord.created_at,
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: safeUser,
      token,
    });
  } catch (error: any) {
    console.error('Error during /api/auth/login:', error.message);
    res.status(500).json({
      error: 'Login failed due to an internal server error',
    });
  }
});

// GET /api/auth/me (Protected: get currently authenticated user profile)
router.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    if (getPool()) {
      try {
        const result = await query(
          'SELECT id, email, name, github_connected, github_connected_at, created_at, updated_at FROM users WHERE id = $1',
          [userId]
        );
        if (result.rows.length > 0) {
          res.status(200).json({
            success: true,
            user: result.rows[0],
          });
          return;
        }
      } catch (dbErr: any) {
        console.warn('Postgres query error in /auth/me:', dbErr.message);
      }
    }

    const memoryUser = memoryUsers.find((u) => u.id === userId);
    if (memoryUser) {
      const { password_hash, ...safeUser } = memoryUser;
      res.status(200).json({
        success: true,
        user: safeUser,
      });
      return;
    }

    res.status(404).json({
      error: 'User not found',
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'Failed to fetch user profile',
    });
  }
});

// ==========================================
// Device Registration Routes
// ==========================================

// POST /api/devices/register (Public - device onboarding)
// Body: { device_id, fcm_token, app_version, platform }
// Upsert by device_id: insert if new, update fcm_token/last_seen_at if it already exists
router.post('/devices/register', deviceLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { device_id, fcm_token, app_version, platform } = req.body || {};

    if (!device_id || typeof device_id !== 'string') {
      res.status(400).json({
        error: 'Missing required field: "device_id" (UUID string is required)',
      });
      return;
    }

    if (!isValidUuid(device_id.trim())) {
      res.status(400).json({
        error: 'Invalid "device_id": must be a valid UUID format (e.g. 8f3b21c4-729d-4e92-9388-c4491763a890)',
      });
      return;
    }

    if (!fcm_token || typeof fcm_token !== 'string' || fcm_token.trim() === '') {
      res.status(400).json({
        error: 'Missing required field: "fcm_token" (non-empty string is required)',
      });
      return;
    }

    const cleanDeviceId = device_id.trim();
    const cleanFcmToken = fcm_token.trim();
    const cleanAppVersion = typeof app_version === 'string' && app_version.trim() !== '' ? app_version.trim() : null;
    const cleanPlatform = typeof platform === 'string' && platform.trim() !== '' ? platform.trim() : 'android';

    if (getPool()) {
      try {
        const upsertQuery = `
          INSERT INTO device_registrations (device_id, fcm_token, app_version, platform, last_seen_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (device_id)
          DO UPDATE SET
              fcm_token = EXCLUDED.fcm_token,
              app_version = COALESCE(EXCLUDED.app_version, device_registrations.app_version),
              platform = COALESCE(EXCLUDED.platform, device_registrations.platform),
              last_seen_at = NOW()
          RETURNING *;
        `;

        const result = await query(upsertQuery, [
          cleanDeviceId,
          cleanFcmToken,
          cleanAppVersion,
          cleanPlatform,
        ]);

        res.status(200).json({
          success: true,
          message: 'Device registration saved to PostgreSQL',
          storage: 'neon_postgres',
          device: result.rows[0],
        });
        return;
      } catch (dbErr: any) {
        console.warn('Postgres query failed, falling back to memory state:', dbErr.message);
      }
    }

    // In-memory upsert fallback
    const existingIndex = memoryDevices.findIndex((d) => d.device_id.toLowerCase() === cleanDeviceId.toLowerCase());
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      memoryDevices[existingIndex].fcm_token = cleanFcmToken;
      if (cleanAppVersion) memoryDevices[existingIndex].app_version = cleanAppVersion;
      if (cleanPlatform) memoryDevices[existingIndex].platform = cleanPlatform;
      memoryDevices[existingIndex].last_seen_at = now;

      res.status(200).json({
        success: true,
        message: 'Device registration updated (memory mode)',
        storage: 'memory_fallback',
        device: memoryDevices[existingIndex],
      });
      return;
    }

    const newDevice: MemoryDevice = {
      id: nextDeviceId++,
      device_id: cleanDeviceId,
      fcm_token: cleanFcmToken,
      user_id: null,
      platform: cleanPlatform,
      app_version: cleanAppVersion,
      installed_at: now,
      last_seen_at: now,
    };

    memoryDevices.unshift(newDevice);

    res.status(200).json({
      success: true,
      message: 'Device registration created (memory mode)',
      storage: 'memory_fallback',
      device: newDevice,
    });
  } catch (error: any) {
    console.error('Error in /api/devices/register:', error);
    res.status(500).json({
      error: error.message || 'Internal Server Error during device registration',
    });
  }
});

// POST /api/devices/link-user (PROTECTED by JWT authenticateToken)
// Body: { device_id } (uses req.userId from the verified JWT token as the actual identity)
router.post(
  '/devices/link-user',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { device_id } = req.body || {};
      const authenticatedUserId = req.userId!; // Guaranteed by authenticateToken middleware

      if (!device_id || typeof device_id !== 'string') {
        res.status(400).json({
          error: 'Missing required field: "device_id" (UUID string is required)',
        });
        return;
      }

      if (!isValidUuid(device_id.trim())) {
        res.status(400).json({
          error: 'Invalid "device_id": must be a valid UUID format',
        });
        return;
      }

      const cleanDeviceId = device_id.trim();

      if (getPool()) {
        try {
          const updateQuery = `
            UPDATE device_registrations
            SET user_id = $2, last_seen_at = NOW()
            WHERE device_id = $1
            RETURNING *;
          `;

          const result = await query(updateQuery, [cleanDeviceId, authenticatedUserId]);

          if (result.rowCount === 0) {
            res.status(404).json({
              error: `Device not found with device_id: ${cleanDeviceId}`,
            });
            return;
          }

          res.status(200).json({
            success: true,
            message: 'User linked to device successfully in PostgreSQL',
            storage: 'neon_postgres',
            device: result.rows[0],
            authenticated_user_id: authenticatedUserId,
          });
          return;
        } catch (dbErr: any) {
          console.warn('Postgres query failed, falling back to memory state:', dbErr.message);
        }
      }

      // Memory fallback
      const target = memoryDevices.find((d) => d.device_id.toLowerCase() === cleanDeviceId.toLowerCase());
      if (!target) {
        res.status(404).json({
          error: `Device not found with device_id: ${cleanDeviceId}`,
        });
        return;
      }

      target.user_id = authenticatedUserId;
      target.last_seen_at = new Date().toISOString();

      res.status(200).json({
        success: true,
        message: 'User linked to device successfully (memory mode)',
        storage: 'memory_fallback',
        device: target,
        authenticated_user_id: authenticatedUserId,
      });
    } catch (error: any) {
      console.error('Error in /api/devices/link-user:', error);
      res.status(500).json({
        error: error.message || 'Internal Server Error during user link',
      });
    }
  }
);

// GET /api/devices (List devices for developer inspect/dashboard)
router.get('/devices', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (getPool()) {
      try {
        const listQuery = `
          SELECT id, device_id, fcm_token, user_id, platform, app_version, installed_at, last_seen_at
          FROM device_registrations
          ORDER BY last_seen_at DESC
          LIMIT 50;
        `;
        const result = await query(listQuery);
        res.status(200).json({
          success: true,
          storage: 'neon_postgres',
          count: result.rowCount,
          devices: result.rows,
        });
        return;
      } catch (dbErr: any) {
        console.warn('Postgres query failed, returning memory list:', dbErr.message);
      }
    }

    res.status(200).json({
      success: true,
      storage: 'memory_fallback',
      count: memoryDevices.length,
      devices: memoryDevices,
      database_configured: isDbConfigured(),
    });
  } catch (error: any) {
    res.status(200).json({
      success: true,
      storage: 'memory_fallback',
      count: memoryDevices.length,
      devices: memoryDevices,
      error: error.message,
    });
  }
});

// GET /api/extensions/icons (Query extension icons table)
router.get('/extensions/icons', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (getPool()) {
      try {
        const iconsQuery = `
          SELECT extension_id, icon_url, updated_at
          FROM extension_icons
          ORDER BY updated_at DESC;
        `;
        const result = await query(iconsQuery);
        res.status(200).json({
          success: true,
          storage: 'neon_postgres',
          count: result.rowCount,
          icons: result.rows,
        });
        return;
      } catch (dbErr: any) {
        console.warn('extension_icons query failed:', dbErr.message);
      }
    }

    res.status(200).json({
      success: true,
      storage: 'unavailable',
      count: 0,
      icons: [],
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Projects Routes (PROTECTED by JWT authenticateToken)
// ==========================================

// POST /api/projects/save (Protected)
// Body: { project_id, name, data? }
// Uses req.userId from the verified token as the owner.
router.post(
  '/projects/save',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authenticatedUserId = req.userId!;
      const { project_id, name, data } = req.body || {};

      if (!project_id || typeof project_id !== 'string' || project_id.trim() === '') {
        res.status(400).json({
          error: 'Missing required field: "project_id" (string is required)',
        });
        return;
      }

      if (!name || typeof name !== 'string' || name.trim() === '') {
        res.status(400).json({
          error: 'Missing required field: "name" (project name string is required)',
        });
        return;
      }

      const cleanProjectId = project_id.trim();
      const cleanName = name.trim();
      const projectData = data !== undefined ? data : null;

      if (getPool()) {
        try {
          const upsertQuery = `
            INSERT INTO projects (user_id, project_id, name, data, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (user_id, project_id)
            DO UPDATE SET
                name = EXCLUDED.name,
                data = EXCLUDED.data,
                updated_at = NOW()
            RETURNING *;
          `;

          const result = await query(upsertQuery, [
            authenticatedUserId,
            cleanProjectId,
            cleanName,
            projectData ? JSON.stringify(projectData) : null,
          ]);

          res.status(200).json({
            success: true,
            message: 'Project saved successfully in PostgreSQL',
            storage: 'neon_postgres',
            project: result.rows[0],
          });
          return;
        } catch (dbErr: any) {
          console.warn('Postgres save project failed, falling back to memory store:', dbErr.message);
        }
      }

      // Memory fallback
      const existingIdx = memoryProjects.findIndex(
        (p) => p.user_id === authenticatedUserId && p.project_id === cleanProjectId
      );
      const now = new Date().toISOString();

      if (existingIdx >= 0) {
        memoryProjects[existingIdx].name = cleanName;
        memoryProjects[existingIdx].data = projectData;
        memoryProjects[existingIdx].updated_at = now;

        res.status(200).json({
          success: true,
          message: 'Project updated successfully (memory mode)',
          storage: 'memory_fallback',
          project: memoryProjects[existingIdx],
        });
        return;
      }

      const newProject: MemoryProject = {
        id: nextProjectId++,
        user_id: authenticatedUserId,
        project_id: cleanProjectId,
        name: cleanName,
        data: projectData,
        created_at: now,
        updated_at: now,
      };

      memoryProjects.unshift(newProject);

      res.status(200).json({
        success: true,
        message: 'Project created successfully (memory mode)',
        storage: 'memory_fallback',
        project: newProject,
      });
    } catch (error: any) {
      console.error('Error in /api/projects/save:', error);
      res.status(500).json({
        error: error.message || 'Internal Server Error while saving project',
      });
    }
  }
);

// GET /api/projects/user/:userId (Protected)
// Enforces req.userId as identity to prevent cross-user data leaks
router.get(
  '/projects/user/:userId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authenticatedUserId = req.userId!;
      const requestedUserId = parseInt(req.params.userId, 10);

      // Validate URL param against verified token identity
      if (!isNaN(requestedUserId) && requestedUserId !== authenticatedUserId) {
        res.status(403).json({
          error: 'Forbidden: You cannot access projects belonging to another user',
          authenticated_user_id: authenticatedUserId,
        });
        return;
      }

      if (getPool()) {
        try {
          const listQuery = `
            SELECT id, user_id, project_id, name, data, created_at, updated_at
            FROM projects
            WHERE user_id = $1
            ORDER BY updated_at DESC;
          `;
          const result = await query(listQuery, [authenticatedUserId]);

          res.status(200).json({
            success: true,
            storage: 'neon_postgres',
            user_id: authenticatedUserId,
            count: result.rowCount,
            projects: result.rows,
          });
          return;
        } catch (dbErr: any) {
          console.warn('Postgres fetch projects failed, falling back to memory store:', dbErr.message);
        }
      }

      // Memory fallback
      const userProjects = memoryProjects.filter((p) => p.user_id === authenticatedUserId);

      res.status(200).json({
        success: true,
        storage: 'memory_fallback',
        user_id: authenticatedUserId,
        count: userProjects.length,
        projects: userProjects,
      });
    } catch (error: any) {
      console.error('Error in GET /api/projects/user/:userId:', error);
      res.status(500).json({
        error: error.message || 'Failed to fetch user projects',
      });
    }
  }
);

// DELETE /api/projects/:userId/:projectId (Protected)
// Enforces req.userId as identity to prevent cross-user project deletions
router.delete(
  '/projects/:userId/:projectId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authenticatedUserId = req.userId!;
      const requestedUserId = parseInt(req.params.userId, 10);
      const projectId = req.params.projectId;

      // Validate URL param against verified token identity
      if (!isNaN(requestedUserId) && requestedUserId !== authenticatedUserId) {
        res.status(403).json({
          error: 'Forbidden: You cannot delete projects belonging to another user',
          authenticated_user_id: authenticatedUserId,
        });
        return;
      }

      if (!projectId || projectId.trim() === '') {
        res.status(400).json({
          error: 'Missing required parameter: projectId',
        });
        return;
      }

      const cleanProjectId = projectId.trim();

      if (getPool()) {
        try {
          const deleteQuery = `
            DELETE FROM projects
            WHERE user_id = $1 AND project_id = $2
            RETURNING id, project_id, name;
          `;
          const result = await query(deleteQuery, [authenticatedUserId, cleanProjectId]);

          if (result.rowCount === 0) {
            res.status(404).json({
              error: `Project "${cleanProjectId}" not found for this user`,
            });
            return;
          }

          res.status(200).json({
            success: true,
            message: `Project "${cleanProjectId}" deleted successfully`,
            deleted_project: result.rows[0],
          });
          return;
        } catch (dbErr: any) {
          console.warn('Postgres delete project failed, falling back to memory store:', dbErr.message);
        }
      }

      // Memory fallback
      const idx = memoryProjects.findIndex(
        (p) => p.user_id === authenticatedUserId && p.project_id === cleanProjectId
      );

      if (idx === -1) {
        res.status(404).json({
          error: `Project "${cleanProjectId}" not found for this user`,
        });
        return;
      }

      const deleted = memoryProjects.splice(idx, 1)[0];

      res.status(200).json({
        success: true,
        message: `Project "${cleanProjectId}" deleted successfully (memory mode)`,
        deleted_project: deleted,
      });
    } catch (error: any) {
      console.error('Error in DELETE /api/projects/:userId/:projectId:', error);
      res.status(500).json({
        error: error.message || 'Failed to delete project',
      });
    }
  }
);

// ==========================================
// GitHub OAuth Code Exchange (Public)
// ==========================================
// POST /api/github/exchange-token
// Body: { code }
// Calls GitHub's https://github.com/login/oauth/access_token with client_id and client_secret
// Returns { access_token } on success, or { error } message on failure — NEVER exposes client secret
router.post('/github/exchange-token', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code } = req.body || {};

    if (!code || typeof code !== 'string' || code.trim() === '') {
      res.status(400).json({
        error: 'Missing required field: "code" (OAuth authorization code from GitHub)',
      });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId.includes('your_') || clientSecret.includes('your_')) {
      res.status(400).json({
        error: 'GitHub OAuth credentials (GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET) are not configured in environment variables.',
      });
      return;
    }

    const cleanCode = code.trim();

    const githubResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Node-Express-Neon-Device-Backend',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: cleanCode,
      }),
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      console.error('GitHub token exchange HTTP error:', githubResponse.status, errorText);
      res.status(githubResponse.status).json({
        error: `GitHub OAuth server returned HTTP ${githubResponse.status}`,
      });
      return;
    }

    const data: any = await githubResponse.json();

    if (data.error) {
      res.status(400).json({
        error: data.error_description || data.error || 'GitHub token exchange failed',
        error_code: data.error,
      });
      return;
    }

    if (!data.access_token) {
      res.status(400).json({
        error: 'No access token returned by GitHub. The authorization code may have expired or is invalid.',
      });
      return;
    }

    // Return access_token, token_type, scope safely without exposing client_secret
    res.status(200).json({
      access_token: data.access_token,
      token_type: data.token_type || 'bearer',
      scope: data.scope || '',
    });
  } catch (error: any) {
    console.error('Error in /api/github/exchange-token:', error);
    res.status(500).json({
      error: error.message || 'Internal server error during GitHub token exchange',
    });
  }
});

// ==========================================
// Analytics Tracking & GitHub Status Routes
// ==========================================

// POST /api/analytics/language-event
// Body: { device_id, language, action? }  action defaults to 'open'
router.post('/analytics/language-event', deviceLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { device_id, language, action } = req.body || {};
    if (!device_id || typeof device_id !== 'string' || !isValidUuid(device_id.trim())) {
      res.status(400).json({ error: 'Missing or invalid "device_id" (UUID required)' });
      return;
    }
    if (!language || typeof language !== 'string' || language.trim() === '') {
      res.status(400).json({ error: 'Missing required field: "language"' });
      return;
    }
    const cleanLang = language.trim().toLowerCase();
    const cleanAction = typeof action === 'string' && action.trim() !== '' ? action.trim() : 'open';
    const userId = req.userId ?? null;

    if (getPool()) {
      try {
        await query(
          'INSERT INTO language_events (device_id, user_id, language, action) VALUES ($1, $2, $3, $4)',
          [device_id.trim(), userId, cleanLang, cleanAction]
        );
        res.status(200).json({ success: true, storage: 'neon_postgres' });
        return;
      } catch (dbErr: any) {
        console.warn('Postgres insert language_events failed, using memory:', dbErr.message);
      }
    }
    memoryLanguageEvents.push({
      id: nextLangEventId++, device_id: device_id.trim(), user_id: userId,
      language: cleanLang, action: cleanAction, created_at: new Date().toISOString(),
    });
    res.status(200).json({ success: true, storage: 'memory_fallback' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to log language event' });
  }
});

// POST /api/analytics/extension-install
// Body: { device_id, extension_id, extension_name? }
router.post('/analytics/extension-install', deviceLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { device_id, extension_id, extension_name } = req.body || {};
    if (!device_id || typeof device_id !== 'string' || !isValidUuid(device_id.trim())) {
      res.status(400).json({ error: 'Missing or invalid "device_id" (UUID required)' });
      return;
    }
    if (!extension_id || typeof extension_id !== 'string' || extension_id.trim() === '') {
      res.status(400).json({ error: 'Missing required field: "extension_id"' });
      return;
    }
    const cleanExtId = extension_id.trim();
    const cleanExtName = typeof extension_name === 'string' && extension_name.trim() !== '' ? extension_name.trim() : null;
    const userId = req.userId ?? null;

    if (getPool()) {
      try {
        await query(
          'INSERT INTO extension_install_events (device_id, user_id, extension_id, extension_name) VALUES ($1, $2, $3, $4)',
          [device_id.trim(), userId, cleanExtId, cleanExtName]
        );
        res.status(200).json({ success: true, storage: 'neon_postgres' });
        return;
      } catch (dbErr: any) {
        console.warn('Postgres insert extension_install_events failed, using memory:', dbErr.message);
      }
    }
    memoryExtensionEvents.push({
      id: nextExtEventId++, device_id: device_id.trim(), user_id: userId,
      extension_id: cleanExtId, extension_name: cleanExtName, created_at: new Date().toISOString(),
    });
    res.status(200).json({ success: true, storage: 'memory_fallback' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to log extension install event' });
  }
});

// POST /api/github/mark-connected (Protected)
// Called by the app right after a successful GitHub token exchange + use.
router.post('/github/mark-connected', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.userId!;
    if (getPool()) {
      try {
        await query(
          'UPDATE users SET github_connected = TRUE, github_connected_at = NOW() WHERE id = $1',
          [authenticatedUserId]
        );
        res.status(200).json({ success: true, storage: 'neon_postgres' });
        return;
      } catch (dbErr: any) {
        console.warn('Postgres update github_connected failed, using memory:', dbErr.message);
      }
    }
    const memUser = memoryUsers.find(u => u.id === authenticatedUserId);
    if (memUser) {
      memUser.github_connected = true;
      memUser.github_connected_at = new Date().toISOString();
    }
    res.status(200).json({ success: true, storage: 'memory_fallback' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to mark GitHub connected' });
  }
});

// GET /api/admin/dashboard (Protected + admin-only)
router.get('/admin/dashboard', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authenticatedUserId = req.userId!;
    if (!(await isAdminUser(authenticatedUserId))) {
      res.status(403).json({ error: 'Forbidden: this account is not in ADMIN_EMAILS' });
      return;
    }

    if (getPool()) {
      try {
        const [totalUsers, totalInstalls, githubConnected, activeNow, active24h, topLangs, topExts] = await Promise.all([
          query('SELECT COUNT(*)::int AS c FROM users'),
          query('SELECT COUNT(*)::int AS c FROM device_registrations'),
          query('SELECT COUNT(*)::int AS c FROM users WHERE github_connected = TRUE'),
          query("SELECT COUNT(*)::int AS c FROM device_registrations WHERE last_seen_at > NOW() - INTERVAL '5 minutes'"),
          query("SELECT COUNT(*)::int AS c FROM device_registrations WHERE last_seen_at > NOW() - INTERVAL '24 hours'"),
          query('SELECT language, COUNT(*)::int AS count FROM language_events GROUP BY language ORDER BY count DESC LIMIT 10'),
          query('SELECT extension_id, MAX(extension_name) AS extension_name, COUNT(*)::int AS count FROM extension_install_events GROUP BY extension_id ORDER BY count DESC LIMIT 10'),
        ]);

        res.status(200).json({
          success: true,
          storage: 'neon_postgres',
          generated_at: new Date().toISOString(),
          totals: {
            total_users: totalUsers.rows[0].c,
            cloud_signed_in_users: totalUsers.rows[0].c,
            total_installs: totalInstalls.rows[0].c,
            github_connected_users: githubConnected.rows[0].c,
            active_now: activeNow.rows[0].c,
            active_24h: active24h.rows[0].c,
          },
          top_languages: topLangs.rows,
          top_extensions: topExts.rows,
        });
        return;
      } catch (dbErr: any) {
        console.warn('Postgres admin dashboard query failed, using memory:', dbErr.message);
      }
    }

    // Memory fallback
    const now = Date.now();
    const activeNowCount = memoryDevices.filter(d => now - new Date(d.last_seen_at).getTime() < 5 * 60 * 1000).length;
    const active24hCount = memoryDevices.filter(d => now - new Date(d.last_seen_at).getTime() < 24 * 60 * 60 * 1000).length;
    const langCounts: Record<string, number> = {};
    memoryLanguageEvents.forEach(e => { langCounts[e.language] = (langCounts[e.language] || 0) + 1; });
    const extCounts: Record<string, { name: string | null; count: number }> = {};
    memoryExtensionEvents.forEach(e => {
      if (!extCounts[e.extension_id]) extCounts[e.extension_id] = { name: e.extension_name, count: 0 };
      extCounts[e.extension_id].count++;
    });

    res.status(200).json({
      success: true,
      storage: 'memory_fallback',
      generated_at: new Date().toISOString(),
      totals: {
        total_users: memoryUsers.length,
        cloud_signed_in_users: memoryUsers.length,
        total_installs: memoryDevices.length,
        github_connected_users: memoryUsers.filter(u => u.github_connected).length,
        active_now: activeNowCount,
        active_24h: active24hCount,
      },
      top_languages: Object.entries(langCounts).map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count).slice(0, 10),
      top_extensions: Object.entries(extCounts).map(([extension_id, v]) => ({ extension_id, extension_name: v.name, count: v.count })).sort((a, b) => b.count - a.count).slice(0, 10),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to build admin dashboard' });
  }
});

export default router;
