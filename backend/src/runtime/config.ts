import { z } from "zod";

// 說明文件(Zod官網) https://zod.dev/

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DB_SCHEME: z.string().default("postgresql"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("password"),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_NAME: z.string().default("game_db"),
  DB_PORT: z.coerce.number().default(5432)
})
.refine((data) => {
  if (data.NODE_ENV === 'production') {
    return data.DB_HOST !== "" && data.DB_USER !== "";
  }
  return true;
}, {
  message: "In the production environment, DB_HOST and DB_USERNAME cannot be empty strings",
})
.transform((data) => {
  const { DB_SCHEME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = data;

  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  const databaseUrl = `${DB_SCHEME}://${auth}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

  return {
    ...data,
    DATABASE_URL: databaseUrl,
  };
});

const result = configSchema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:', z.prettifyError(result.error));
  process.exit(1);
}

export const config = result.data;