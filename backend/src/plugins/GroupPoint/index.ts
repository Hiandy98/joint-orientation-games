import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { GroupPoint } from './contracts/GroupPoint.js'
import type { PluginContext } from '../../contracts/PluginContext.js'
import { eq, sql } from 'drizzle-orm'
import { groupPointTable } from './schema.js'


class GroupPointImpl implements GroupPoint {

    constructor(
        private readonly db: PluginContext['db']
    ) {}

    private points: Array<number> = [0,0,0]

    async updatePoint(group: number, update: number): Promise<void> {
        if(!Number.isInteger(group) || group < 0 || group >= 3){
            return
        }
        await this.db
            .insert(groupPointTable)
            .values({
                groupId: group,
                points: update
            })
            .onConflictDoUpdate({
                target: groupPointTable.groupId,
                set: {
                    points: sql`${groupPointTable.points} + ${update}`
                }
            })
    }

    async getPoint(group: number): Promise<number> {
        if(!Number.isInteger(group) || group < 0 || group >= 3){
            return 0
        }
        const result = await this.db
            .select({ points: groupPointTable.points })
            .from(groupPointTable)
            .where(eq(groupPointTable.groupId, group))
            .limit(1)

        return result[0]?.points ?? 0
    }
}





export default class GroupPointPlugin extends BasePlugin {
    public static override readonly pluginId = 'grouppoint'
    public static override readonly pluginName = 'grouppoint Plugin'
    public static override readonly dependsOn: string[] = []

    protected override async onInit(): Promise<void> {
        const grouppoint = new GroupPointImpl(this.db)

        this.registerService(
            'grouppoint',
            grouppoint satisfies GroupPoint
        )
    }

    protected override setupRoutes(): void {
        
    }
}