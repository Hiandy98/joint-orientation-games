import { BasePlugin } from '../../contracts/BasePlugin.js'
import type { PositionChecker } from './contracts/PositionChecker.js'
import { getCookie } from 'hono/cookie'

const positionDict = new Map<string, number>([
  ['0,0', 1],
  ['-1,-1', 2],
  ['-3,1', 3], 
  ['0,4', 4],
  ['5 -1', 5],
  ['-3,-9', 6]
])

class PositionCheckerImpl implements PositionChecker {
  checkPosition(x: number, y: number): number | undefined {
    const key = `${x},${y}`
    return positionDict.get(key)
  }
}

export default class PositionCheckerPlugin extends BasePlugin {
  public static override readonly pluginId = 'positionchecker'
  public static override readonly pluginName = 'Position Checker Plugin'
  public static override readonly dependsOn: string[] = []

  protected override async onInit(): Promise<void> {
    const checker = new PositionCheckerImpl()

    this.registerService(
      'positionchecker',
      checker satisfies PositionChecker
    )
    
    this.ctx.log.info('PositionChecker: onInit')
  }

  protected override setupRoutes(): void {
    this.router.post('/check', async (c) => {
      const body = await c.req.json<{ x?: unknown; y?: unknown }>()

      if (typeof body?.x !== 'number' || typeof body?.y !== 'number') {
        return c.json({ error: 'x and y must be numbers' }, 400)
      }

      const groupStr = getCookie(c, 'playerGroup');
      if (!groupStr) {
        return c.json({ error: 'Unauthorized: Please login first' }, 401);
      }
      const groupId = parseInt(groupStr, 10);

      const checker = this.getService<PositionChecker>('positionchecker')
      const result = checker?.checkPosition(body.x, body.y)

      if (result === undefined) {
        this.emitEvent('point:update', {groupId, points: -10 })
        return c.json({ exists: false, value: null })
      } else {
        return c.json({ exists: true, value: result })
      }
    })
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('PositionChecker: onReady')
  }
}