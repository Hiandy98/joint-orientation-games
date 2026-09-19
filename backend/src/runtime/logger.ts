import { createMiddleware } from "hono/factory";
import { randomUUID } from "node:crypto";
import pino, { type Logger } from "pino";

import { config } from "./config.js";

const getTransport = (env: string): pino.TransportSingleOptions | undefined => {
  switch (env) {
    case 'development':
      return { 
        target: "pino-pretty", 
        options: { 
          colorize: true,
          translateTime: "SYS:standard",
        } 
      };
    default: 
      return undefined;
  }
};

export const baseLogger = pino({
  level: config.LOG_LEVEL,
  transport: getTransport(config.NODE_ENV)
});

type LoggerEnv = {
  Variables: {
    logger: Logger;
  }
};

export const loggerMiddleware = createMiddleware<LoggerEnv>(
  async (c, next) => {
    const requestId = c.req.header("x-request-id") || randomUUID();
  
    c.header("x-request-id", requestId);

    const reqLogger = baseLogger.child({
      requestId,
      method: c.req.method,
      path: c.req.path,
    });

    c.set("logger", reqLogger);

    reqLogger.info({ msg: "Incoming request" });

    const startTime = logIncomingRequest(reqLogger);

    try {
      await next();
    } finally {
      logCompletedRequest(reqLogger, startTime, c.res.status);
    }
  }
);

function logIncomingRequest(log: Logger) {
  log.info({ msg: "Incoming request" });
  return performance.now();
}

function logCompletedRequest(log: Logger, startTime: number, status: number) {
  const duration = (performance.now() - startTime).toFixed(2);
  log.info({
    msg: "Request processed",
    status,
    duration: `${duration}ms`,
  });
}