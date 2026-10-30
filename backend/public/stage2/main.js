sessionStorage.setItem('active_stage_url', window.location.pathname);

const output = document.getElementById('terminal-output');
const input = document.getElementById('cmd-input');
const watchdogStatus = document.getElementById('watchdog-status');

const API_BASE = '/api/warn-shell';

const state = {
  sessionId: null,
  gameOver: false,
  watchdogDeadline: 0,
};

function printHtml(html, className = 'sys-msg') {
  const div = document.createElement('div');
  div.className = className;
  div.innerHTML = html;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

function printText(text, className = 'sys-msg') {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  output.appendChild(div);
  output.scrollTop = output.scrollHeight;
}

function printConsolePacket(text) {
  console.log(
    `%c[WARN // ASCII +9 ENCRYPTED PACKET IN CONSOLE]%c\n${text}\n\n` +
    `(Hint: Write a script in this Console to subtract 9 from each character code!)`,
    'color: #ffaa00; font-weight: bold; background: #111; padding: 3px;',
    'color: #ccc;'
  );
}

function applyLines(lines) {
  for (const line of lines || []) {
    const fire = () => {
      if (line.console) printConsolePacket(line.text);
      else printHtml(line.text, line.className || 'sys-msg');
    };
    if (line.delay > 0) setTimeout(fire, line.delay);
    else fire();
  }
}

function updateWatchdogUI(watchdog) {
  if (!watchdog?.active) {
    watchdogStatus.innerText = 'WATCHDOG: STANDBY';
    watchdogStatus.className = 'warn-status';
    return;
  }
  watchdogStatus.innerText = `WATCHDOG: PURGING [${watchdog.secondsLeft}s]`;
  watchdogStatus.className = watchdog.secondsLeft <= 15 ? 'danger-status' : 'warn-status';
}

async function startGame() {
  try {
    const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
    const data = await res.json();
    if (data.error) return printText(`[SYSTEM ERROR: ${data.error}]`, 'err-msg');
    state.sessionId = data.sessionId;
    state.gameOver = false;
    applyLines(data.lines);
  } catch (err) {
    printText(`[SYSTEM ERROR: ${err.message}]`, 'err-msg');
  }
}

async function sendCommand(cmd) {
  if (!state.sessionId || state.gameOver) return;
  printText(`operator@rry-09:~$ ${cmd}`, 'cmd-echo');
  try {
    const res = await fetch(`${API_BASE}/cmd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, cmd }),
    });
    const data = await res.json();
    if (data.error) return printText(`[SYSTEM ERROR: ${data.error}]`, 'err-msg');
    applyLines(data.lines);
    if (data.state) {
      state.gameOver = data.state.gameOver;
      state.watchdogDeadline = data.state.watchdog?.active
        ? Date.now() + data.state.watchdog.secondsLeft * 1000
        : 0;
      updateWatchdogUI(data.state.watchdog);
    }
  } catch (err) {
    printText(`[SYSTEM ERROR: ${err.message}]`, 'err-msg');
  }
}

const cmdHistory = [];
let historyIndex = -1;

input.addEventListener('keydown', (e) => {
  // 處理向上鍵
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cmdHistory.length > 0) {
      if (historyIndex === -1) historyIndex = cmdHistory.length;
      if (historyIndex > 0) {
        historyIndex--;
        input.value = cmdHistory[historyIndex];
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    return;
  }
  // 處理向下鍵
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex !== -1 && historyIndex < cmdHistory.length - 1) {
      historyIndex++;
      input.value = cmdHistory[historyIndex];
      input.setSelectionRange(input.value.length, input.value.length);
    } else {
      historyIndex = cmdHistory.length;
      input.value = '';
    }
    return;
  }

  if (e.key !== 'Enter') return;
  const cmd = input.value;
  input.value = '';
  if (!cmd.trim()) return;

  // 👈 存入歷史紀錄
  const trimmedCmd = cmd.trim();
  if (cmdHistory.length === 0 || cmdHistory[cmdHistory.length - 1] !== trimmedCmd) {
    cmdHistory.push(trimmedCmd);
  }
  historyIndex = cmdHistory.length;

  if (cmd.trim().toLowerCase() === 'clear') {
    output.innerHTML = '';
    return;
  }
  sendCommand(cmd);
});

// 每秒更新 watchdog UI，時間到請求後端確認
setInterval(async () => {
  if (!state.sessionId || state.gameOver || !state.watchdogDeadline) return;
  const secondsLeft = Math.max(0, Math.ceil((state.watchdogDeadline - Date.now()) / 1000));
  updateWatchdogUI({ active: true, secondsLeft });
  if (secondsLeft <= 0) {
    try {
      const res = await fetch(`${API_BASE}/tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId }),
      });
      const data = await res.json();
      if (data.lines?.length) applyLines(data.lines);
      if (data.state?.gameOver) {
        state.gameOver = true;
        updateWatchdogUI(data.state.watchdog);
      }
    } catch { /* 忽略網路錯誤 */ }
  }
}, 1000);

startGame();