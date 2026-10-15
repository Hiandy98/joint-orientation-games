import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { GroupPoint } from '../../contracts/GroupPoint.js'


class GroupPointImpl implements GroupPoint {
    private points: Array<number> = [0,0,0,0]

    updatePoint(group: number, update: number): void {
        if(!Number.isInteger(group) || group < 0 || group >= this.points.length){
            return
        }
        this.points[group] += update
    }

    getPoint(group: number): number {
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
        const grouppoint = new GroupPointImpl()

        this.registerService(
            'grouppoint',
            grouppoint satisfies GroupPoint
        )
    }

    protected override setupRoutes(): void {
        
    }
}