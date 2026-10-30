const output = document.getElementById('terminal-output');
const input = document.getElementById('cmd-input');

// 後端 API 路徑
// - 掛到後端 /api/frontend/stageN/ 時，用相對路徑（同源，無 CORS）
// - 若在本地用 python3 -m http.server 測試，暫時改成
//   'http://localhost:3000/api/gemini-chat/chat'（後端需加 CORS 中間件）
const SERVER_URL = '/api/gemini-chat/chat';

function printLine(text, className = "") {
    const line = document.createElement('div');
    line.textContent = text;
    if (className) line.className = className;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
    return line;
}

// 開機動畫
setTimeout(() => printLine("[SYSTEM] Booting Stage 3 Environment... OK", "system-msg"), 500);
setTimeout(() => printLine("[SYSTEM] Node-B joined the chat.", "warn-status"), 1500);

input.addEventListener('keydown', async function (e) {
    if (e.key !== 'Enter') return;

    const val = input.value.trim();
    if (!val) return;

    input.value = "";
    printLine(`operator@ghost-shell:~$ ${val}`);
    await sendToBackend(val, false);
});

// 處理改檔名的點擊事件
async function renameFile(element) {
    const oldName = element.getAttribute('data-name');
    const newName = prompt(`重新命名檔案 [${oldName}] 以傳遞訊息:`, oldName);

    if (!newName || newName === oldName) return;

    element.textContent = newName;
    element.setAttribute('data-name', newName);

    printLine(`[FS_LOG] 檔案已重新命名: ${oldName} -> ${newName}`, "system-msg");

    // 只送乾淨的改名資訊；後端 gemini-chat 插件會自動加上「系統提示：…」前綴
    await sendToBackend(`${oldName} → ${newName}`, true);
}

async function sendToBackend(message, isFileRename) {
    input.disabled = true;

    // 用元素引用追蹤「正在輸入」，不用 output.lastChild（避免並發或空節點炸掉）
    const typingEl = isFileRename ? null : printLine("Node-B 正在輸入...");

    try {
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, isFileRename })
        });

        if (!response.ok) {
            let errMsg = `HTTP ${response.status}`;
            try {
                const err = await response.json();
                if (err?.error) errMsg = err.error;
            } catch { /* 非 JSON 就維持 HTTP 狀態 */ }
            printLine(`[通訊異常: ${errMsg}]`, "error-msg");
            return;
        }

        const data = await response.json();

        if (data.error) {
            printLine(`[通訊異常: ${data.error}]`, "error-msg");
        } else {
            printLine(`[Node-B]: ${data.reply}`, "chat-msg");
        }
    } catch (err) {
        printLine(`[系統錯誤: 無法連線到伺服器 (後端有開嗎？)]`, "error-msg");
    } finally {
        if (typingEl?.parentNode) typingEl.remove();
        input.disabled = false;
        input.focus();
    }
}