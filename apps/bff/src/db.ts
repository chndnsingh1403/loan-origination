// Database connection and query utilities
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'originate',
  user: process.env.POSTGRES_USER || 'appuser',
  password: process.env.POSTGRES_PASSWORD || 'apppass',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.connect()
  .then((client: any) => {
    console.log('✅ PostgreSQL connected successfully');
    client.release();
  })
  .catch((err: any) => {
    console.error('❌ PostgreSQL connection failed:', err.message);
  });

export { pool as db };

// Helper function for safe queries with error handling
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', { text: text.substring(0, 100), error });
    throw error;
  }
}

// Helper for transactions
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}