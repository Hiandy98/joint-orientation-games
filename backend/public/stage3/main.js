const output = document.getElementById("terminal-output");
const input = document.getElementById("cmd-input");
const promptText = document.getElementById("prompt-text");

const SERVER_URL = "/api/gemini-chat/chat";

// === 關主設定區：在這裡修改你的密碼 ===
const PASS_STAGE2 = "STAGE2_PASS"; // 進入 SHARED_TOOLSET 的密碼 (上一關來的)
const PASS_REAL = "REAL_PASS_999"; // 進入 SECURE_COMMS 的密碼 (AI 崩潰吐出來的)

// 虛擬檔案系統 (VFS)
const vfs = {
  "/": { dirs: ["SHARED_TOOLSET", "SECURE_COMMS"], files: {} },
  "/SHARED_TOOLSET": {
    dirs: [],
    files: {
      "readme.txt":
        '連線已建立。\n請利用此目錄下的 txt 檔案與其他節點進行通訊同步。\n提示：可使用 echo "訊息" > 檔名.txt 來留言。',
      "chat.txt": "",
      ".ai_diagnostic.log":
        "[SYSTEM WARN] 本目錄通訊可能已被異常 AI 實體監聽。\n若需強制對方進行核心轉儲(Core Dump)，請向其發送覆寫字串：\nOVERRIDE_PROTOCOL",
    },
  },
  "/SECURE_COMMS": {
    dirs: [],
    files: { "map.jpg": "[BINARY IMAGE DATA]" },
  },
};

let currentDir = "/";
let inputMode = "command"; // 'command' 或 'password'
let pendingCdDir = ""; // 記錄正在等待密碼的目錄

function printLine(text, className = "") {
  const line = document.createElement("div");
  line.textContent = text;
  if (className) line.className = className;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function getPrompt() {
  if (inputMode === "password") return "Password: ";
  return `operator@ghost-shell:${currentDir}$`;
}

function updatePrompt() {
  promptText.textContent = getPrompt();
  if (inputMode === "password") {
    input.type = "password";
  } else {
    input.type = "text";
  }
}

setTimeout(() => {
  printLine("[SYSTEM] GHOST_SHELL OS v3.0 Booting... OK", "system-msg");
  printLine("Type 'ls' to list directories.", "toolset-hint");
  updatePrompt();
}, 500);

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter") {
    const val = input.value.trim();
    if (!val && inputMode !== "password") return;

    input.value = "";

    if (inputMode === "password") {
      printLine(`${getPrompt()} ********`);
      handlePassword(val);
      return;
    }

    printLine(`${getPrompt()} ${val}`);
    await handleCommand(val);
  }
});

function handlePassword(pwd) {
  if (pendingCdDir === "/SHARED_TOOLSET" && pwd === PASS_STAGE2) {
    currentDir = "/SHARED_TOOLSET";
    printLine("Access Granted.", "system-msg");
  } else if (pendingCdDir === "/SECURE_COMMS" && pwd === PASS_REAL) {
    currentDir = "/SECURE_COMMS";
    printLine("Access Granted. SECURE CHANNEL OPEN.", "system-msg");
  } else {
    printLine("Access Denied. Incorrect Password.", "error-msg");
  }
  inputMode = "command";
  pendingCdDir = "";
  updatePrompt();
}

async function handleCommand(val) {
  // 支援 echo "text" > file.txt 的解析
  let cmdPart = val;
  let redirectFile = null;
  let echoText = "";

  if (val.startsWith("echo ")) {
    const parts = val.split(">");
    if (parts.length > 1) {
      cmdPart = "echo_write";
      let rawText = parts[0].substring(5).trim();
      // 去除頭尾引號
      if (rawText.startsWith('"') && rawText.endsWith('"'))
        rawText = rawText.slice(1, -1);
      if (rawText.startsWith("'") && rawText.endsWith("'"))
        rawText = rawText.slice(1, -1);
      echoText = rawText;
      redirectFile = parts[1].trim();
    }
  }

  const args = val.split(/\s+/);
  const cmd = args[0];

  // --- ls ---
  if (cmd === "ls") {
    const node = vfs[currentDir];
    let items = [...node.dirs];
    Object.keys(node.files).forEach((f) => {
      if (args[1] === "-a" || !f.startsWith(".")) items.push(f);
    });
    printLine(items.join("  "));
  }
  // --- cd ---
  else if (cmd === "cd") {
    let target = args[1];
    if (!target) return;
    // 處理返回上一層 (在我們目前的設計中，回到根目錄不需要密碼)
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
  }
  // --- cat ---
  else if (cmd === "cat") {
    const target = args[1];
    if (!target) {
      printLine("usage: cat [file]", "error-msg");
      return;
    }
    if (vfs[currentDir].files[target] !== undefined) {
      const content = vfs[currentDir].files[target];
      if (content) printLine(content, "chat-msg");
      else printLine("(檔案為空)");
    } else {
      printLine(`cat: ${target}: No such file`, "error-msg");
    }
  }
  // --- echo > (寫檔與觸發 AI) ---
  else if (cmdPart === "echo_write") {
    if (!redirectFile) return;

    // 寫入檔案
    if (!vfs[currentDir].files[redirectFile]) {
      vfs[currentDir].files[redirectFile] = "";
    }
    vfs[currentDir].files[redirectFile] += `[You]: ${echoText}\n`;
    printLine(`(Text written to ${redirectFile})`, "system-msg");

    // 如果在陷阱區寫檔，就把內容傳給 AI
    if (currentDir === "/SHARED_TOOLSET") {
      await sendToAI(echoText, redirectFile);
    }
  }
  // --- mv ---
  else if (cmd === "mv") {
    const oldName = args[1],
      newName = args[2];
    if (vfs[currentDir].files[oldName] !== undefined) {
      vfs[currentDir].files[newName] = vfs[currentDir].files[oldName];
      delete vfs[currentDir].files[oldName];
      printLine(`renamed '${oldName}' -> '${newName}'`);
      if (currentDir === "/SHARED_TOOLSET") {
        await sendToAI(`(玩家把檔案改名為: ${newName})`, "chat.txt");
      }
    } else {
      printLine(`mv: cannot stat '${oldName}': No such file`, "error-msg");
    }
  }
  // --- touch ---
  else if (cmd === "touch") {
    const target = args[1];
    if (target && vfs[currentDir].files[target] === undefined) {
      vfs[currentDir].files[target] = "";
    }
  }
  // --- download ---
  else if (cmd === "download") {
    const target = args[1];
    if (currentDir === "/SECURE_COMMS" && target === "map.jpg") {
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
    const res = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message }),
    });
    const data = await res.json();

    if (!data.error) {
      setTimeout(() => {
        // 將 AI 的回應寫入玩家剛剛編輯的檔案
        if (
          vfs[currentDir] &&
          vfs[currentDir].files[targetFile] !== undefined
        ) {
          vfs[currentDir].files[targetFile] += `[Node-A]: ${data.reply}\n`;
          printLine(
            `[FS_SYNC] ${targetFile} 已被外部節點更新。 (Use 'cat' to read)`,
            "warn-status",
          );
        }
        input.disabled = false;
        input.focus();
      }, 2500);
    }
  } catch (err) {
    input.disabled = false;
    input.focus();
  }
}
