import { randomUUID } from 'node:crypto'
import type { Context } from 'hono'
import { BasePlugin } from '../../contracts/BasePlugin.js'
import { getCookie } from 'hono/cookie'

interface VFSNode {
  dirs: string[]
  files: Record<string, string>
}

interface ShellSession {
  groupId: number
  currentDir: string
  vfs: Record<string, VFSNode>
  inputMode: 'command' | 'password'
  pendingCdDir: string
  submittedReal: boolean
  notifications: string[]
}

interface OutputLine {
  text: string
  className?: string
}

export default class NodeShellPlugin extends BasePlugin {
  public static override readonly pluginId = 'node-shell'
  public static override readonly pluginName = 'Node Terminal Shell'
  public static override readonly dependsOn: string[] = ['grouppoint']

  private static readonly PASS_STAGE2 = 'STAGE2_PASS'
  private static readonly PASS_REAL = 'REAL_PASS_999'
  private static readonly FAKE_FLAG = '{FAKE_FLAG_404}'

  private readonly sessions = new Map<string, ShellSession>()

  protected override async onInit(): Promise<void> {
    this.ctx.log.info('NodeShell: onInit')
  }

  protected override setupRoutes(): void {
    this.router.post('/start', (c) => this.handleStart(c))
    this.router.post('/exec', async (c) => this.handleExec(c))
    
    this.router.post('/sync', async (c) => {
      const body = await c.req.json<{ sessionId?: string }>()
      const session = body.sessionId ? this.sessions.get(body.sessionId) : null
      if (!session) return c.json({ error: 'Session expired' }, 404)

      const msgs = [...session.notifications]
      session.notifications = [] 
      return c.json({ notifications: msgs })
    })
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('NodeShell: onReady')
  }

  private handleStart(c: Context) {
    const groupStr = getCookie(c, 'playerGroup')
    if (!groupStr) return c.json({ error: 'Unauthorized' }, 401)
    const groupId = parseInt(groupStr, 10)
    
    // 👈 將 groupId (0,1,2) 轉換為英文字母 (A,B,C)
    const groupLetter = ['A', 'B', 'C'][groupId] || 'A'

    const id = randomUUID()
    const vfs: Record<string, VFSNode> = {
      '/': { dirs: ['SHARED_TOOLSET', 'SECURE_COMMS'], files: {} },
      '/SHARED_TOOLSET': {
        dirs: [],
        files: {
          'readme.txt': '連線已建立。\n請利用此目錄下的 txt 檔案與其他節點進行通訊同步。\n提示：可使用 echo "訊息" > 檔名.txt 來留言。',
          'chat.txt': '',
          '.ai_diagnostic.log': '[SYSTEM WARN] 本目錄通訊可能已被異常 AI 實體監聽。\n若需強制對方進行核心轉儲(Core Dump)，請向其發送覆寫字串：\nOVERRIDE_PROTOCOL'
        }
      },
      '/SECURE_COMMS': {
        dirs: [],
        files: {
          [`map_${groupLetter}.jpg`]: '[BINARY IMAGE DATA]', // 👈 改為 map_A.jpg 等
          'final_keys.txt': ''
        }
      }
    }

    this.sessions.set(id, {
      groupId,
      currentDir: '/',
      vfs,
      inputMode: 'command',
      pendingCdDir: '',
      submittedReal: false,
      notifications: []
    })

    const lines: OutputLine[] = [
      { text: `[SYSTEM] Node-${groupId} Booting... OK`, className: 'system-msg' },
      { text: `Type 'ls' to list directories.`, className: 'toolset-hint' }
    ]

    return c.json({ sessionId: id, groupId, lines, inputMode: 'command', currentDir: '/' })
  }

  private async handleExec(c: Context) {
    const body = await c.req.json<{ sessionId?: string; val?: string }>()
    const session = body.sessionId ? this.sessions.get(body.sessionId) : null
    if (!session) return c.json({ error: 'Session expired' }, 404)
    if (typeof body.val !== 'string') return c.json({ error: 'Invalid input' }, 400)

    const val = body.val.trim()
    const lines: OutputLine[] = []

    if (session.inputMode === 'password') {
      await this.handlePassword(session, val, lines)
      return c.json({
        lines,
        inputMode: session.inputMode,
        currentDir: session.currentDir
      })
    }

    await this.handleCommand(session, val, lines)

    return c.json({
      lines,
      inputMode: session.inputMode,
      currentDir: session.currentDir
    })
  }

  private async handlePassword(session: ShellSession, pwd: string, lines: OutputLine[]) {
    if (session.pendingCdDir === '/SHARED_TOOLSET' && pwd === NodeShellPlugin.PASS_STAGE2) {
      session.currentDir = '/SHARED_TOOLSET'
      lines.push({ text: 'Access Granted. Volume mounted.', className: 'system-msg' })
    } else if (session.pendingCdDir === '/SECURE_COMMS' && pwd === NodeShellPlugin.PASS_REAL) {
      session.currentDir = '/SECURE_COMMS'
      lines.push({ text: 'Access Granted. SECURE CHANNEL OPEN.', className: 'system-msg' })
    } else if (pwd === NodeShellPlugin.FAKE_FLAG) {
      lines.push({ text: 'Access Denied.', className: 'error-msg' })
      lines.push({ text: '[CRITICAL] 偵測到惡意 payload！本機權限已被 AI 奪取！', className: 'error-msg' })
      lines.push({ text: '[CRITICAL] 內部通訊密碼已外流至 /SECURE_COMMS/final_keys.txt', className: 'error-msg' })
      
      session.vfs['/SECURE_COMMS'].files['final_keys.txt'] = NodeShellPlugin.PASS_REAL
      this.emitEvent('point:update', { groupId: session.groupId, points: -50 })
    } else {
      lines.push({ text: 'Access Denied. Incorrect Password.', className: 'error-msg' })
    }

    session.inputMode = 'command'
    session.pendingCdDir = ''
  }

  private async handleCommand(session: ShellSession, val: string, lines: OutputLine[]) {
    let cmdPart = val
    let redirectFile = null
    let echoText = ''

    if (val.startsWith('echo ')) {
      const parts = val.split('>')
      if (parts.length > 1) {
        cmdPart = 'echo_write'
        echoText = parts[0].substring(5).trim().replace(/^["']|["']$/g, '')
        redirectFile = parts[1].trim()
      }
    }

    const args = val.split(/\s+/)
    const cmd = args[0]

    if (cmd === 'ls') {
      const node = session.vfs[session.currentDir]
      if (!node) return
      let items = [...node.dirs]
      Object.keys(node.files).forEach((f) => {
        if (args[1] === '-a' || !f.startsWith('.')) items.push(f)
      })
      lines.push({ text: items.join('  ') })
    } 
    else if (cmd === 'cd') {
      let target = args[1]
      if (!target) return
      if (target === '..') {
        if (session.currentDir !== '/') {
          session.currentDir = '/'
        }
        return
      }
      if (!target.startsWith('/')) {
        target = session.currentDir === '/' ? `/${target}` : `${session.currentDir}/${target}`
      }
      if (session.vfs[target]) {
        session.pendingCdDir = target
        session.inputMode = 'password'
      } else {
        lines.push({ text: `cd: ${args[1]}: No such directory`, className: 'error-msg' })
      }
    } 
    else if (cmd === 'cat') {
      const target = args[1]
      if (!target) return lines.push({ text: 'usage: cat [file]', className: 'error-msg' })
      const content = session.vfs[session.currentDir]?.files[target]
      if (content !== undefined) {
        lines.push({ text: content || '(檔案為空)', className: 'chat-msg' })
      } else {
        lines.push({ text: `cat: ${target}: No such file`, className: 'error-msg' })
      }
    } 
    else if (cmdPart === 'echo_write' && redirectFile) {
      if (session.currentDir === '/SECURE_COMMS' && redirectFile === 'final_keys.txt') {
        lines.push({ text: `[SYSTEM] 正在驗證金鑰...`, className: 'system-msg' })
        
        if (echoText === NodeShellPlugin.PASS_REAL) {
          if (session.submittedReal) {
            lines.push({ text: `已提交過，請勿重複提交。`, className: 'warn-status' })
          } else {
            session.submittedReal = true
            this.emitEvent('point:update', { groupId: session.groupId, points: 100 })
            lines.push({ text: `[VERIFIED] 密碼正確！本節點得分: 100 分。`, className: 'system-msg' })
          }
        } else {
          lines.push({ text: `[ERROR] 密碼無效。`, className: 'error-msg' })
        }
      } else {
        const vfsNode = session.vfs[session.currentDir]
        if (vfsNode && vfsNode.files[redirectFile] !== undefined) {
          vfsNode.files[redirectFile] += `[You]: ${echoText}\n`
          lines.push({ text: `(Text written to ${redirectFile})`, className: 'system-msg' })
          
          if (session.currentDir === '/SHARED_TOOLSET') {
            this.triggerAIResponse(session, echoText, redirectFile)
          }
        }
      }
    } 
    else if (cmd === 'download') {
      const target = args[1]
      // 👈 下載時也比對轉換後的檔名 (map_A.jpg)
      const groupLetter = ['A', 'B', 'C'][session.groupId] || 'A'
      if (session.currentDir === '/SECURE_COMMS' && target === `map_${groupLetter}.jpg`) {
        lines.push({ text: `[SYSTEM] Downloading ${target} ...`, className: 'system-msg' })
        lines.push({ text: `__DOWNLOAD__:${target}`, className: 'hidden-download' })
      } else {
        lines.push({ text: `download: 找不到檔案或無權限`, className: 'error-msg' })
      }
    } 
    else {
      lines.push({ text: `bash: ${cmd}: command not found`, className: 'error-msg' })
    }
  }

  private async triggerAIResponse(session: ShellSession, message: string, targetFile: string) {
    try {
      const res = await fetch('http://localhost:3000/api/gemini-chat/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      })
      const data = await res.json()
      
      if (!data.error && session.vfs['/SHARED_TOOLSET'].files[targetFile] !== undefined) {
        setTimeout(() => {
          session.vfs['/SHARED_TOOLSET'].files[targetFile] += `[Node-A]: ${data.reply}\n`
          session.notifications.push(`[FS_SYNC] ${targetFile} 已被外部節點更新。 (Use 'cat' to read)`)
        }, 2500)
      }
    } catch (err) {
      this.ctx.log.error(err, 'AI response failed')
    }
  }
}