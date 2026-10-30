document.addEventListener('DOMContentLoaded', () => {
    const output = document.getElementById('terminal-output');
    const input = document.getElementById('cmd-input');


    // 前端維護的遊戲狀態
    const gameState = {
        currentArea: 0,
    };

    // 渲染純文字訊息
    function printText(text, className = 'sys-msg') {
        const div = document.createElement('div');
        div.className = className;
        div.textContent = text;
        output.appendChild(div);
        output.scrollTop = output.scrollHeight;
    }

    // 渲染 HTML 格式訊息
    function printHtml(html, className = 'sys-msg') {
        const div = document.createElement('div');
        div.className = className;
        div.innerHTML = html;
        output.appendChild(div);
        output.scrollTop = output.scrollHeight;
    }

    // 初始化遊戲畫面
    function initGame() {
        printText("========================================", "sys-msg");
        printText("              SYSTEM v1.0               ", "success-msg");
        printText("========================================", "sys-msg");
        printText("Type 'help' to see available commands.", "sys-msg");
    }

    function processCommand(cmd) {
        const trimmed = cmd.trim();
        const parts = trimmed.split(' ');
        const action = parts[0].toLowerCase();

        // 回顯使用者指令
        printText(`user@system:~$ ${cmd}`, "cmd-echo");

        switch (action) {
            case 'help':
                printText("Available commands:", "sys-msg");
                printText("  help           - Show this help list", "sys-msg");
                printText("  clear          - Clear terminal screen", "sys-msg");
                printText("  status         - Show current stage and score", "sys-msg");
                printText("  connect <x> <y>- Connect to coordinates", "sys-msg");
                break;

            case 'clear':
                output.innerHTML = '';
                break;

            case 'status':
                printText(`STATUS -> Stage: ${gameState.currentArea}`, "warn-msg");
                break;

            case 'connect':
                const pos_x = parts[1];
                const pos_y = parts[2];
                if (!pos_x || !pos_y) {
                    printText("Usage: connect <x> <y>", "err-msg");
                }
                else{
                    // 判斷邏輯
                }
                break;

            default:
                printText(`Command not found: ${action}. Type 'help' for options.`, "err-msg");
                break;
        }
    }

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const cmd = input.value;
            input.value = '';
            if (!cmd.trim()) return;
            processCommand(cmd);
        });
    }

    // 啟動初始化
    initGame();
});