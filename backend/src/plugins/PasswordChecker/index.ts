import { BasePlugin } from '../../contracts/BasePlugin.js';
import type { PasswordChecker } from './contracts/PasswordChecker.js'

type Inventory = Record<number, Record<number, string>>;

const passwordList: Inventory = {
    1 : {
        1 : "1234",
        2 : "5678"
    }
}



class PasswordCheckerImpl implements PasswordChecker {
    checkPassword(stage: number, area: number, password: string): boolean | undefined {
        const correctPassword = passwordList[stage]?.[area];
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
        this.router.post('/check', async (c) => {
            const body = await c.req.json<{ stage?: number; area?: number; password?: string }>();

            // 1. 檢查必要欄位是否傳遞
            if (body?.stage === undefined || body?.area === undefined || body?.password === undefined) {
                return c.json({ error: 'stage, area, and password are required in request body' }, 400);
            }

            // 2. 從服務註冊表取得服務並執行驗證
            const checker = this.getService<PasswordChecker>('passwordchecker');
            const isValid = checker?.checkPassword(body.stage, body.area, body.password);

            // 3. 檢查該 stage 與 area 是否存在密碼設定
            if (isValid === undefined) {
                return c.json({ error: 'Password not found for given stage and area' }, 404);
            }

            // 4. 回傳驗證結果
            return c.json({ valid: isValid });
        });
    }
}