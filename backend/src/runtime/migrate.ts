import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { baseLogger } from './logger.js'
import { db } from './db.js'

export async function runMigrations(): Promise<void> {
  baseLogger.info('Running database migrations...')
  try {
    await migrate(db, { migrationsFolder: './drizzle' })
    baseLogger.info('Database migrations completed')
  } catch (err) {
    baseLogger.fatal(err, 'Database migration failed')
    process.exit(1)
  }
}