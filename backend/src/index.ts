import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { loggerMiddleware, baseLogger } from './runtime/logger.js'
import { config } from './runtime/config.js'
import { connectDatabase, disconnectDatabase } from './runtime/db.js'

type Env = {
  Variables: {
    logger: Logger
  }
};

const app = new Hono<Env>();

app.use('*', loggerMiddleware);

// 測試用 之後刪掉
app.get('/', (c) => {
  const log = c.get('logger');

  log.info('Logger Tested');

  return c.text('Hello Hono!');
})

const startServer = async () => {
  await connectDatabase();

  const server = serve({
    fetch: app.fetch,
    port: config.PORT
  }, (info) => {
    baseLogger.info(`Server is running on http://localhost:${info.port}`)
  });

  const shutdown = async (signal: string) => {
    baseLogger.warn(`Signal ${signal} received; initiating slow-start procedure...`)
    
    server.close()
    await disconnectDatabase()
    
    baseLogger.info('Service has been safely terminated. Goodbye')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

startServer()
