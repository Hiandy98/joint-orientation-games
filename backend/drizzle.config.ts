import { defineConfig } from 'drizzle-kit'
import { config } from './src/runtime/config.js'

export default defineConfig({
  dialect: 'postgresql',
  schema: [
    './src/schema/*.ts',
    './src/plugins/*/schema.ts',
  ],
  out: './drizzle',
  dbCredentials: {
    url: config.DATABASE_URL,
  },
})