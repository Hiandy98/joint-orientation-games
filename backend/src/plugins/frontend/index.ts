import { serveStatic } from '@hono/node-server/serve-static'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { BasePlugin } from '../../contracts/BasePlugin.js'
import type { Context } from 'hono'

export default class FrontendPlugin extends BasePlugin {
  public static override readonly pluginId = 'frontend'
  public static override readonly pluginName = 'Frontend (Static)'
  public static override readonly dependsOn: string[] = []

  protected override async onInit(): Promise<void> {
    this.ctx.log.info('Frontend: onInit')
  }

  protected override setupRoutes(): void {
    // ── 頁面轉址 ──
    this.router.get('/', (c) => c.redirect('/api/frontend/login/'))
    this.router.get('/login', (c) => c.redirect('/api/frontend/login/'))
    this.router.get('/verify', (c) => c.redirect('/api/frontend/verify/'))
    this.router.get('/stage1', (c) => c.redirect('/api/frontend/stage1/'))
    this.router.get('/stage2', (c) => c.redirect('/api/frontend/stage2/'))
    this.router.get('/stage3', (c) => c.redirect('/api/frontend/stage3/'))
    this.router.get('/status', (c) => c.redirect('/api/frontend/status/'))

    // ── 靜態頁面 ──
    this.router.get('/login/', serveStatic({ path: './public/login/index.html' }))
    this.router.get('/verify/', serveStatic({ path: './public/verify/index.html' }))
    this.router.get('/stage1/', serveStatic({ path: './public/stage1/index.html' }))
    this.router.get('/stage2/', serveStatic({ path: './public/stage2/index.html' }))
    this.router.get('/stage3/', serveStatic({ path: './public/stage3/index.html' }))
    this.router.get('/status/', serveStatic({ path: './public/status/index.html' }))

    // ── 靜態資源 (css, js 等) ──
    this.router.get('/login/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))
    this.router.get('/verify/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))
    this.router.get('/stage1/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))
    this.router.get('/stage2/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))
    this.router.get('/stage3/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))
    this.router.get('/status/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))

    // ── 登入 API ──
    // POST /api/frontend/api/login
    this.router.post('/api/login', async (c: Context) => {
      const body = await c.req.json<{ groupId?: string }>().catch(() => ({} as { groupId?: string }))
      const groupId = body.groupId

      if (!groupId || !['0', '1', '2'].includes(groupId)) {
        return c.json({ error: 'Invalid group' }, 400)
      }

      // 設置 HttpOnly Cookie (前端 JS 無法讀取，防篡改)
      setCookie(c, 'playerGroup', groupId, {
        httpOnly: true,
        path: '/',
        maxAge: 86400 * 7, // 7 天有效
        sameSite: 'Strict',
      })

      return c.json({ success: true, groupId })
    })

    // ── 檢查身份 API ──
    // GET /api/frontend/api/me
    this.router.get('/api/me', (c: Context) => {
      const group = getCookie(c, 'playerGroup')
      if (!group) {
        return c.json({ error: 'Not logged in' }, 401)
      }
      return c.json({ groupId: group })
    })

    // ── 登出 API ──
    // POST /api/frontend/api/logout
    this.router.post('/flush/cache', (c) => {
      deleteCookie(c, 'playerGroup', { path: '/' })
      return c.json({ status: 'test_completed', reset: true })
    })
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('Frontend: onReady')
  }
}