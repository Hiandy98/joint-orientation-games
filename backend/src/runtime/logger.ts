import { createMiddleware } from "hono/factory";
import pino, {type Logger} from "pino";

export const baseLogger = pino({
  transport: {
    target: "pino-pretty",
    options: {colorize: true}
  }
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