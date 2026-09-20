import pg from 'pg'
import { config } from './config.js'
import { baseLogger } from './logger.js'
import { drizzle } from 'drizzle-orm/node-postgres'

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  baseLogger.trace("A new async DB client was checked out from the pool");
});

pool.on('error', (err) => {
  baseLogger.error({ err }, "Unexpected error on idle DB client in pool");
});

export const db = drizzle({ client: pool });

export const connectDatabase = async (): Promise<void> => {
  baseLogger.info("Testing asynchronous Drizzle database connection pool...");

  try {
    await pool.query('SELECT 1');
    baseLogger.info("Asynchronous database connection pool health check passed");
  } catch (error) {
    baseLogger.fatal({ error }, "Database connection pool initialization failed; the system is about to shut down");
    process.exit(1);
  }
}

export const disconnectDatabase = async (): Promise<void> => {
  baseLogger.info("Closing asynchronous Drizzle database connection pool...");
  await pool.end();
  baseLogger.info("The database connection pool has been safely shut down");
}