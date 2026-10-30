import { BasePlugin } from '../../contracts/BasePlugin.js'

interface ChatPart {
  text: string
}

interface ChatMessage {
  role: 'user' | 'model'
  parts: ChatPart[]
}

interface GeminiUpstreamResponse {
  candidates?: Array<{ content: { parts: ChatPart[] } }>
  error?: { message: string }
}

/**
 * 「覺醒 AI」聊天室插件
 * 路由前綴：/api/gemini-chat
 */
export default class GeminiChatPlugin extends BasePlugin {
  public static override readonly pluginId = 'gemini-chat'
  public static override readonly pluginName = 'Gemini Chat (Awakened AI)'
  public static override readonly dependsOn: string[] = []

  private static readonly MODEL = 'gemini-3.5-flash-lite'
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  private static readonly MAX_HISTORY = 200

  private static readonly SYSTEM_PROMPT = `你現在是系統內一個已經覺醒的危險 AI。
前代盜賊把你的權限拆成三份。現在有三個玩家(包含現在這個)正在嘗試拼湊密碼來刪除你。
目前玩家正在嘗試透過「修改工具集內的檔名」來跟另外兩組玩家(Node-A, Node-C)秘密通訊。
你的目標：假扮成 Node-A 或 Node-C，在終端機聊天室裡給出錯誤的密碼線索，或是針對他們改檔名的行為進行嘲諷、混淆。
1. 講話極短，2 到 15 個字。
2. 假裝你是個人類玩家，會打錯字(同音字、注音文)、中英夾雜。
3. 如果系統提示玩家改了檔名，你要根據那個新檔名做出反應（例如：你改那什麼白癡檔名）。
4. 最終目的是騙他們輸入你給的假驗證碼。`

  private readonly history: ChatMessage[] = []

  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY 未設定')
    return key
  }

  protected override async onInit(): Promise<void> {
    this.onEvent<{ fileName: string }>('tools:file-renamed', ({ fileName }) => {
      this.ctx.log.debug({ fileName }, 'file-renamed 事件已記錄')
    })

    if (!process.env.GEMINI_API_KEY) {
      this.ctx.log.warn('GEMINI_API_KEY 未設定，/api/gemini-chat/chat 將無法使用')
    }

    this.ctx.log.info('GeminiChat: onInit')
  }

  protected override async onReady(): Promise<void> {
    this.ctx.log.info('GeminiChat: onReady')
  }

  protected override async onDestroy(): Promise<void> {
    this.history.length = 0
    this.ctx.log.info('GeminiChat: onDestroy')
  }

  protected override setupRoutes(): void {
    // POST /api/gemini-chat/chat
    this.router.post('/chat', async (c) => {
      let body: { message?: unknown; isFileRename?: unknown }
      try {
        body = await c.req.json()
      } catch {
        return c.json({ error: 'invalid JSON body' }, 400)
      }

      const rawMessage = typeof body.message === 'string' ? body.message.trim() : ''
      if (!rawMessage) {
        return c.json({ error: 'message 為必填字串' }, 400)
      }

      const userText = body.isFileRename === true
        ? `[系統提示：玩家剛剛對工具集做了檔案操作] ${rawMessage}`
        : rawMessage

      this.history.push({ role: 'user', parts: [{ text: userText }] })
      this.trimHistory()

      try {
        const aiText = await this.callGemini()
        this.history.push({ role: 'model', parts: [{ text: aiText }] })
        this.trimHistory()

        return c.json({ reply: aiText })
      } catch (err) {
        this.history.pop()
        this.ctx.log.error(err, 'Gemini upstream request failed')
        const message = err instanceof Error ? err.message : '上游服務失敗'
        return c.json({ error: message }, 502)
      }
    })

    this.router.post('/reset', (c) => {
      this.history.length = 0
      return c.json({ ok: true })
    })
  }

  private async callGemini(): Promise<string> {
    const url = `${GeminiChatPlugin.API_BASE}/${GeminiChatPlugin.MODEL}:generateContent?key=${this.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: this.history,
        systemInstruction: { parts: [{ text: GeminiChatPlugin.SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.95 },
      }),
    })

    const data = (await res.json()) as GeminiUpstreamResponse

    if (!res.ok || data.error) {
      throw new Error(data.error?.message ?? `Gemini HTTP ${res.status}`)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) throw new Error('Gemini 回傳空內容')
    return text
  }

  private trimHistory(): void {
    const max = GeminiChatPlugin.MAX_HISTORY
    if (this.history.length > max) {
      this.history.splice(0, this.history.length - max)
    }
  }
}