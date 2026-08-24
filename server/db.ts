import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;
let isInitialized = false;

export function getPool(): pg.Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() === '' || databaseUrl.includes('your_username')) {
    return null;
  }

  if (!pool) {
    const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client:', err.message);
    });
  }

  return pool;
}

export function isDbConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return Boolean(
    databaseUrl &&
    databaseUrl.trim() !== '' &&
    !databaseUrl.includes('ep-sample-123456') &&
    databaseUrl.startsWith('postgres')
  );
}

export async function checkDbConnection(): Promise<{ connected: boolean; error?: string }> {
  const dbPool = getPool();
  if (!dbPool) {
    return {
      connected: false,
      error: process.env.DATABASE_URL
        ? 'DATABASE_URL contains placeholder values'
        : 'DATABASE_URL environment variable is not set',
    };
  }

  try {
    const client = await dbPool.connect();
    try {
      await client.query('SELECT 1');
      return { connected: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Failed to connect to PostgreSQL database',
    };
  }
}

export async function initDatabase(): Promise<{ success: boolean; error?: string }> {
  const dbPool = getPool();
  if (!dbPool) {
    console.warn('⚠️ DATABASE_URL is not configured yet. Running in memory fallback mode.');
    return {
      success: false,
      error: 'DATABASE_URL is not configured. Set DATABASE_URL in .env to connect to Neon PostgreSQL.',
    };
  }

  try {
    const createTablesQuery = `
      -- Users table for authentication
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Device registrations
      CREATE TABLE IF NOT EXISTS device_registrations (
          id SERIAL PRIMARY KEY,
          device_id UUID NOT NULL UNIQUE,
          fcm_token TEXT NOT NULL,
          user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
          platform TEXT DEFAULT 'android',
          app_version TEXT,
          installed_at TIMESTAMPTZ DEFAULT now(),
          last_seen_at TIMESTAMPTZ DEFAULT now()
      );

      -- User projects
      CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          data JSONB NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now(),
          CONSTRAINT uq_user_project UNIQUE (user_id, project_id)
      );
    `;

    const client = await dbPool.connect();
    try {
      await client.query(createTablesQuery);
      isInitialized = true;
      console.log('✅ PostgreSQL: "users", "device_registrations", and "projects" tables verified/created successfully.');
      return { success: true };
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('❌ Failed to initialize database tables:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const dbPool = getPool();
  if (!dbPool) {
    throw new Error(
      'Database is not configured. Please provide a valid DATABASE_URL in your environment variables.'
    );
  }
  return dbPool.query<T>(text, params);
}
