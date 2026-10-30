const output = document.getElementById("terminal-output");
const input = document.getElementById("cmd-input");
const promptText = document.getElementById("prompt-text");

// === 關主設定區 ===
// 重要：請在每一台電腦開啟網頁前，把這裡改成 A, B, 或 C
const MY_GROUP = "B";

const PASS_STAGE2 = "STAGE2_PASS";
const PASS_REAL = "REAL_PASS_999";
const API_BASE = "/api/gemini-chat";

const vfs = {
  "/": { dirs: ["SHARED_TOOLSET", "SECURE_COMMS"], files: {} },
  "/SHARED_TOOLSET": {
    dirs: [],
    files: {
      "readme.txt": '請用 echo "訊息" > chat.txt 留言。',
      "chat.txt": "",
      ".ai_diagnostic.log": "強制核心轉儲指令:\nOVERRIDE_PROTOCOL",
    },
  },
  "/SECURE_COMMS": { dirs: [], files: {} },
};

// 動態掛載專屬圖片與共用寫入檔
vfs["/SECURE_COMMS"].files[`map_${MY_GROUP}.jpg`] = "[BINARY IMAGE]";
vfs["/SECURE_COMMS"].files["final_keys.txt"] = "";

let currentDir = "/";
let inputMode = "command";
let pendingCdDir = "";

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
      : `operator@node-${MY_GROUP}:${currentDir}$`;
  input.type = inputMode === "password" ? "password" : "text";
}

setTimeout(() => {
  printLine(`[SYSTEM] Node-${MY_GROUP} Booting... OK`, "system-msg");
  updatePrompt();
}, 500);

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter") {
    const val = input.value.trim();
    if (!val && inputMode !== "password") return;
    input.value = "";

    if (inputMode === "password") {
      printLine(`${promptText.textContent} ********`);
      await handlePassword(val);
      return;
    }
    printLine(`${promptText.textContent} ${val}`);
    await handleCommand(val);
  }
});

async function handlePassword(pwd) {
  if (pendingCdDir === "/SHARED_TOOLSET" && pwd === PASS_STAGE2) {
    currentDir = "/SHARED_TOOLSET";
    printLine("Access Granted.", "system-msg");
  } else if (pendingCdDir === "/SECURE_COMMS" && pwd === PASS_REAL) {
    currentDir = "/SECURE_COMMS";
    printLine("Access Granted. SECURE CHANNEL OPEN.", "system-msg");
  } else if (pwd === "{FAKE_FLAG_404}") {
    printLine("Access Denied.", "error-msg");
    // 輸入了假密碼，觸發被 AI 騙的懲罰機制
    await fetch(`${API_BASE}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group: MY_GROUP, key: pwd }),
    });
    printLine(
      "[CRITICAL] 偵測到惡意 payload！本機權限已被 AI 奪取！",
      "error-msg",
    );
    printLine(
      "[CRITICAL] 內部通訊密碼已外流至 /SECURE_COMMS/final_keys.txt",
      "error-msg",
    );
  } else {
    printLine("Access Denied.", "error-msg");
  }
  inputMode = "command";
  pendingCdDir = "";
  updatePrompt();
}

async function handleCommand(val) {
  let cmdPart = val;
  let redirectFile = null;
  let echoText = "";
  if (val.startsWith("echo ")) {
    const parts = val.split(">");
    if (parts.length > 1) {
      cmdPart = "echo_write";
      echoText = parts[0]
        .substring(5)
        .trim()
        .replace(/^["']|["']$/g, "");
      redirectFile = parts[1].trim();
    }
  }
  const args = val.split(/\s+/);
  const cmd = args[0];

  if (cmd === "ls") {
    const node = vfs[currentDir];
    let items = [...node.dirs];
    Object.keys(node.files).forEach((f) => {
      if (args[1] === "-a" || !f.startsWith(".")) items.push(f);
    });
    printLine(items.join("  "));
  } else if (cmd === "cd") {
    let target = args[1];
    if (!target) return;
    if (target === "..") {
      if (currentDir !== "/") {
        currentDir = "/";
        updatePrompt();
      }
      return;
    }
    if (!target.startsWith("/"))
      target = currentDir === "/" ? `/${target}` : `${currentDir}/${target}`;
    if (vfs[target]) {
      pendingCdDir = target;
      inputMode = "password";
      updatePrompt();
    } else {
      printLine(`cd: ${args[1]}: No such directory`, "error-msg");
    }
  } else if (cmd === "cat") {
    const target = args[1];
    if (currentDir === "/SECURE_COMMS" && target === "final_keys.txt") {
      // 從伺服器拉取最新的三組密碼狀態
      const res = await fetch(`${API_BASE}/status`);
      const data = await res.json();
      printLine(data.content, "warn-status");
    } else if (vfs[currentDir].files[target] !== undefined) {
      printLine(vfs[currentDir].files[target] || "(檔案為空)", "chat-msg");
    } else {
      printLine(`cat: ${target}: No such file`, "error-msg");
    }
  } else if (cmdPart === "echo_write") {
    if (!redirectFile) return;
    if (currentDir === "/SECURE_COMMS" && redirectFile === "final_keys.txt") {
      printLine(`[SYSTEM] 正在驗證金鑰...`, "system-msg");
      const res = await fetch(`${API_BASE}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: MY_GROUP, key: echoText }),
      });
      const data = await res.json();
      if (data.status === "success")
        printLine(
          `[VERIFIED] 密碼正確！本節點得分: ${data.score} 分。`,
          "system-msg",
        );
      else if (data.status === "deceived")
        printLine(
          `[FAILED] 輸入了假密碼！本節點 0 分，且密碼已外流！`,
          "error-msg",
        );
      else if (data.status === "already_submitted")
        printLine(`已提交過，請勿重複提交。`, "warn-status");
      else printLine(`[ERROR] 密碼無效。`, "error-msg");
    } else {
      vfs[currentDir].files[redirectFile] =
        (vfs[currentDir].files[redirectFile] || "") + `[You]: ${echoText}\n`;
      printLine(`(Text written to ${redirectFile})`, "system-msg");
      if (currentDir === "/SHARED_TOOLSET")
        await sendToAI(echoText, redirectFile);
    }
  } else if (cmd === "download") {
    const target = args[1];
    if (currentDir === "/SECURE_COMMS" && target === `map_${MY_GROUP}.jpg`) {
      printLine(`[SYSTEM] Downloading ${target} ...`, "system-msg");
      const a = document.createElement("a");
      a.href = target;
      a.download = target;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      printLine(`download: 找不到檔案或無權限`, "error-msg");
    }
  } else {
    printLine(`bash: ${cmd}: command not found`, "error-msg");
  }
}

async function sendToAI(message, targetFile) {
  input.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }),
    });
    const data = await res.json();
    if (!data.error) {
      setTimeout(() => {
        vfs[currentDir].files[targetFile] += `[Node-A]: ${data.reply}\n`;
        printLine(`[FS_SYNC] ${targetFile} 已被外部節點更新。`, "warn-status");
        input.disabled = false;
        input.focus();
      }, 2500);
    }
  } catch (err) {
    input.disabled = false;
    input.focus();
  }
}
