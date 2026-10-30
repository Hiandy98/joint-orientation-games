# 🚨 計分與進度重置操作手冊 (Danger Zone)

本文件說明如何清空遊戲中所有組別的**計分與遊玩進度**。此操作通常用於**活動正式開始前**的環境清理，或是**測試完畢後**的資料重置。

> ⚠️ **極度危險警告**
> 執行此腳本後，所有組別的分數、解謎進度（包含 WarnShell 里程碑、密碼通過紀錄等）將會**永久刪除，無法復原**。請務必確認活動已經結束或尚未開始。

---

## 🛠️ 前置準備

1. 確保你已經透過 SSH 進入伺服器，並切換到專案根目錄：
   ```bash
   cd ~/joint-orientation-games
   ```
2. 確保 Docker 容器正在運行中：
   ```bash
   docker compose ps
   ```
   *(如果 `db` 和 `backend` 沒有顯示 `Up`，請先執行 `docker compose up -d`)*

---

## 🚀 執行重置

我們提供了一個帶有**雙重驗證**的腳本，防止手殘誤觸。

請在終端機輸入以下指令：

```bash
# 如果你是第一次執行（或者從 Git 拉下來後發現無法執行），請先給予執行權限：
chmod +x reset_scores.sh

# 執行重置腳本
./reset_scores.sh
```

> 💡 **免 chmod 小技巧**：如果你不想打 `chmod`，也可以直接使用 `bash reset_scores.sh` 來執行腳本。

### 第一步：確認執行
系統會顯示警告，並問你是否確定要繼續：
```text
Are you sure you want to proceed? (y/N) 
```
👉 請輸入 **`y`** 並按下 `Enter`。*(如果輸入其他字元，會直接取消)*

### 第二步：輸入終極密碼
系統會要求你輸入完整的確認字串：
```text
To confirm, type exactly: RESET-ALL-SCORES
> 
```
👉 請**手動輸入**大寫的 `RESET-ALL-SCORES` 並按下 `Enter`。*(只要拼錯一個字母，就會取消重置)*

### 第三步：完成
如果兩次驗證都通過，你將會看到以下成功畫面：
```text
Executing database wipe...
TRUNCATE TABLE
✅ All scores and progress have been successfully wiped!
```

---

## 🔍 腳本背後的機制 (給開發者參考)

如果你想知道 `reset_scores.sh` 到底做了什麼，它其實是對 PostgreSQL 資料庫執行了以下 SQL 指令：

```sql
TRUNCATE TABLE 
  grouppoint_points,      -- 組別總分
  warn_shell_progress,    -- WARN 遊戲進度與扣分
  position_penalty,       -- 座標驗證扣分紀錄
  password_solved         -- 密碼通過紀錄
RESTART IDENTITY CASCADE;
```
*   `TRUNCATE`：比 `DELETE` 更快，會直接清空整張表。
*   `RESTART IDENTITY`：如果有 Auto Increment 的 ID，會重置回 1。
*   `CASCADE`：如果有其他表依賴這些表，會連帶處理。

---

## 🚑 常見問題排除 (Troubleshooting)

### Q: 執行腳本時報錯 `relation "xxx" does not exist`？
**A:** 代表資料庫中沒有這張表（通常是因為新增了插件但忘記同步 Schema）。
**解法：** 先將缺少的表補齊，再執行腳本：
```bash
docker compose exec backend npx drizzle-kit push
```

### Q: 報錯 `Permission denied`？
**A:** 代表腳本沒有執行權限。
**解法：** 請執行 `chmod +x reset_scores.sh`，或者改用 `bash reset_scores.sh`。

### Q: 報錯 `permission denied` 或 `docker compose` 找不到？
**A:** 請確認你使用的是對的系統權限（例如需要 `sudo` 或是你是 Docker 群組的成員），並確認當前目錄是在 `docker-compose.yml` 所在的資料夾。

### Q: 我不小心重置了，資料救得回來嗎？
**A:** 救不回來。這也是為什麼我們設定兩道驗證機制。如果是測試環境，請重新註冊或透過前端重新遊玩以產生新資料。