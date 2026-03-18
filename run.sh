#!/bin/bash

# ==============================================================================
# Template - Master Control Script
# ==============================================================================

VERSION="1.2.0"
PROJECT_NAME="Localingo"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_PYTHON="$SCRIPT_DIR/backend/venv/bin/python"
BACKEND_DIR="$SCRIPT_DIR/backend"
PROJECT_NAME_LOWER="$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]')"
BACKEND_LOG="/tmp/${PROJECT_NAME_LOWER}_backend.log"

FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_LOG="/tmp/${PROJECT_NAME_LOWER}_frontend.log"

PORTS_FILE="$SCRIPT_DIR/.run_ports"
DEFAULT_BACKEND_PORT=8050
DEFAULT_FRONTEND_PORT=3050

if [ -f "$PORTS_FILE" ]; then
    source "$PORTS_FILE"
else
    BACKEND_PORT=$DEFAULT_BACKEND_PORT
    FRONTEND_PORT=$DEFAULT_FRONTEND_PORT
fi

get_free_port() {
    local port=$1
    # lsof-only: no file-based allocation, no stale state
    while lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

# ── Helpers ───────────────────────────────────────────────────────────────────

show_help() {
    echo -e "${BLUE}${PROJECT_NAME} Control Script (v${VERSION})${NC}"
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start Backend and Frontend in the background on free ports"
    echo "  stop      Stop all running ${PROJECT_NAME} servers"
    echo "  restart   Stop and restart all servers"
    echo "  status    Show whether servers are running on assigned ports"
    echo "  live      Start servers if needed, then stream live logs"
    echo "  -h|help   Show this help message"
    echo "  -v        Show version"
}

check_status() {
    echo -e "${BLUE}--- System Status ---${NC}"
    if lsof -ti:${BACKEND_PORT} >/dev/null 2>&1; then
        echo -e "Backend  (FastAPI)  is ${GREEN}RUNNING${NC} on port ${BACKEND_PORT}"
    else
        echo -e "Backend  (FastAPI)  is ${RED}STOPPED${NC}"
    fi
    if lsof -ti:${FRONTEND_PORT} >/dev/null 2>&1; then
        echo -e "Frontend (Next.js)  is ${GREEN}RUNNING${NC} on port ${FRONTEND_PORT}"
    else
        echo -e "Frontend (Next.js)  is ${RED}STOPPED${NC}"
    fi
}

_kill_all() {
    lsof -ti:${BACKEND_PORT}  2>/dev/null | xargs kill -9 2>/dev/null || true
    lsof -ti:${FRONTEND_PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true

    # Catch any orphaned processes operating out of these discrete directories
    pkill -9 -f "$BACKEND_DIR" 2>/dev/null || true
    pkill -9 -f "$FRONTEND_DIR" 2>/dev/null || true
}

_wait_ports_free() {
    local max=${1:-10}
    local i=0
    while (lsof -ti:${BACKEND_PORT} >/dev/null 2>&1 || lsof -ti:${FRONTEND_PORT} >/dev/null 2>&1) && [ $i -lt $max ]; do
        sleep 1
        i=$((i + 1))
    done
    if lsof -ti:${BACKEND_PORT} >/dev/null 2>&1 || lsof -ti:${FRONTEND_PORT} >/dev/null 2>&1; then
        echo -e "${RED}WARNING: Ports still occupied after ${max}s. Forcing sweep...${NC}"
        _kill_all
        sleep 2
    fi
}

# ── Core actions ──────────────────────────────────────────────────────────────

stop_servers() {
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${RED}Shutting down ${PROJECT_NAME}...${NC}"
    echo -e "${BLUE}=========================================${NC}"
    _kill_all
    _wait_ports_free 8

    rm -f "$PORTS_FILE"
    echo -e "${GREEN}Shutdown complete. All ports freed.${NC}"
}

start_servers() {
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${GREEN}Starting ${PROJECT_NAME}...${NC}"
    echo -e "${BLUE}=========================================${NC}"

    if [ ! -f "$BACKEND_PYTHON" ]; then
        echo -e "${RED}ERROR: Python venv not found at $BACKEND_PYTHON${NC}"
        echo -e "Please run:  cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt"
        exit 1
    fi

    BACKEND_PORT=$(get_free_port $DEFAULT_BACKEND_PORT)
    FRONTEND_PORT=$(get_free_port $DEFAULT_FRONTEND_PORT)
    echo "BACKEND_PORT=$BACKEND_PORT" > "$PORTS_FILE"
    echo "FRONTEND_PORT=$FRONTEND_PORT" >> "$PORTS_FILE"

    _kill_all
    sleep 1

    echo "1) Starting FastAPI Backend on port ${BACKEND_PORT}..."
    : > "$BACKEND_LOG"
    (cd "$BACKEND_DIR" && PYTHONUNBUFFERED=1 nohup "$BACKEND_PYTHON" -u -c \
        "import uvicorn; uvicorn.run('main:app', host='0.0.0.0', port=${BACKEND_PORT}, reload=True)" \
        >> "$BACKEND_LOG" 2>&1 &)

    echo "2) Starting Next.js Frontend on port ${FRONTEND_PORT}..."
    : > "$FRONTEND_LOG"
    rm -f "$FRONTEND_DIR/.next/dev/lock"
    (cd "$FRONTEND_DIR" && NEXT_PUBLIC_BACKEND_PORT=$BACKEND_PORT nohup npx next dev -p ${FRONTEND_PORT} \
        >> "$FRONTEND_LOG" 2>&1 &)

    echo -n "   Waiting for backend to be ready"
    local waited=0
    while ! lsof -ti:${BACKEND_PORT} >/dev/null 2>&1 && [ $waited -lt 20 ]; do
        sleep 1
        waited=$((waited + 1))
        echo -n "."
    done
    echo ""

    if lsof -ti:${BACKEND_PORT} >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend ready${NC}"
    else
        echo -e "${YELLOW}⚠ Backend may still be starting. Check: tail -f $BACKEND_LOG${NC}"
    fi

    echo -e "${GREEN}Both servers launched!${NC}"
    echo -e "  Backend API : ${BLUE}http://localhost:${BACKEND_PORT}${NC}"
    echo -e "  Frontend UI : ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
    echo    "  Logs        : $BACKEND_LOG  |  $FRONTEND_LOG"
}

live_logs() {
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${GREEN}${PROJECT_NAME} — Live Log Monitor${NC}"
    echo -e "${BLUE}=========================================${NC}"

    local backend_up=false
    local frontend_up=false
    lsof -ti:${BACKEND_PORT}  >/dev/null 2>&1 && backend_up=true
    lsof -ti:${FRONTEND_PORT} >/dev/null 2>&1 && frontend_up=true

    if ! $backend_up || ! $frontend_up; then
        echo -e "${YELLOW}Starting servers for log monitor...${NC}"
        start_servers
        sleep 2
    fi

    touch "$BACKEND_LOG" "$FRONTEND_LOG"
    echo -e "\n${YELLOW}Streaming logs (Ctrl+C to stop monitoring):${NC}\n"
    tail -n 30 -f "$BACKEND_LOG" "$FRONTEND_LOG"
}

# ── Entry point ───────────────────────────────────────────────────────────────

case "$1" in
    start) start_servers ;;
    stop) stop_servers ;;
    restart) stop_servers; sleep 2; start_servers ;;
    status) check_status ;;
    live) live_logs ;;
    -h|--h|help) show_help ;;
    -v|--v|version) echo -e "${PROJECT_NAME} Control Script version ${GREEN}${VERSION}${NC}" ;;
    *) echo -e "${RED}Error: Unknown command '$1'${NC}"; show_help; exit 1 ;;
esac
