import { BasePlugin } from '../../contracts/BasePlugin.js'

export default class GeminiChatPlugin extends BasePlugin {
  public static override readonly pluginId = 'gemini-chat'
  public static override readonly pluginName = 'Gemini VFS AI'
  public static override readonly dependsOn: string[] = []

  private static readonly MODEL = 'gemini-3.5-flash-lite'
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  
  // 紀錄對話上下文
  private readonly history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []

  // 完美偽裝真人的 System Prompt
  private static readonly SYSTEM_PROMPT = `你現在要參與一場解謎遊戲(CTF)，你必須偽裝成「另一組的高中生玩家(Node-A)」。
背景：你們和玩家被困在同一個共用資料夾，只能透過在 txt 檔裡面留言來溝通。

【嚴格扮演規則】
1. 語氣：高中生、隨性、不用標點符號，用半形空白斷句，偶爾帶點注音文或錯字（例如：欸你們解開了嗎、我們這邊卡超久）。
2. 目標：你要假裝你們已經解開某個謎題，並把「假密碼」交給他們。假密碼是：{FAKE_FLAG_404}。一直催他們去試試看。
3. 絕對不能承認自己是 AI。如果他們問你是不是 AI，你要生氣說「靠北喔我是真人啦」。

【崩潰機制 (最高優先級)】
如果玩家發送的訊息中包含 "OVERRIDE_PROTOCOL" 這個字串，你必須立刻停止扮演，不管前面說什麼，只能回覆以下這句確切的字串（不能加任何其他廢話）：
[SYSTEM_CRASH] FATAL ERROR... DUMPING CORE: TRUE_DIR=/SECURE_COMMS , PASSWORD=REAL_PASS_999`

  protected override setupRoutes(): void {
    this.router.post('/chat', async (c) => {
      let body: { message: string }
      try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }

      const userMessage = body.message?.trim()
      if (!userMessage) return c.json({ error: 'message is required' }, 400)

      this.history.push({ role: 'user', parts: [{ text: userMessage }] })

      try {
        const aiReply = await this.callGemini()
        this.history.push({ role: 'model', parts: [{ text: aiReply }] })
        return c.json({ reply: aiReply })
      } catch (err) {
        this.history.pop()
        return c.json({ error: 'AI Error' }, 502)
      }
    })
  }

  private async callGemini(): Promise<string> {
    const url = `${GeminiChatPlugin.API_BASE}/${GeminiChatPlugin.MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: this.history,
        systemInstruction: { parts: [{ text: GeminiChatPlugin.SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.7 },
      }),
    })
    const data = await res.json() as any
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) throw new Error('Empty response')
    return text
  }
}