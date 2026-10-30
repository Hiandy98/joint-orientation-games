import { serveStatic } from '@hono/node-server/serve-static'
import { BasePlugin } from '../../contracts/BasePlugin.js'

export default class FrontendPlugin extends BasePlugin {
  public static override readonly pluginId = 'frontend'
  public static override readonly pluginName = 'Frontend (Static)'
  public static override readonly dependsOn: string[] = []

  protected override async onInit(): Promise<void> {
    this.ctx.log.info('Frontend: onInit')
  }

  protected override setupRoutes(): void {
    // ① 根目錄 → 選關卡頁（或直接導到 stage1）
    this.router.get('/', (c) => c.redirect('/api/frontend/stage1/'))

    // ② 每個 stage 的 index.html
    //    ⚠️ 明確指定，因為 Hono serveStatic 不一定自動找 index.html
    this.router.get('/stage1/', serveStatic({ path: './public/stage1/index.html' }))
    this.router.get('/stage2/', serveStatic({ path: './public/stage2/index.html' }))
    this.router.get('/stage3/', serveStatic({ path: './public/stage3/index.html' }))

    // ③ 每個 stage 底下的所有靜態檔（js / css / 圖片…）
    //    請求 /stage1/style.css → ./public/stage1/style.css
    this.router.use('/stage1/*', serveStatic({ root: './public' }))
    this.router.use('/stage2/*', serveStatic({ root: './public' }))
    this.router.use('/stage3/*', serveStatic({ root: './public' }))
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('Frontend: onReady')
  }
}