import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { GroupPoint } from '../../contracts/GroupPoint.js'

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