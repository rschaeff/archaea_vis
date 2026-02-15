/**
 * Database connection pool for archaea_vis
 *
 * Connects to ecod_protein database on dione:45000
 * Queries against the archaea schema
 */

import { Pool, QueryResult, QueryResultRow } from 'pg';

const dbConfig = {
  host: process.env.DB_HOST || 'dione',
  port: parseInt(process.env.DB_PORT || '45000'),
  database: process.env.DB_NAME || 'ecod_protein',
  user: process.env.DB_USER || 'ecod',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (!dbConfig.password) {
  throw new Error('DB_PASSWORD environment variable is required. Please set it in your .env.local file.');
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(dbConfig);
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      process.exit(-1);
    });
    console.log(`Database pool created: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  }
  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const pool = getPool();

  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`Slow query (${duration}ms):`, {
        text: text.substring(0, 100),
        rows: res.rowCount,
      });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', {
      error: error instanceof Error ? error.message : String(error),
      query: text.substring(0, 200),
    });
    throw error;
  }
}

export async function getClient() {
  const pool = getPool();
  return await pool.connect();
}

export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now, current_database() as db');
    console.log('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
