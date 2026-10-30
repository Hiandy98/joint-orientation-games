import { pgTable, integer, jsonb } from 'drizzle-orm/pg-core'

export const warnShellProgressTable = pgTable('warn_shell_progress', {
  groupId: integer('group_id').primaryKey(),
  milestones: jsonb('milestones').notNull().default([]), 
  penaltyPoints: integer('penalty_points').notNull().default(0),
})