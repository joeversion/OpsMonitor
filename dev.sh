#!/bin/bash
# OpsMonitor Development Startup Script for Linux/Mac
# Automatically installs dependencies, cleans old processes, and starts both services

set -e

SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)"
ROOT_PATH="$SCRIPT_PATH"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting OpsMonitor Dev Environment...${NC}\n"

# Check if npm is available
echo -e "${YELLOW}Checking Node.js environment...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed. Please install Node.js first.${NC}"
    echo -e "${CYAN}Download from: https://nodejs.org/${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Node.js found: $(node --version)${NC}"
echo -e "${GREEN}[OK] npm found: $(npm --version)${NC}"

# Install dependencies if node_modules doesn't exist
echo -e "\n${YELLOW}Checking dependencies...${NC}"
if [ ! -d "$ROOT_PATH/backend/node_modules" ]; then
    echo -e "${CYAN}Installing backend dependencies...${NC}"
    (cd "$ROOT_PATH/backend" && npm install)
    echo -e "${GREEN}[OK] Backend dependencies installed${NC}"
fi

if [ ! -d "$ROOT_PATH/frontend/node_modules" ]; then
    echo -e "${CYAN}Installing frontend dependencies...${NC}"
    (cd "$ROOT_PATH/frontend" && npm install)
    echo -e "${GREEN}[OK] Frontend dependencies installed${NC}"
fi

# Clean up all old processes
echo -e "\n${YELLOW}Stopping all old OpsMonitor processes...${NC}"

KILLED_COUNT=0

# Method 1: Kill by process pattern (backend and frontend)
echo -e "${YELLOW}Checking for old processes by pattern...${NC}"

# Find all OpsMonitor related processes (including old dev.sh scripts)
ALL_OLD_PIDS=$(pgrep -f "OpsMonitor.*(backend|frontend|dev\.sh)" 2>/dev/null || true)

if [ -n "$ALL_OLD_PIDS" ]; then
    COUNT=$(echo "$ALL_OLD_PIDS" | wc -w)
    echo -e "${YELLOW}  Found $COUNT old process(es), stopping...${NC}"
    echo "$ALL_OLD_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED_COUNT=$((KILLED_COUNT + COUNT))
fi

# Method 2: Kill by port (3000 for backend, 5173 for frontend)
echo -e "${YELLOW}Checking ports 3000 and 5173...${NC}"

# Kill process on port 3000 (backend)
if command -v lsof &> /dev/null; then
    PORT_3000_PID=$(lsof -ti :3000 2>/dev/null || true)
    if [ -n "$PORT_3000_PID" ]; then
        echo -e "${YELLOW}  Killing process on port 3000 (PID: $PORT_3000_PID)${NC}"
        kill -9 $PORT_3000_PID 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
    
    # Kill process on port 5173 (frontend)
    PORT_5173_PID=$(lsof -ti :5173 2>/dev/null || true)
    if [ -n "$PORT_5173_PID" ]; then
        echo -e "${YELLOW}  Killing process on port 5173 (PID: $PORT_5173_PID)${NC}"
        kill -9 $PORT_5173_PID 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
fi

# Wait for cleanup
if [ $KILLED_COUNT -gt 0 ]; then
    sleep 2
    echo -e "${GREEN}[OK] Stopped $KILLED_COUNT old process(es)${NC}"
else
    echo -e "${GREEN}[OK] No old processes found${NC}"
fi

# Function to start a process in a new terminal
start_in_terminal() {
    local name="$1"
    local dir="$2"
    local cmd="$3"
    
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --title="$name" -- bash -c "cd '$dir' && $cmd; exec bash"
    elif command -v xterm &> /dev/null; then
        xterm -T "$name" -e "cd '$dir' && $cmd; exec bash" &
    elif command -v konsole &> /dev/null; then
        konsole --new-tab -p tabtitle="$name" -e bash -c "cd '$dir' && $cmd; exec bash" &
    elif command -v tmux &> /dev/null; then
        # Use tmux if no GUI terminal available
        tmux new-session -d -s "$name" "cd '$dir' && $cmd"
        echo -e "${CYAN}Started $name in tmux session. Use 'tmux attach -t $name' to view.${NC}"
    else
        # Fallback: run in background
        echo -e "${YELLOW}No terminal emulator found. Running $name in background...${NC}"
        (cd "$dir" && $cmd > "/tmp/$name.log" 2>&1 &)
        echo -e "${CYAN}$name started in background. Logs: /tmp/$name.log${NC}"
    fi
}

# Start Backend
echo -e "\n${CYAN}Starting Backend...${NC}"
start_in_terminal "ServiceMonitor-Backend" "$ROOT_PATH/backend" "npm run dev"

# Wait for backend to be ready (check if port 3000 is listening)
echo -e "${YELLOW}Waiting for backend to start...${NC}"
MAX_WAIT_SECONDS=15  # Reduced to 15 seconds, because /health endpoint starts quickly
WAITED_SECONDS=0
BACKEND_READY=false

while [ "$BACKEND_READY" = false ] && [ $WAITED_SECONDS -lt $MAX_WAIT_SECONDS ]; do
    sleep 2
    WAITED_SECONDS=$((WAITED_SECONDS + 2))
    
    # Check if port 3000 is listening
    PORT_CHECK=""
    if command -v ss &> /dev/null; then
        PORT_CHECK=$(ss -tlnp 2>/dev/null | grep ":3000 " || true)
    elif command -v netstat &> /dev/null; then
        PORT_CHECK=$(netstat -tlnp 2>/dev/null | grep ":3000 " || true)
    elif command -v lsof &> /dev/null; then
        PORT_CHECK=$(lsof -i :3000 2>/dev/null | grep LISTEN || true)
    fi
    
    if [ -n "$PORT_CHECK" ]; then
        # Check using /health endpoint for fast startup
        if command -v curl &> /dev/null; then
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://localhost:3000/health" 2>/dev/null || echo "000")
            if [ "$HTTP_CODE" = "200" ]; then
                BACKEND_READY=true
                echo -e "${GREEN}[OK] Backend is ready! (took $WAITED_SECONDS seconds)${NC}"
            else
                echo -e "${YELLOW}  Port 3000 is open, waiting for health endpoint... ($WAITED_SECONDS/$MAX_WAIT_SECONDS seconds)${NC}"
            fi
        else
            # No curl, assume ready if port is open
            BACKEND_READY=true
            echo -e "${GREEN}[OK] Backend port 3000 is open! (took $WAITED_SECONDS seconds)${NC}"
        fi
    else
        echo -e "${YELLOW}  Waiting for backend... ($WAITED_SECONDS/$MAX_WAIT_SECONDS seconds)${NC}"
    fi
done

if [ "$BACKEND_READY" = false ]; then
    echo -e "\n${RED}Warning: Backend did not respond within $MAX_WAIT_SECONDS seconds.${NC}"
    echo -e "${YELLOW}Starting frontend anyway. Please check the backend terminal for errors.${NC}"
fi

# Start Frontend
echo -e "\n${CYAN}Starting Frontend...${NC}"
start_in_terminal "ServiceMonitor-Frontend" "$ROOT_PATH/frontend" "npm run dev"

echo -e "\n${GREEN}=== Done! Both services are starting ===${NC}"
echo -e "${CYAN}Backend:  http://localhost:3000${NC}"
echo -e "${CYAN}Frontend: http://localhost:5173${NC}"

# If using tmux, show helpful message
if command -v tmux &> /dev/null && ! command -v gnome-terminal &> /dev/null && ! command -v xterm &> /dev/null && ! command -v konsole &> /dev/null; then
    echo ""
    echo -e "${GREEN}Using tmux sessions. Quick commands:${NC}"
    echo -e "  ${CYAN}tmux attach -t ServiceMonitor-Backend${NC}  - View backend logs"
    echo -e "  ${CYAN}tmux attach -t ServiceMonitor-Frontend${NC} - View frontend logs"
    echo -e "  ${CYAN}tmux kill-session -t ServiceMonitor-Backend${NC}  - Stop backend"
    echo -e "  ${CYAN}tmux kill-session -t ServiceMonitor-Frontend${NC} - Stop frontend"
fi

echo ""
