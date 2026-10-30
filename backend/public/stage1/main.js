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
        printText("Finally, I've found the location of this AI, but it seems they've distributed the permissions across multiple servers.", "comment-msg")
        printText("So I've prepared this system—just enter the server ID and coordinates to connect.", "comment-msg")
        printText("Currently, I've only found server 1 at (0,0).", "comment-msg")
        printText("Try connect 1 0 0", "comment-msg")
    }

    async function checkPassword(password) {
        try {
            const response = await fetch('/api/passwordchecker/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', 
                body: JSON.stringify({
                    stage: 1,   // 數字型別
                    area: currentArea,     // 數字型別
                    password: password // 字串型別
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // 處理 400 (參數缺失)、401 (未登入)、404 (找不到密碼設定) 等錯誤
                console.error(`錯誤 (${response.status}):`, data.error);
                return;
            }

            // 成功取得回應
            if (data.valid) {
                console.log("驗證成功！", data.message);
                if (data.firstTime) {
                    printText("solve! +100 points", "sys-msg");
                } else {
                    printText("Previously solved. No duplicate points awarded", "sys-msg");
                }
            } else {
                printText("Incorrect password. -10 points", "sys-msg");
            }

        } catch (err) {
            console.error('網路錯誤或請求失敗:', err);
        }
    }

    function connectArea() {
        switch(currentArea) {
            

        }
        
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
                printText("  help              - Show this help list", "sys-msg");
                printText("  clear             - Clear terminal screen", "sys-msg");
                printText("  status            - Show current stage and score", "sys-msg");
                printText("  connect <x> <y>   - Connect to coordinates", "sys-msg");
                printText("  check <password>  - check password", "sys-msg");
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
            
            case 'check':
                const password = parts[1];
                if(!password){
                    printText("check <password>", "err-msg");
                }
                else{
                    checkPassword(password)
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