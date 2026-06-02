#!/usr/bin/env bash
# FieldOps Control System — Initial Setup Script
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BOLD}FieldOps Control System — Setup${NC}"
echo "========================================"

# Check requirements
echo -e "\n${YELLOW}Checking requirements...${NC}"
command -v node >/dev/null 2>&1 || { echo -e "${RED}Node.js 20+ required${NC}"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}pnpm 9+ required. Install: npm install -g pnpm@9${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker required${NC}"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v "docker compose" >/dev/null 2>&1 || { echo -e "${RED}Docker Compose required${NC}"; exit 1; }

echo -e "${GREEN}✓ All requirements met${NC}"

# Setup .env
if [ ! -f .env ]; then
  echo -e "\n${YELLOW}Creating .env from .env.example...${NC}"
  cp .env.example .env
  echo -e "${GREEN}✓ .env created — PLEASE edit it with your real values before proceeding!${NC}"
  echo -e "${YELLOW}Required: DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, INTERNAL_SERVICE_SECRET${NC}"
  read -p "Press ENTER after editing .env to continue..."
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Build shared packages
echo -e "\n${YELLOW}Building shared packages...${NC}"
pnpm --filter @field-ops/shared build
echo -e "${GREEN}✓ Shared packages built${NC}"

# Generate Prisma client
echo -e "\n${YELLOW}Generating Prisma client...${NC}"
pnpm --filter @field-ops/db generate
echo -e "${GREEN}✓ Prisma client generated${NC}"

echo -e "\n${BOLD}${GREEN}Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your production values"
echo "  2. Run: ${BOLD}docker-compose up -d postgres redis${NC}"
echo "  3. Run: ${BOLD}pnpm db:migrate${NC}"
echo "  4. Run: ${BOLD}pnpm db:seed${NC}"
echo "  5. Run: ${BOLD}docker-compose up -d${NC}"
echo ""
echo "Development:"
echo "  API:        ${BOLD}pnpm --filter @field-ops/api dev${NC}"
echo "  Dashboard:  ${BOLD}pnpm --filter @field-ops/dashboard dev${NC}"
echo "  DB Studio:  ${BOLD}pnpm db:studio${NC}"
