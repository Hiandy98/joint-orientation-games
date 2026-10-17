import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { PasswordChecker } from './contracts/PasswordChecker.js'



export default class PasswordCheckerPlugin extends BasePlugin {
    public static override readonly pluginId = 'passwordchecker'
    public static override readonly pluginName = 'passwordchecker Plugin'
    public static override readonly dependsOn: string[] = []

    protected override async onInit(): Promise<void> {
        const passwordchecker = new PasswordCheckerImpl()

        this.registerService(
            'passwordchecker',
            passwordchecker satisfies PasswordChecker
        )
    }

    protected override setupRoutes(): void {
        
    }
}