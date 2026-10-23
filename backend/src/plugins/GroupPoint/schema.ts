import { pgTable, integer } from 'drizzle-orm/pg-core'
export const groupPointTable = pgTable('grouppoint_points', {
    groupId: integer('group_id').primaryKey(),
    points: integer('points').notNull().default(0),
})