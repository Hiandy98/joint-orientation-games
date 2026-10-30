import { BasePlugin } from '../../contracts/BasePlugin.js'
import type { PositionChecker } from './contracts/PositionChecker.js'
import { getCookie } from 'hono/cookie'
import { sql } from 'drizzle-orm'
import { positionPenaltyTable } from './schema.js'

// 👈 你更新後的座標字典
const positionDict = new Map<string, number>([
  ['0,0', 1],
  ['-1,-1', 2],
  ['-3,1', 3], 
  ['0,4', 4],
  ['5,-1', 5],
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
  // 👈 加入 grouppoint 依賴，確保加扣分事件能被接收
  public static override readonly dependsOn: string[] = ['grouppoint']

  private static readonly PENALTY_PER_ERROR = 10

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

      // 👈 1. 寬鬆型別檢查：允許字串或數字，自動轉成 Number
      const x = Number(body?.x)
      const y = Number(body?.y)

      if (isNaN(x) || isNaN(y)) {
        return c.json({ error: 'x and y must be valid numbers' }, 400)
      }

      // 2. 驗證身份 (從 HttpOnly Cookie 取得，無法偽造)
      const groupStr = getCookie(c, 'playerGroup');
      if (!groupStr) {
        return c.json({ error: 'Unauthorized: Please login first' }, 401);
      }
      const groupId = parseInt(groupStr, 10);

      // 3. 查詢座標
      const checker = this.getService<PositionChecker>('positionchecker')
      const result = checker?.checkPosition(x, y)

      // 4. 處理錯誤：寫入 DB 防刷並扣分
      if (result === undefined) {
        // 👈 原子遞增扣分進資料庫 (如果沒有紀錄就新增，有紀錄就累加)
        await this.db
          .insert(positionPenaltyTable)
          .values({ groupId, penaltyPoints: PositionCheckerPlugin.PENALTY_PER_ERROR })
          .onConflictDoUpdate({
            target: positionPenaltyTable.groupId,
            set: {
              penaltyPoints: sql`${positionPenaltyTable.penaltyPoints} + ${PositionCheckerPlugin.PENALTY_PER_ERROR}`
            }
          })

        // 發送扣分事件給 grouppoint
        this.emitEvent('point:update', { groupId, points: -PositionCheckerPlugin.PENALTY_PER_ERROR })

        return c.json({ 
          exists: false, 
          value: null, 
          message: `Invalid position. -${PositionCheckerPlugin.PENALTY_PER_ERROR} points.` 
        })
      }

      // 5. 處理成功
      return c.json({ exists: true, value: result })
    })
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('PositionChecker: onReady')
  }
}