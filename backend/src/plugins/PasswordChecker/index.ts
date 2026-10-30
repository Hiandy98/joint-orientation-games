import { BasePlugin } from '../../contracts/BasePlugin.js'
import type { PasswordChecker } from './contracts/PasswordChecker.js'
import { getCookie } from 'hono/cookie'
import { passwordSolvedTable } from './schema.js'

type Inventory = Record<number, Record<number, string>>;

const passwordList: Inventory = {
    1 : {
        1 : "12 34",
        2 : "56 78"
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
    public static override readonly dependsOn: string[] = ['grouppoint']

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

            if (body?.stage === undefined || body?.area === undefined || body?.password === undefined) {
                return c.json({ error: 'stage, area, and password are required' }, 400);
            }

            const groupStr = getCookie(c, 'playerGroup');
            if (!groupStr) {
                return c.json({ error: 'Unauthorized: Please login first' }, 401);
            }
            const groupId = parseInt(groupStr, 10);

            const checker = this.getService<PasswordChecker>('passwordchecker');
            const isValid = checker?.checkPassword(body.stage, body.area, body.password);

            if (isValid === undefined) {
                return c.json({ error: 'Password not found for given stage and area' }, 404);
            }

            if (!isValid) {
                this.emitEvent('point:update', { groupId, points: -10 });
                return c.json({ valid: false, message: 'Wrong password. -10 points.' });
            }

            const insertResult = await this.db
                .insert(passwordSolvedTable)
                .values({ groupId, stage: body.stage, area: body.area })
                .onConflictDoNothing()
                .returning();

            if (insertResult.length > 0) {
                this.emitEvent('point:update', { groupId, points: 100 });
                return c.json({ valid: true, message: 'Correct! +100 points.', firstTime: true });
            } else {
                return c.json({ valid: true, message: 'Already solved. No points added.', firstTime: false });
            }
        });
    }
}