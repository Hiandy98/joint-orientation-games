import { pgTable, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core'

export const passwordSolvedTable = pgTable('password_solved', {
  groupId: integer('group_id').notNull(),
  stage: integer('stage').notNull(),
  area: integer('area').notNull(),
  solvedAt: timestamp('solved_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.groupId, table.stage, table.area] })
}))