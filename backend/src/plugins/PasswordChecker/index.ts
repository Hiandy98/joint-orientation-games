import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { PasswordChecker } from './contracts/PasswordChecker.js'

type Inventory = Record<number, Record<number, number>>;

const passwordList: Inventory = {
    0 : {
        0 : 1234,
        1 : 5678
    }
}



class PasswordCheckerImpl implements PasswordChecker {
    getPasswordLength(area: number, level: number): number | undefined {
        const correctPassword = passwordList[area]?.[level];
        if (correctPassword === undefined) {
            return undefined;
        }
        return correctPassword.toString().length;
    }
    
    checkPassword(area: number, level: number, password: number): boolean | undefined {
        const correctPassword = passwordList[area]?.[level];
        if (correctPassword === undefined) {
            return undefined;
        }
        return correctPassword === password;
    }
}



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