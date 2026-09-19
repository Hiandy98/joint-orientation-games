import { createMiddleware } from "hono/factory";
import pino, {type Logger} from "pino";

import { config } from "./config.js";

const getTransport = (env: string) => {
  switch (env) {
    case 'development': 
      return { target: "pino-pretty", options: { colorize: true } };
    default: 
      return undefined;
  }
};

export const baseLogger = pino({
  level: config.LOG_LEVEL,
  transport: getTransport(config.NODE_ENV)
})

type LoggerEnv = {
  Variables: {
    logger: Logger;
  }
};

export const loggerMiddleware = createMiddleware<LoggerEnv>(
  async (c, next) => {
    const reqLogger = baseLogger.child({
      method: c.req.method,
      path: c.req.path,
    });

  c.set('logger', reqLogger);

  await next();
});

