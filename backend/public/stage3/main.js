sessionStorage.setItem('active_stage_url', window.location.pathname);

const output = document.getElementById("terminal-output");
const input = document.getElementById("cmd-input");
const promptText = document.getElementById("prompt-text");

const API_BASE = "/api/node-shell";

let sessionId = null;
let groupId = "?";
let inputMode = "command";
let currentDir = "/";
let syncInterval = null; // 👈 用來存定時器

function printLine(text, className = "") {
  const line = document.createElement("div");
  line.textContent = text;
  if (className) line.className = className;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function updatePrompt() {
  promptText.textContent =
    inputMode === "password"
      ? "Password: "
      : `operator@node-${groupId}:~${currentDir}$`;
  input.type = inputMode === "password" ? "password" : "text";
}

async function startShell() {
  try {
    const res = await fetch(`${API_BASE}/start`, { method: "POST" });
    const data = await res.json();
    
    if (data.error) {
      printLine(`[ERROR] ${data.error}`, "error-msg");
      return;
    }

    sessionId = data.sessionId;
    groupId = data.groupId;
    inputMode = data.inputMode;
    currentDir = data.currentDir;
    
    data.lines.forEach(l => printLine(l.text, l.className));
    updatePrompt();

    // 👈 啟動 AI 通知輪詢
    startSyncPolling();
  } catch (err) {
    printLine(`[ERROR] 無法連線至伺服器`, "error-msg");
  }
}

// 👈 新增：輪詢後端通知
function startSyncPolling() {
  if (syncInterval) clearInterval(syncInterval);
  
  syncInterval = setInterval(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      
      if (data.notifications && data.notifications.length > 0) {
        // 如果有新通知，印在畫面上（使用橘色字體）
        data.notifications.forEach(msg => {
          printLine(msg, "warn-status");
        });
      }
    } catch (e) {
      // 忽略網路錯誤，避免噴錯洗頻
    }
  }, 1500); // 每 1.5 秒檢查一次
}

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter") {
    const val = input.value.trim();
    if (!val && inputMode !== "password") return;
    input.value = "";

    // 為了不讓畫面空等，先印出使用者的輸入
    if (inputMode === "password") {
      printLine(`Password: ********`);
    } else {
      printLine(`operator@node-${groupId}:~${currentDir}$ ${val}`);
    }

    input.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, val })
      });
      const data = await res.json();
      
      if (data.error) {
        printLine(`[ERROR] ${data.error}`, "error-msg");
      } else {
        data.lines.forEach(l => {
          if (l.className === 'hidden-download') {
            // 處理下載
            const filename = l.text.split(':')[1];
            const a = document.createElement("a");
            a.href = filename;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            printLine(l.text, l.className);
          }
        });
        
        inputMode = data.inputMode;
        currentDir = data.currentDir;
        updatePrompt();
      }
    } catch (err) {
      printLine(`[ERROR] 系統連線中斷`, "error-msg");
    } finally {
      input.disabled = false;
      input.focus();
    }
  }
});

// 頁面關閉時清理定時器（好習慣）
window.addEventListener("beforeunload", () => {
  if (syncInterval) clearInterval(syncInterval);
});

// 啟動時初始化
startShell();