#!/bin/bash

# 顏色設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${RED}=========================================${NC}"
echo -e "${RED}      ⚠️  DANGER ZONE: SCORE RESET ⚠️${NC}"
echo -e "${RED}=========================================${NC}"
echo -e "This will WIPE ALL SCORES and PROGRESS for all groups."
echo -e "Tables to be truncated:"
echo -e " - grouppoint_points"
echo -e " - warn_shell_progress"
echo -e " - position_penalty"
echo -e " - password_solved"
echo -e ""

# 第一重驗證
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Aborted. No data was deleted.${NC}"
    exit 1
fi

# 第二重驗證
echo -e "${YELLOW}To confirm, type exactly: RESET-ALL-SCORES${NC}"
read -p "> " confirmation

if [ "$confirmation" != "RESET-ALL-SCORES" ]; then
    echo -e "${RED}Verification failed. Aborted.${NC}"
    exit 1
fi

echo -e "${YELLOW}Executing database wipe...${NC}"

# 執行清空 (TRUNCATE 會連同 ID 序列一起重置，且速度極快)
docker compose exec -T db psql -U postgres -d postgres -c "
TRUNCATE TABLE 
  grouppoint_points, 
  warn_shell_progress, 
  position_penalty, 
  password_solved 
RESTART IDENTITY CASCADE;
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ All scores and progress have been successfully wiped!${NC}"
else
    echo -e "${RED}❌ Failed to wipe database. Please check the logs.${NC}"
fi