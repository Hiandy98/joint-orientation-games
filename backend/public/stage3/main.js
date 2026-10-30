const output = document.getElementById("terminal-output");
const input = document.getElementById("cmd-input");
const promptText = document.getElementById("prompt-text");
const fileList = document.getElementById("file-list");
const dirDisplay = document.getElementById("dir-display");

const SERVER_URL = "/api/gemini-chat/chat";

// 虛擬檔案系統
const vfs = {
  "/SHARED_TOOLSET": [
    "key_part_1.tmp",
    "system_log.bak",
    "communication.txt",
    ".real_node_status.log",
  ],
  "/SYS_ROOT/AUTH": ["real_nodeA_msg.txt", "communication_map.jpg"],
};

let currentDir = "/SHARED_TOOLSET";
let isUnlocked = false; // 是否已解鎖真實目錄

function printLine(text, className = "") {
  const line = document.createElement("div");
  line.textContent = text;
  if (className) line.className = className;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function renderFileList() {
  fileList.innerHTML = "";
  dirDisplay.textContent = currentDir;
  promptText.textContent = `operator@ghost-shell:${currentDir}$`;

  if (vfs[currentDir]) {
    vfs[currentDir].forEach((fileName) => {
      // 預設隱藏點開頭的檔案
      if (!fileName.startsWith(".")) {
        const li = document.createElement("li");
        li.textContent = fileName;
        fileList.appendChild(li);
      }
    });
  }
}

setTimeout(() => {
  printLine("[SYSTEM] Booting Stage 3 Environment... OK", "system-msg");
  printLine("[SYSTEM] Directory mounted: /SHARED_TOOLSET", "system-msg");
  renderFileList();
}, 500);
setTimeout(
  () => printLine("[SYSTEM] Node-B joined the chat.", "warn-status"),
  1500,
);

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter") {
    const val = input.value.trim();
    if (!val) return;

    input.value = "";
    printLine(`operator@ghost-shell:${currentDir}$ ${val}`);

    const args = val.split(/\s+/);
    const cmd = args[0];

    // --- ls 指令 (支援 ls -a 顯示隱藏檔) ---
    if (cmd === "ls") {
      let files = vfs[currentDir] || [];
      if (args[1] !== "-a") {
        files = files.filter((f) => !f.startsWith("."));
      }
      printLine(files.join("  "));
    }

    // --- cat 指令 (讀取文字檔) ---
    else if (cmd === "cat") {
      const target = args[1];
      if (
        currentDir === "/SHARED_TOOLSET" &&
        target === ".real_node_status.log"
      ) {
        printLine("[WARN] INTERCEPTION DETECTED.", "warn-status");
        printLine(
          "AI 正在攔截通訊。真正的安全通道已轉移至 /SYS_ROOT/AUTH",
          "system-msg",
        );
        printLine("使用強制覆寫指令解鎖: unlock ROOT_7749", "system-msg");
      } else if (
        currentDir === "/SYS_ROOT/AUTH" &&
        target === "real_nodeA_msg.txt"
      ) {
        printLine(
          "Node-A 留言: 終於連上了！AI一直在騙我們給假密碼！",
          "chat-msg",
        );
        printLine(
          "Node-A 留言: 快把 communication_map.jpg 下載 (download) 到電腦裡，把副檔名改成 .txt 找最後的碎片！",
          "chat-msg",
        );
      } else {
        printLine(`cat: ${target}: 權限不足或檔案不存在`, "error-msg");
      }
    }

    // --- unlock 指令 (解鎖真實目錄) ---
    else if (cmd === "unlock") {
      if (args[1] === "ROOT_7749") {
        isUnlocked = true;
        printLine(
          "[SYSTEM] ACCESS GRANTED. /SYS_ROOT/AUTH 權限已開放。",
          "system-msg",
        );
      } else if (args[1] === "{flag_404_not_found}") {
        printLine("[AI] 哈哈哈哈哈，你以為這是真的密碼嗎？蠢貨！", "error-msg");
      } else {
        printLine("PASSCODE REJECTED. 密碼錯誤。", "error-msg");
      }
    }

    // --- cd 指令 ---
    else if (cmd === "cd") {
      const target = args[1];
      if (!target) {
        printLine("用法: cd [目錄]", "error-msg");
      } else if (target === "..") {
        printLine("權限不足，無法離開目前結構。", "error-msg");
        await sendToBackend(`(系統提示：玩家企圖 cd 離開目錄)`, true);
      } else if (target === "/SYS_ROOT/AUTH" || target === "SYS_ROOT/AUTH") {
        if (!isUnlocked) {
          printLine(
            "ACCESS DENIED. 目錄已上鎖，請先取得 override passcode。",
            "error-msg",
          );
        } else {
          currentDir = "/SYS_ROOT/AUTH";
          renderFileList();
          printLine("[SYSTEM] Switched to secure channel.", "system-msg");
        }
      } else {
        printLine(`cd: ${target}: 沒有此一目錄`, "error-msg");
      }
    }

    // --- mv 指令 (觸發 AI 嘲諷) ---
    else if (cmd === "mv") {
      if (args.length !== 3) {
        printLine("用法: mv [原檔名] [新檔名]", "error-msg");
      } else {
        const oldName = args[1];
        const newName = args[2];
        const fileIndex = vfs[currentDir].indexOf(oldName);

        if (fileIndex !== -1) {
          vfs[currentDir][fileIndex] = newName;
          renderFileList();
          printLine(
            `[FS_LOG] 檔案已重新命名: ${oldName} -> ${newName}`,
            "system-msg",
          );

          if (currentDir === "/SHARED_TOOLSET") {
            await sendToBackend(
              `(系統提示：玩家在陷阱目錄輸入了 mv ${oldName} ${newName})`,
              true,
            );
          }
        } else {
          printLine(`mv: 無法取得 '${oldName}': 沒有此一檔案`, "error-msg");
        }
      }
    }

    // --- download 指令 (下載實體檔案) ---
    else if (cmd === "download") {
      const target = args[1];
      if (
        currentDir === "/SYS_ROOT/AUTH" &&
        target === "communication_map.jpg"
      ) {
        printLine(`[SYSTEM] 正在為您下載檔案: ${target} ...`, "system-msg");

        // 建立隱藏的 a 標籤觸發真實下載
        const a = document.createElement("a");
        a.href = target;
        a.download = target;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(
          () =>
            printLine(
              "[SYSTEM] 下載完成。請至本機資料夾檢查檔案。",
              "system-msg",
            ),
          1000,
        );
      } else {
        printLine(`download: 找不到檔案 ${target}，或權限不足`, "error-msg");
      }
    }

    // --- 聊天訊息 (未命中指令皆當作對話傳給 AI) ---
    else {
      if (currentDir === "/SYS_ROOT/AUTH") {
        printLine("[SYSTEM] 此為單向廣播頻道，無法傳送訊息。", "warn-status");
      } else {
        await sendToBackend(val, false);
      }
    }
  }
});

async function sendToBackend(message, isHiddenSignal) {
  input.disabled = true;
  if (!isHiddenSignal) printLine("Node-B typing...");

  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, isFileRename: isHiddenSignal }),
    });

    const data = await response.json();
    if (!isHiddenSignal) output.removeChild(output.lastChild);

    if (data.error) {
      printLine(`[異常: ${data.error}]`, "error-msg");
    } else {
      setTimeout(() => {
        printLine(`[Node-B]: ${data.reply}`, "chat-msg");
        input.disabled = false;
        input.focus();
      }, 1000);
      return;
    }
  } catch (err) {
    if (!isHiddenSignal) output.removeChild(output.lastChild);
    printLine(`[系統錯誤] AI 伺服器離線`, "error-msg");
  }
  input.disabled = false;
  input.focus();
}
