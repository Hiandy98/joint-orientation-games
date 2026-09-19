import { z } from "zod";

// 說明文件(Zod官網) https://zod.dev/

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info')
})

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:', z.prettifyError(result.error));
  process.exit(1);
}

export const config = result.data;