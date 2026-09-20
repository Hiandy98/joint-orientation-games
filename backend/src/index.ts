import { serve } from "@hono/node-server"
import { Hono } from 'hono'
import { EventEmitter } from "node:events"

import { loggerMiddleware, baseLogger } from './runtime/logger.js'
import { config } from './runtime/config.js'
import { connectDatabase, disconnectDatabase, db } from './runtime/db.js'
import { ServiceRegistry } from './runtime/ServiceRegistry.js'
import { type PluginContext } from './contracts/PluginContext.js'
import { PluginLoader } from './runtime/loader.js'
import { type HonoEnv } from './utils/HonoEnv.js'

const app = new Hono<HonoEnv>();

app.use('*', loggerMiddleware);

// 測試用 之後刪掉
app.get('/', (c) => {
  const log = c.get('logger');

  log.info('Logger Tested');

  return c.text('Hello Hono!');
})

async function bootstrap() {
  baseLogger.info("Starting joint-orientation-games backend")

  const eventBus = new EventEmitter({ captureRejections: true })

  eventBus.on("error", (err) => {
    baseLogger.error(err, "EventBus: Uncaught exception in global event bus")
  })

  await connectDatabase();

  const ctx: PluginContext = {
    services: new ServiceRegistry(baseLogger),
    log: baseLogger,
    bus: eventBus,
    db: db,
  }

  const loader = new PluginLoader(app, ctx)

  await loader.loadFromDir("./dist/plugins")

  const server = serve({
    fetch: app.fetch,
    port: config.PORT
  }, (info) => {
    baseLogger.info(`Server is running on http://localhost:${info.port}`)
  });

  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      baseLogger.warn(`Signal ${signal} ignored; shutdown procedure already in progress.`)
      return;
    }
    isShuttingDown = true;

    baseLogger.warn(`Signal ${signal} received; initiating slow-start procedure...`)

    await server.close()
    await loader.unloadAll()
    await disconnectDatabase()
    
    baseLogger.info('Service has been safely terminated. Goodbye')
    process.exit(0)
  }

  process.on("SIGINT", () => { shutdown("SIGINT") })
  process.on("SIGTERM", () => { shutdown("SIGTERM") })
}

bootstrap().catch((err) => {
  baseLogger.fatal(err, "A critical, fatal error occurred during system startup!!!!!!!!")
  process.exit(1)
})