import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Logger } from 'pino'

import { loggerMiddleware } from './runtime/logger.js'

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
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
