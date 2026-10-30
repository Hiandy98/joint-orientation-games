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
    // 根目錄
    this.router.get('/', (c) => c.redirect('/api/frontend/stage1/'))

    // 自動補斜線
    this.router.get('/stage1', (c) => c.redirect('/api/frontend/stage1/'))
    this.router.get('/stage2', (c) => c.redirect('/api/frontend/stage2/'))
    this.router.get('/stage3', (c) => c.redirect('/api/frontend/stage3/'))

    // 目錄首頁 (直接用 path 指定實體位置)
    this.router.get('/stage1/', serveStatic({ path: './public/stage1/index.html' }))
    this.router.get('/stage2/', serveStatic({ path: './public/stage2/index.html' }))
    this.router.get('/stage3/', serveStatic({ path: './public/stage3/index.html' }))

    // 處理資料夾下的靜態資源
    this.router.get('/stage1/*', serveStatic({ 
      root: './public', 
      rewriteRequestPath: (path) => path.replace('/api/frontend', '') 
    }))
    
    this.router.get('/stage2/*', serveStatic({ 
      root: './public', 
      rewriteRequestPath: (path) => path.replace('/api/frontend', '') 
    }))
    
    this.router.get('/stage3/*', serveStatic({ 
      root: './public', 
      rewriteRequestPath: (path) => path.replace('/api/frontend', '') 
    }))
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('Frontend: onReady')
  }
}