#!/bin/bash

# ==============================================================================
# Light Template - One-command Setup
# ==============================================================================
# Prerequisites: Python 3.12+, Node.js 18+
# Usage: ./setup.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}LightApp Project Setup${NC}"
echo -e "${BLUE}=========================================${NC}"

# Check prerequisites
echo -e "\n${BLUE}Checking prerequisites...${NC}"

if ! command -v python3 &>/dev/null; then
    echo -e "${RED}ERROR: Python 3 not found.${NC}"
    exit 1
fi
echo -e "  Python: ${GREEN}$(python3 --version)${NC}"

if ! command -v node &>/dev/null; then
    echo -e "${RED}ERROR: Node.js not found.${NC}"
    exit 1
fi
echo -e "  Node.js: ${GREEN}$(node --version)${NC}"

# Backend
echo -e "\n${BLUE}Setting up backend...${NC}"
cd "$SCRIPT_DIR/backend"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "  ${GREEN}Created Python venv${NC}"
fi

./venv/bin/pip install --upgrade pip -q 2>&1 | tail -1
./venv/bin/pip install -r requirements.txt -q 2>&1 | tail -1
echo -e "  ${GREEN}Dependencies installed${NC}"

# Frontend
echo -e "\n${BLUE}Setting up frontend...${NC}"
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    npm install --silent 2>&1 | tail -3
    echo -e "  ${GREEN}npm packages installed${NC}"
else
    echo -e "  ${GREEN}node_modules already exists${NC}"
fi

# Done
echo -e "\n${BLUE}=========================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "\nTo start: ${GREEN}./run.sh start${NC}"
