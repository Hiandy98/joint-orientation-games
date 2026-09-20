import pg from 'pg'
import { config } from './config.js'
import { baseLogger } from './logger.js'


const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

pool.on('connect', () => {
  baseLogger.trace('A new async DB client was checked out from the pool')
})

pool.on('error', (err) => {
  baseLogger.error({ err }, 'Unexpected error on idle DB client in pool')
})

