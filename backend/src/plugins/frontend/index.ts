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
    const S1 = 'c9e5a4b2-1f3d-4a8e-9b7c-5d2e1f0a8b3c'
    const S2 = '7f8a2b1c-4d3e-4f5a-8b9c-1d2e3f4a5b6c'
    const S3 = 'e1d2c3b4-a5f6-4e7d-8c9b-0a1f2e3d4c5b'

    // 根目錄與登入
    this.router.get('/', (c) => c.redirect('/api/frontend/login/'))
    this.router.get('/login', (c) => c.redirect('/api/frontend/login/'))
    this.router.get('/login/', serveStatic({ path: './public/login/index.html' }))
    this.router.get('/login/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))

    // 隊輔驗證頁
    this.router.get('/verify', (c) => c.redirect('/api/frontend/verify/'))
    this.router.get('/verify/', serveStatic({ path: './public/verify/index.html' }))
    this.router.get('/verify/*', serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '') }))

    this.router.get(`/${S1}`, (c) => c.redirect(`/api/frontend/${S1}/`))
    this.router.get(`/${S1}/`, serveStatic({ path: './public/stage1/index.html' }))
    this.router.get(`/${S1}/*`, serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '').replace(S1, 'stage1') }))

    this.router.get(`/${S2}`, (c) => c.redirect(`/api/frontend/${S2}/`))
    this.router.get(`/${S2}/`, serveStatic({ path: './public/stage2/index.html' }))
    this.router.get(`/${S2}/*`, serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '').replace(S2, 'stage2') }))

    this.router.get(`/${S3}`, (c) => c.redirect(`/api/frontend/${S3}/`))
    this.router.get(`/${S3}/`, serveStatic({ path: './public/stage3/index.html' }))
    this.router.get(`/${S3}/*`, serveStatic({ root: './public', rewriteRequestPath: (path) => path.replace('/api/frontend', '').replace(S3, 'stage3') }))
    
    // 狀態頁面
    this.router.get('/status', (c) => c.redirect('/api/frontend/status/'))
    this.router.get('/status/', serveStatic({ path: './public/status/index.html' }))
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