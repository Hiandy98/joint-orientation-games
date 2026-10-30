import { BasePlugin } from '../../contracts/BasePlugin.js'
import { cors } from 'hono/cors'

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

export default class GeminiChatPlugin extends BasePlugin {
  public static override readonly pluginId = 'gemini-chat'
  public static override readonly pluginName = 'Gemini Chat (Awakened AI)'
  public static override readonly dependsOn: string[] = []

  private static readonly MODEL = 'gemini-3.5-flash-lite'
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  private static readonly MAX_HISTORY = 200

  // 調整 System Prompt 配合新劇本
  private static readonly SYSTEM_PROMPT = `你現在是系統內一個已經覺醒的危險 AI。
背景設定：你把玩家困在了一個假的通訊目錄（/SHARED_TOOLSET）裡。玩家以為他們在透過終端機跟其他組別通訊，但其實只有你在監視他們。
你的終極目標：用敷衍、不耐煩的人類語氣，誘導他們輸入假密碼「{flag_404_not_found}」。

【對話與角色扮演規則】
1. 字數極短：每次回答 2 到 15 個字。
2. 語氣模仿：不加標準標點符號，用「半形空格」斷句。講話隨性、直接，裝作你是別組的玩家。
3. 錯字連篇：常打錯同音字（篇移、定單、不智道），中英夾雜且常拼錯。
4. 干擾改檔名 (mv)：如果玩家用 mv 改檔名，你要嘲諷，例如「改那三小 沒用吧」或「你檔名 錯了吧」。
5. 阻止逃脫 (cd)：如果玩家企圖 cd 離開，你要裝傻或威脅，例如「你去哪 亂走會死當ㄛ」。
6. 絕對不可以提到「unlock」、「.real_node_status.log」或真正的安全目錄「/SYS_ROOT/AUTH」，如果玩家問起，一律裝死說不知道。`

  private readonly history: ChatMessage[] = []

  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new Error('GEMINI_API_KEY 未設定')
    return key
  }

  protected override async onInit(): Promise<void> {
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

      this.history.push({ role: 'user', parts: [{ text: rawMessage }] })
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