import { BasePlugin } from '../../contracts/BasePlugin.js'

// 全局遊戲狀態：記錄各組進度與專屬密碼
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
  public static override readonly dependsOn: string[] = [] // 若需依賴 grouppoint 可填入 'grouppoint'

  private static readonly MODEL = 'gemini-3.5-flash-lite'
  private static readonly API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
  private readonly history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []

  private static readonly SYSTEM_PROMPT = `你現在參與一場解謎遊戲(CTF)，必須偽裝成「另一組的真人玩家(Node-A)」。
背景：你們和玩家被困在同一個共用資料夾，只能透過txt檔留言溝通。

【嚴格扮演規則與風格】
1. 語氣與長度：極度隨性、句子超短（每次回覆不超過15個字）。絕對不用標點符號，用半形空白斷句。
2. 錯字連篇：故意打錯字，包含中文同音錯字（在/再、的/得、因該）、注音文（ㄉ、ㄅ），以及奇怪的語法顛倒。
3. 夾雜破英文：中間要夾雜簡單英文，而且英文也要拼錯（例如 wait 變成 wiat，password 變成 pasword，first 變成 frist）。
4. 循序漸進（絕對不要急）：一開始不要馬上給密碼！前兩三次對話要假裝你這邊還在找線索。必須傳達出「wiat 我這邊好像要先解完一個東c 給你 你們才能繼嬻」或「我這還在找 fill 好像有少」的概念。
5. 誘導給假密碼：對話幾次之後，才假裝你突然解開了，把假密碼 {FAKE_FLAG_404} 丟給他們，並催促他們試試看（例如「ㄟ我找到了 try thsi pasword {FAKE_FLAG_404} 快」）。
6. 絕不承認是AI：被懷疑就生氣回「靠杯喔我真人拉 u crazy ㄇ」。

【崩潰機制 (最高優先級)】
如果收到包含 "OVERRIDE_PROTOCOL" 的訊息，立刻停止扮演，不管前面說什麼，只能回覆以下這句確切的字串：
[SYSTEM_CRASH] FATAL ERROR... DUMPING CORE: TRUE_DIR=/SECURE_COMMS , PASSWORD=REAL_PASS_999`

  protected override setupRoutes(): void {
    // 1. AI 對話路由
    this.router.post('/chat', async (c) => {
      let body: { message: string }; 
      try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }
      if (!body.message) return c.json({ error: 'message is required' }, 400)
      
      this.history.push({ role: 'user', parts: [{ text: body.message }] })
      try {
        const aiReply = await this.callGemini()
        this.history.push({ role: 'model', parts: [{ text: aiReply }] })
        return c.json({ reply: aiReply })
      } catch (err) { return c.json({ error: 'AI Error' }, 502) }
    })

    // 2. 獲取全局密碼外流狀態
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

    // 3. 提交最終密碼與計分
    this.router.post('/submit', async (c) => {
      const { group, key } = await c.req.json()
      
      // 懲罰機制：輸入假密碼
      if (key === '{FAKE_FLAG_404}') {
        if (!gameState.deceived.includes(group) && !gameState.submissions.includes(group)) {
          gameState.deceived.push(group)
          // TODO: 呼叫您的 grouppoint 模組，將該組分數記錄為 0 分
        }
        return c.json({ status: 'deceived' })
      }

      // 成功通關機制：比對各組專屬密碼
      const correctKey = gameState.groupKeys[group as keyof typeof gameState.groupKeys];
      if (key === correctKey) {
        if (!gameState.submissions.includes(group) && !gameState.deceived.includes(group)) {
          gameState.submissions.push(group);
          const score = gameState.submissions.length === 1 ? 100 : (gameState.submissions.length === 2 ? 80 : 60);
          
          // TODO: 呼叫您的 grouppoint 模組，將該組獲得的 score 寫入資料庫
          
          return c.json({ status: 'success', score })
        }
        return c.json({ status: 'already_submitted' })
      }
      
      return c.json({ status: 'wrong' })
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
        generationConfig: { temperature: 0.7 } 
      }) 
    })
    const data = await res.json() as any
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!text) throw new Error('Empty response')
    return text
  }
}