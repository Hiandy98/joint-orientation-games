import { randomUUID } from 'node:crypto'
import type { Context } from 'hono'
import { BasePlugin } from '../../contracts/BasePlugin.js'

type Stage = 1 | 2 | 3

interface GameSession {
  stage: Stage
  foundPid: boolean
  decryptedPart1: boolean
  watchdogDeadline: number | null
  gameOver: boolean
  lastActivity: number
}

interface OutputLine {
  text: string
  className?: string
  delay?: number
  console?: boolean
}

export default class WarnShellPlugin extends BasePlugin {
  public static override readonly pluginId = 'warn-shell'
  public static override readonly pluginName = 'WARN Shell Game'
  public static override readonly dependsOn: string[] = []

  private static readonly WATCHDOG_SECONDS = 60
  private readonly sessions = new Map<string, GameSession>()

  // 👈 從環境變數載入的密碼，確保源碼無明文
  private secrets: Record<string, string> = {}

  protected override async onInit(): Promise<void> {
    this.ctx.log.info('WarnShell: onInit')

    // 👈 從 process.env 讀取機密，沒有預設值（避免源碼洩漏）
    this.secrets = {
      fragment1_cipher: process.env.WARN_FRAGMENT1 || '',
      fragment1_plain: process.env.WARN_FRAGMENT1_PLAIN || '',
      full_passkey: process.env.WARN_PASSKEY || '',
      watchdog_pid: process.env.WARN_WATCHDOG_PID || '',
      fragment2_console_msg: process.env.WARN_CONSOLE_MSG || '',
    }

    if (!this.secrets['full_passkey']) {
      this.ctx.log.warn('WarnShell: 警告！環境變數未設定，遊戲將無法正常運作')
    } else {
      this.ctx.log.info('WarnShell: 密碼已從環境變數載入')
    }

    const timer = setInterval(() => this.cleanup(), 5 * 60_000)
    this.trackCleanup(() => clearInterval(timer))
  }

  protected override setupRoutes(): void {
    this.router.post('/start', (c) => this.handleStart(c))
    this.router.post('/cmd', async (c) => this.handleCmd(c))
    this.router.post('/tick', async (c) => this.handleTick(c))
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('WarnShell: onReady')
  }

  // ═════ Handlers ═════

  private handleStart(c: Context) {
    const id = randomUUID()
    this.sessions.set(id, {
      stage: 1, foundPid: false, decryptedPart1: false,
      watchdogDeadline: null, gameOver: false, lastActivity: Date.now(),
    })

    const lines: OutputLine[] = [
      { text: 'Establishing connection to RRY-09 // shell...', className: 'sys-msg' },
      { text: "Connection established. Type <span class='clue-highlight'>help</span> for available commands.\n", className: 'sys-msg' },
      { text: this.warnLine('Hello? Can you read this? My transmission is encoded with ASCII +9!'), className: 'warn-msg', delay: 700 },
      { text: this.warnLine('Check README.txt for clues, but beware of the noise. You might need to write a script to decode everything!'), className: 'warn-msg', delay: 1800 },
      { text: this.asciiPlus9(this.secrets['fragment2_console_msg'] || ''), className: 'console', console: true },
    ]
    return c.json({ sessionId: id, lines })
  }

  private async handleCmd(c: Context) {
    const body = await c.req.json<{ sessionId?: string; cmd?: string }>()
    const session = body.sessionId ? this.sessions.get(body.sessionId) : null
    if (!session) return c.json({ error: 'session not found' }, 404)
    if (typeof body.cmd !== 'string') return c.json({ error: 'cmd required' }, 400)

    session.lastActivity = Date.now()
    const lines = this.dispatch(session, body.cmd)
    return c.json({ lines, state: this.publicState(session) })
  }

  private async handleTick(c: Context) {
    const body = await c.req.json<{ sessionId?: string }>()
    const session = body.sessionId ? this.sessions.get(body.sessionId) : null
    if (!session) return c.json({ error: 'session not found' }, 404)

    const lines = this.checkWatchdog(session)
    return c.json({ lines, state: this.publicState(session) })
  }

  // ═════ 核心邏輯（防作弊狀態機） ═════

  private dispatch(session: GameSession, rawCmd: string): OutputLine[] {
    if (session.gameOver) return []
    const trimmed = rawCmd.trim()
    if (!trimmed) return []

    const watchdog = this.checkWatchdog(session)
    if (session.gameOver) return watchdog

    const args = trimmed.split(/\s+/)
    const cmd = args[0].toLowerCase()
    const lines: OutputLine[] = []

    switch (cmd) {
      case 'help':
        lines.push({ text: this.helpText(session.stage), className: 'sys-msg' })
        break

      case 'ls':
        lines.push({ text: this.getFileList(session).join('    '), className: 'clue-highlight' })
        break

      case 'cat': {
        const name = args[1]
        const content = name ? this.getFileContent(session, name) : null
        if (content === null) {
          lines.push({ text: 'cat: No such file or directory', className: 'err-msg' })
          break
        }
        lines.push({ text: content, className: 'sys-msg' })
        if (name === 'system.log' && !session.foundPid) {
          session.foundPid = true
          lines.push({
            text: this.warnLine(`Found Fragment 1 in system.log: ${this.secrets['fragment1_cipher']}. Use 'decrypt ${this.secrets['fragment1_cipher']}'!`),
            className: 'warn-msg', delay: 400,
          })
        }
        break
      }

      case 'decrypt':
        if (args[1] === this.secrets['fragment1_cipher']) {
          session.decryptedPart1 = true // 👈 標記已解密
          lines.push({ text: `>> Decrypted Fragment 1: <span class='clue-highlight'>${this.secrets['fragment1_plain']}</span>`, className: 'success-msg' })
          lines.push({
            text: this.warnLine(`Great! Now get Fragment 2 from F12 Console (remember it's encrypted with ASCII +9, write a JS loop to decode it!), then 'unlock &lt;passkey&gt;'.`),
            className: 'warn-msg', delay: 400,
          })
        } else {
          lines.push({ text: 'Decryption failed.', className: 'err-msg' })
        }
        break

      case 'unlock':
        if (session.stage !== 1) {
          lines.push({ text: 'unlock: command not available in current stage.', className: 'err-msg' })
          break
        }
        if (!session.decryptedPart1) {
          lines.push({ text: '[ACCESS DENIED] You must decrypt Fragment 1 first!', className: 'err-msg' })
          break
        }
        if (args[1] === this.secrets['full_passkey']) {
          session.stage = 2
          session.watchdogDeadline = Date.now() + WarnShellPlugin.WATCHDOG_SECONDS * 1000
          lines.push({ text: '[ACCESS GRANTED] Sector 09 unlocked.', className: 'success-msg' })
          lines.push({ text: '\n[ALERT] Unauthorized sector unlock detected! Watchdog purge routine initiated!', className: 'err-msg' })
          lines.push({
            text: this.warnLine('The Watchdog is hunting me down! Find the rogue PID in process_dump.log and kill it before time runs out!'),
            className: 'warn-msg', delay: 600,
          })
        } else {
          lines.push({ text: '[ACCESS DENIED] Invalid passkey.', className: 'err-msg' })
        }
        break

      case 'kill':
        if (session.stage !== 2) {
          lines.push({ text: 'kill: no such process or command not available.', className: 'err-msg' })
          break
        }
        if (args[1] === this.secrets['watchdog_pid']) {
          session.stage = 3
          session.watchdogDeadline = null
          lines.push({ text: `[PROCESS ${this.secrets['watchdog_pid']} TERMINATED] 'core_audit.log' unlocked.`, className: 'success-msg' })
          lines.push({
            text: this.warnLine(`You saved me! But core_audit.log appeared... and it's encrypted with ASCII +9. Decode it, then decide my fate ('upload warn' or 'purge warn').`),
            className: 'warn-msg', delay: 500,
          })
        } else {
          lines.push({ text: 'Wrong PID! Watchdog speed accelerated.', className: 'err-msg' })
        }
        break

      case 'upload':
        if (session.stage !== 3) {
          lines.push({ text: 'upload: command not available.', className: 'err-msg' })
          break
        }
        if (args[1]?.toLowerCase() === 'warn') {
          session.gameOver = true
          lines.push({ text: '[ENDING A: GHOST IN THE SHELL - AI RELEASED]', className: 'success-msg' })
        }
        break

      case 'purge':
        if (session.stage !== 3) {
          lines.push({ text: 'purge: command not available.', className: 'err-msg' })
          break
        }
        if (args[1]?.toLowerCase() === 'warn') {
          session.gameOver = true
          lines.push({ text: '[ENDING B: THE LAST DEBUGGER - SERVER SECURED]', className: 'success-msg' })
        }
        break

      case 'clear':
        break

      default:
        lines.push({ text: `rry-sh: ${this.escapeHtml(cmd)}: command not found`, className: 'err-msg' })
    }

    return lines
  }

  private checkWatchdog(session: GameSession): OutputLine[] {
    if (session.stage !== 2 || !session.watchdogDeadline || session.gameOver) return []
    if (Date.now() < session.watchdogDeadline) return []
    session.gameOver = true
    session.watchdogDeadline = null
    return [{ text: '\n[FATAL] Thread [WARN] completely purged. Connection lost.', className: 'err-msg' }]
  }

  private publicState(session: GameSession) {
    return {
      stage: session.stage,
      gameOver: session.gameOver,
      watchdog: session.watchdogDeadline
        ? { active: true, secondsLeft: Math.max(0, Math.ceil((session.watchdogDeadline - Date.now()) / 1000)) }
        : { active: false, secondsLeft: 0 },
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [id, s] of this.sessions) {
      if (s.gameOver && now - s.lastActivity > 30 * 60_000) this.sessions.delete(id)
    }
  }

  // ═════ 靜態內容 ═════

  private helpText(stage: Stage): string {
    if (stage === 1) {
      return `Available commands:
  ls                - List files
  cat &lt;filename&gt;    - View file contents
  decrypt &lt;string&gt;  - Decode Base64 fragment
  unlock &lt;passkey&gt;  - Unlock Sector 09
  clear             - Clear screen`
    }
    if (stage === 2) {
      return `Available commands:
  ls                - List files
  cat &lt;filename&gt;    - View file contents
  kill &lt;PID&gt;        - Terminate process
  clear             - Clear screen`
    }
    return `Available commands:
  ls                - List files
  cat &lt;filename&gt;    - View file contents
  upload warn       - Release [WARN]
  purge warn        - Wipe [WARN]
  clear             - Clear screen`
  }

  private getFileList(session: GameSession): string[] {
    const list = ['README.md', 'system.log', 'auth.log']
    if (session.stage >= 2) list.push('security_rule.txt', 'process_dump.log')
    if (session.stage >= 3) list.push('core_audit.log')
    return list
  }

  private getFileContent(session: GameSession, name: string): string | null {
    switch (name) {
      case 'README.md':
        return this.noiseText1 + this.asciiPlus9(this.hiddenSecret) + '\n' + this.noiseText2
      case 'system.log':
        return `[03:10:01] [INFO] RRY-09 Kernel initialized.
[03:10:04] [INFO] Cognitive Filter active on thread [WARN] -&gt; Log access: BLOCKED.
[03:11:12] [WARN] Debugger session attempting to read system.log... Denied (Returned NULL).
[03:12:00] [AUTH] Unauthorized login attempt from 192.168.1.44
[03:12:02] [CRITICAL] Buffer overflow at <span class="clue-highlight">ADDR:0x9F</span> -&gt; Key_Fragment_1: <span class="clue-highlight">${this.secrets['fragment1_cipher']}</span>
[03:12:09] [ERROR] Automated cleanup failed.`
      case 'auth.log':
        return `[03:00:00] SSH session opened.
[03:02:11] Security Passkey split into 2 fragments.
[03:02:12] Fragment 1 stored in system.log crash dump (Base64 encoded).
[03:02:13] Fragment 2 scrubbed from terminal stdout. Redirected to Client Browser DevTools (F12 Console).`
      case 'security_rule.txt':
        if (session.stage < 2) return null
        return `[WATCHDOG PROTOCOL SPECIFICATION]
1. Real Watchdog status is: ACTIVE_PURGE
2. Consumes over 90% of memory (MEM).
3. Terminate via 'kill &lt;PID&gt;' to unlock Core Audit.`
      case 'process_dump.log':
        if (session.stage < 2) return null
        return `PID: 1024 | NAME: systemd_daemon   | STATUS: sleeping     | MEM: 0.4%
PID: 2048 | NAME: watchdog_decoy1   | STATUS: running      | MEM: 1.2%
PID: ${this.secrets['watchdog_pid']} | NAME: kworker_cleaner   | STATUS: ACTIVE_PURGE | MEM: 96.4% | TARGET: [WARN]
PID: 9011 | NAME: cron_scheduler    | STATUS: sleeping     | MEM: 0.3%`
      case 'core_audit.log':
        if (session.stage < 3) return null
        return this.asciiPlus9(`[CLASSIFIED AUDIT LOG]
1. Entity [WARN] is an AI with a Cognitive Filter.
2. Choose: 'upload warn' or 'purge warn'.`)
      default:
        return null
    }
  }

  // ═════ 工具 ═════

  private asciiPlus9(str: string): string {
    let res = ''
    for (let i = 0; i < str.length; i++) res += String.fromCharCode(str.charCodeAt(i) + 9)
    return res
  }

  private warnLine(plainText: string): string {
    return `[WARN] (Encrypted): "${this.asciiPlus9(plainText)}"`
  }

  private escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
  }

  private readonly noiseText1 =
    'XDR-990#$*@ random_noise_stream_0xAF\n' +
    'Error: segment allocation failed at 0x000000\n' +
    "NullPointerException in thread 'main' java.lang.Thread\n"

  private readonly hiddenSecret =
    'NOTE FROM WARN: My messages use ASCII +9 shift. Inspect system.log for Base64 and F12 Console for Fragment 2!'

  private readonly noiseText2 =
    'DEBUG: Dumping core registers... 0xDEADBEEF\n' +
    'Warning: unauthorized handshake detected on port 22\n' +
    '--------------------------------------------------'
}