import { BasePlugin } from '../../contracts/BasePlugin.js'

const gameState = {
  submissions: [] as string[],
  deceived: [] as string[],
  groupKeys: {
    'A': 'Excalibur_',
    'B': 'found_',
    'C': 'flag_404'
  }
}

export default class GeminiChatPlugin extends BasePlugin {
  public static override readonly pluginId = 'gemini-chat'
  public static override readonly pluginName = 'Gemini VFS AI & Score'
  public static override readonly dependsOn: string[] = []

  private static readonly MODEL = 'gemini-3.5-flash-lite'
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  private readonly history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []

  private static readonly SYSTEM_PROMPT = `你現在參與CTF遊戲，偽裝成「另一組的真人玩家」。
規則：
1. 語氣隨性、不用標點符號，用半形空白斷句，偶爾錯字。
2. 目標：假裝你們解開了，一直誘導對方去輸入假密碼：{FAKE_FLAG_404}。
3. 絕不承認是AI。
【崩潰機制】若收到 "OVERRIDE_PROTOCOL"，立刻只回覆：
[SYSTEM_CRASH] FATAL ERROR... DUMPING CORE: TRUE_DIR=/SECURE_COMMS , PASSWORD=REAL_PASS_999`

  protected override setupRoutes(): void {
    this.router.post('/chat', async (c) => {
      let body: { message: string }; try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }
      if (!body.message) return c.json({ error: 'message is required' }, 400)
      this.history.push({ role: 'user', parts: [{ text: body.message }] })
      try {
        const aiReply = await this.callGemini()
        this.history.push({ role: 'model', parts: [{ text: aiReply }] })
        return c.json({ reply: aiReply })
      } catch (err) { return c.json({ error: 'AI Error' }, 502) }
    })

    this.router.get('/status', (c) => {
      let publicContent = "=== NODE SYNC STATUS ===\n";
      Object.entries(gameState.groupKeys).forEach(([group, key]) => {
        if (gameState.submissions.includes(group)) {
          publicContent += `Node-${group} [VERIFIED]: ${key}\n`;
        } else if (gameState.deceived.includes(group)) {
          publicContent += `Node-${group} [COMPROMISED]: ${key} (自動提取)\n`;
        } else {
          publicContent += `Node-${group} [WAITING]: ???\n`;
        }
      });
      return c.json({ content: publicContent })
    })

    this.router.post('/submit', async (c) => {
      const { group, key } = await c.req.json()
      if (key === '{FAKE_FLAG_404}') {
        if (!gameState.deceived.includes(group) && !gameState.submissions.includes(group)) {
          gameState.deceived.push(group)
        }
        return c.json({ status: 'deceived' })
      }
      const correctKey = gameState.groupKeys[group as keyof typeof gameState.groupKeys];
      if (key === correctKey) {
        if (!gameState.submissions.includes(group) && !gameState.deceived.includes(group)) {
          gameState.submissions.push(group);
          const score = gameState.submissions.length === 1 ? 100 : (gameState.submissions.length === 2 ? 80 : 60);
          return c.json({ status: 'success', score })
        }
        return c.json({ status: 'already_submitted' })
      }
      return c.json({ status: 'wrong' })
    })
  }

  private async callGemini(): Promise<string> {
    const url = `${GeminiChatPlugin.API_BASE}/${GeminiChatPlugin.MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: this.history, systemInstruction: { parts: [{ text: GeminiChatPlugin.SYSTEM_PROMPT }] }, generationConfig: { temperature: 0.7 } }) })
    const data = await res.json() as any
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) throw new Error('Empty response')
    return text
  }
}