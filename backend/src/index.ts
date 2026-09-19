import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { loggerMiddleware, baseLogger } from './runtime/logger.js'
import { config } from './runtime/config.js'

type Env = {
  Variables: {
    logger: Logger
  }
}

const app = new Hono<Env>()

app.use('*', loggerMiddleware)

app.get('/', (c) => {
  const log = c.get('logger')

  log.info('Logger Tested')

  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  port: config.PORT
}, (info) => {
  baseLogger.info(`Server is running on http://localhost:${info.port}`)
})
