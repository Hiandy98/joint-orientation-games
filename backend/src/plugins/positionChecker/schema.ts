import { pgTable, integer } from 'drizzle-orm/pg-core'

export const positionPenaltyTable = pgTable('position_penalty', {
  groupId: integer('group_id').primaryKey(),
  penaltyPoints: integer('penalty_points').notNull().default(0),
})