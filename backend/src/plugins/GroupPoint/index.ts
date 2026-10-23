import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { GroupPoint } from './contracts/GroupPoint.js'
import type { PluginContext } from '../../contracts/PluginContext.js'
import { eq, sql } from 'drizzle-orm'


class GroupPointImpl implements GroupPoint {

    constructor(
        private readonly db: PluginContext['db']
    ) {}

    private points: Array<number> = [0,0,0]

    async updatePoint(group: number, update: number): Promise<void> {
        if(!Number.isInteger(group) || group < 0 || group >= this.points.length){
            return
        }
        this.points[group] += update
    }

    async getPoint(group: number): Promise<number> {
        if(!Number.isInteger(group) || group < 0 || group >= this.points.length){
            return 0
        }
        return this.points[group]
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