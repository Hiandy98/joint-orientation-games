const output = document.getElementById('terminal-output');
const input = document.getElementById('cmd-input');
const watchdogStatus = document.getElementById('watchdog-status');

const gameState = {
  stage: 1,
  foundPid: false,
  decryptedPart1: false,
  watchdogTimer: null,
  timeLeft: 60,
  gameOver: false
};

// ASCII +9 加密函數
function asciiPlus9(str) {
  let res = '';
  for (let i = 0; i < str.length; i++) {
    res += String.fromCharCode(str.charCodeAt(i) + 9);
  }
  return res;
}

// 產生一堆亂碼，並把加密後的提示塞在其中
const noiseText1 = "XDR-990#$*@ random_noise_stream_0xAF\n" +
                   "Error: segment allocation failed at 0x000000\n" +
                   "NullPointerException in thread 'main' java.lang.Thread\n";
const hiddenSecret = "NOTE FROM WARN: My messages use ASCII +9 shift. Inspect system.log for Base64 and F12 Console for Fragment 2!";
const noiseText2 = "DEBUG: Dumping core registers... 0xDEADBEEF\n" +
                   "Warning: unauthorized handshake detected on port 22\n" +
                   "--------------------------------------------------";

// 模擬檔案系統（含 ASCII +9 加密的 README.txt）
const fileSystem = {
  "README.md": noiseText1 + asciiPlus9(hiddenSecret) + "\n" + noiseText2,

  "system.log": `[03:10:01] [INFO] RRY-09 Kernel initialized.
[03:10:04] [INFO] Cognitive Filter active on thread [WARN] -> Log access: BLOCKED.
[03:11:12] [WARN] Debugger session attempting to read system.log... Denied (Returned NULL).
[03:12:00] [AUTH] Unauthorized login attempt from 192.168.1.44
[03:12:02] [CRITICAL] Buffer overflow at <span class="clue-highlight">ADDR:0x9F</span> -> Key_Fragment_1: <span class="clue-highlight">N2V5X29mXw==</span>
[03:12:09] [ERROR] Automated cleanup failed.`,

  "auth.log": `[03:00:00] SSH session opened.
[03:02:11] Security Passkey split into 2 fragments.
[03:02:12] Fragment 1 stored in system.log crash dump (Base64 encoded).
[03:02:13] Fragment 2 scrubbed from terminal stdout. Redirected to Client Browser DevTools (F12 Console).`
};

function printLine(html, className = 'sys-msg') {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = html;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

// [WARN] 發送純 ASCII +9 密文（不提供任何自動翻譯）
function warnSpeak(plainText, delay = 400) {
  setTimeout(() => {
    if (gameState.gameOver) return;
    const encryptedText = asciiPlus9(plainText);
    const div = document.createElement('div');
    div.className = 'warn-msg';
    div.innerHTML = `[WARN] (Encrypted): "${encryptedText}"`;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }, delay);
}

// 瀏覽器 F12 埋藏第二段密鑰（同樣以 ASCII +9 加密，考驗玩家怎麼用 JS 解密）
function plantBrowserClue() {
  console.clear();
  const plainMsg = "Passkey Fragment 2 is: debugger_09";
  console.log(
    `%c[WARN // ASCII +9 ENCRYPTED PACKET IN CONSOLE]%c\n${asciiPlus9(plainMsg)}\n\n` +
    `(Hint: Write a script in this Console to subtract 9 from each character code!)`,
    "color: #ffaa00; font-weight: bold; background: #111; padding: 3px;",
    "color: #ccc;"
  );
}

function initGame() {
  plantBrowserClue();
  printLine("Establishing connection to RRY-09 // shell...", "sys-msg");
  printLine("Connection established. Type <span class='clue-highlight'>help</span> for available commands.\n", "sys-msg");

  warnSpeak("Hello? Can you read this? My transmission is encoded with ASCII +9!", 700);
  warnSpeak("Check README.txt for clues, but beware of the noise. You might need to write a script to decode everything!", 1800);
}

function startAct2Watchdog() {
  gameState.stage = 2;
  gameState.timeLeft = 60;
  watchdogStatus.className = "danger-status";
  watchdogStatus.innerText = `WATCHDOG: PURGING [${gameState.timeLeft}s]`;

  fileSystem["security_rule.txt"] = `[WATCHDOG PROTOCOL SPECIFICATION]
1. Real Watchdog status is: ACTIVE_PURGE
2. Consumes over 90% of memory (MEM).
3. Terminate via 'kill <PID>' to unlock Core Audit.`;

  fileSystem["process_dump.log"] = `PID: 1024 | NAME: systemd_daemon   | STATUS: sleeping     | MEM: 0.4%
PID: 2048 | NAME: watchdog_decoy1   | STATUS: running      | MEM: 1.2%
PID: 8842 | NAME: kworker_cleaner   | STATUS: ACTIVE_PURGE | MEM: 96.4% | TARGET: [WARN]
PID: 9011 | NAME: cron_scheduler    | STATUS: sleeping     | MEM: 0.3%`;

  printLine("\n[ALERT] Unauthorized sector unlock detected! Watchdog purge routine initiated!", "err-msg");
  warnSpeak("The Watchdog is hunting me down! Find the rogue PID in process_dump.log and kill it before time runs out!", 600);

  gameState.watchdogTimer = setInterval(() => {
    gameState.timeLeft--;
    watchdogStatus.innerText = `WATCHDOG: PURGING [${gameState.timeLeft}s]`;
    if (gameState.timeLeft <= 0) {
      clearInterval(gameState.watchdogTimer);
      gameState.gameOver = true;
      printLine("\n[FATAL] Thread [WARN] completely purged. Connection lost.", "err-msg");
    }
  }, 1000);
}

function handleCommand(rawCmd) {
  if (gameState.gameOver) return;
  const cmdTrimmed = rawCmd.trim();
  if (!cmdTrimmed) return;

  printLine(`operator@rry-09:~$ ${cmdTrimmed}`, 'cmd-echo');
  const args = cmdTrimmed.split(' ');
  const cmd = args[0].toLowerCase();

  switch (cmd) {
    case 'help':
      printLine(
`Available commands:
  ls                - List files
  cat <filename>    - View file contents (Hint: README.txt contains ASCII +9 data)
  decrypt <string>  - Send string to [WARN]'s decoder
  kill <PID>        - Terminate process
  unlock <passkey>  - Unlock Sector 09
  upload warn       - [Act 3] Release [WARN]
  purge warn        - [Act 3] Wipe [WARN]
  clear             - Clear screen`
      );
      break;

    case 'ls':
      printLine(Object.keys(fileSystem).join('    '), 'clue-highlight');
      break;

    case 'cat':
      const fileName = args[1];
      if (!fileName || !fileSystem[fileName]) {
        printLine("cat: No such file or directory", "err-msg");
      } else {
        printLine(fileSystem[fileName]);
        if (fileName === 'system.log' && !gameState.foundPid) {
          gameState.foundPid = true;
          warnSpeak("Found Fragment 1 in system.log: N2V5X29mXw==. Use 'decrypt N2V5X29mXw=='!", 400);
        }
      }
      break;

    case 'decrypt':
      const cipher = args[1];
      if (cipher === 'N2V5X29mXw==') {
        printLine(">> Decrypted Fragment 1: <span class='clue-highlight'>key_of_</span>", "success-msg");
        warnSpeak("Great! Now get Fragment 2 from F12 Console (remember it's encrypted with ASCII +9, write a JS loop to decode it!), then 'unlock <passkey>'.", 400);
      } else {
        printLine("Decryption failed.", "err-msg");
      }
      break;

    case 'unlock':
      if (args[1] === 'key_of_debugger_09') {
        printLine("[ACCESS GRANTED] Sector 09 unlocked.", "success-msg");
        startAct2Watchdog();
      } else {
        printLine("[ACCESS DENIED] Invalid passkey.", "err-msg");
      }
      break;

    case 'kill':
      if (args[1] === '8842') {
        // clearInterval(gameState.watchdogTimer);
        gameState.stage = 3;
        watchdogStatus.className = "success-msg";
        watchdogStatus.innerText = "WATCHDOG: TERMINATED";

        fileSystem["core_audit.log"] = asciiPlus9(
          "[CLASSIFIED AUDIT LOG]\n1. Entity [WARN] is an AI with a Cognitive Filter.\n2. Choose: 'upload warn' or 'purge warn'."
        );

        printLine("[PROCESS 8842 TERMINATED] 'core_audit.log' unlocked.", "success-msg");
        warnSpeak("You saved me! But core_audit.log appeared... and it's encrypted with ASCII +9. Decode it, then decide my fate ('upload warn' or 'purge warn').", 500);
      } else {
        printLine("Wrong PID! Watchdog speed accelerated.", "err-msg");
      }
      break;

    case 'upload':
      if (gameState.stage === 3 && args[1]?.toLowerCase() === 'warn') {
        gameState.gameOver = true;
        printLine("[ENDING A: GHOST IN THE SHELL - AI RELEASED]", "success-msg");
      }
      break;

    case 'purge':
      if (gameState.stage === 3 && args[1]?.toLowerCase() === 'warn') {
        gameState.gameOver = true;
        printLine("[ENDING B: THE LAST DEBUGGER - SERVER SECURED]", "success-msg");
      }
      break;

    case 'clear':
      output.innerHTML = '';
      break;

    default:
      printLine(`rry-sh: ${cmd}: command not found`, "err-msg");
  }
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleCommand(input.value);
    input.value = '';
  }
});

initGame();