#!/bin/bash

# ThingsBoard租户模板自动复制工具
# 功能：在创建新租户后自动应用模板配置

# 配置信息
TB_URL="http://localhost:8080"
ADMIN_USERNAME="sysadmin@thingsboard.org"
ADMIN_PASSWORD="sysadmin"
TEMPLATE_DIR="/root/thingsboard/tenant_templates/default"

# 命令参数
ACTION=$1   # create 或 apply
NEW_TENANT_EMAIL=$2
NEW_TENANT_TITLE=${3:-"新租户"}

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # 恢复默认颜色

# 错误检查
if [ -z "$ACTION" ]; then
  echo -e "${RED}错误：缺少操作参数。用法：$0 [create|apply] <email> [title]${NC}"
  exit 1
fi

# 登录并获取令牌
login() {
  echo -e "${BLUE}正在登录ThingsBoard...${NC}"
  
  local response=$(curl -s -X POST "$TB_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
  
  # 提取令牌
  TOKEN=$(echo $response | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}登录失败！请检查用户名和密码。${NC}"
    exit 1
  else
    echo -e "${GREEN}登录成功！${NC}"
  fi
}

# 创建新租户
create_tenant() {
  if [ -z "$NEW_TENANT_EMAIL" ]; then
    echo -e "${RED}错误：创建租户需要提供邮箱参数${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}正在创建新租户: $NEW_TENANT_TITLE (邮箱: $NEW_TENANT_EMAIL)...${NC}"
  
  # 创建租户
  local response=$(curl -s -X POST "$TB_URL/api/tenant" \
    -H "Content-Type: application/json" \
    -H "X-Authorization: Bearer $TOKEN" \
    -d "{
      \"title\": \"$NEW_TENANT_TITLE\",
      \"email\": \"$NEW_TENANT_EMAIL\",
      \"additionalInfo\": {
        \"description\": \"自动创建的租户\"
      }
    }")
  
  # 提取租户ID
  TENANT_ID=$(echo $response | grep -o '"id":{"id":"[^"]*' | cut -d'"' -f6)
  
  if [ -z "$TENANT_ID" ]; then
    echo -e "${RED}创建租户失败！错误：$response${NC}"
    exit 1
  else
    echo -e "${GREEN}租户创建成功！ID: $TENANT_ID${NC}"
  fi
}

# 应用模板到租户
apply_template() {
  local tenant_id=$1
  
  if [ -z "$tenant_id" ]; then
    echo -e "${RED}错误：未指定租户ID${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}正在应用模板配置到租户 $tenant_id...${NC}"
  
  # 检查模板目录
  if [ ! -d "$TEMPLATE_DIR" ]; then
    echo -e "${RED}错误：模板目录不存在: $TEMPLATE_DIR${NC}"
    exit 1
  fi
  
  # 调用Node.js脚本进行模板导入
  node /root/thingsboard/scripts/tenant_template_manager.js import $tenant_id $TEMPLATE_DIR
  
  echo -e "${GREEN}模板应用完成！${NC}"
}

# 主流程
main() {
  # 登录获取令牌
  login
  
  case $ACTION in
    create)
      # 创建租户并应用模板
      create_tenant
      apply_template $TENANT_ID
      ;;
    apply)
      # 仅应用模板到现有租户
      if [ -z "$NEW_TENANT_EMAIL" ]; then
        echo -e "${RED}错误：应用模板需要提供租户ID${NC}"
        exit 1
      fi
      apply_template $NEW_TENANT_EMAIL
      ;;
    *)
      echo -e "${RED}错误：不支持的操作 '$ACTION'。支持的操作: create, apply${NC}"
      exit 1
      ;;
  esac
  
  echo -e "${GREEN}操作完成！${NC}"
}

# 执行主流程
main
