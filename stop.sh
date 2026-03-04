#!/bin/bash
# Stop OpsMonitor Development Services (Linux/Mac)
# Kills all running backend and frontend processes

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}Stopping OpsMonitor services...${NC}\n"

KILLED_COUNT=0

# Method 1: Kill by process pattern
echo -e "${CYAN}Stopping processes by pattern...${NC}"

# Find all OpsMonitor related processes (including dev.sh itself)
ALL_PIDS=$(pgrep -f "OpsMonitor.*(backend|frontend|dev\.sh)" 2>/dev/null || true)

if [ -n "$ALL_PIDS" ]; then
    COUNT=$(echo "$ALL_PIDS" | wc -w)
    echo -e "${YELLOW}  Found $COUNT OpsMonitor process(es):${NC}"
    
    # Print details of each process before stopping
    for PID in $ALL_PIDS; do
        if ps -p $PID > /dev/null 2>&1; then
            CMDLINE=$(ps -p $PID -o args= 2>/dev/null || echo "Unknown")
            
            # Determine type with clear description
            TYPE="Unknown"
            if echo "$CMDLINE" | grep -q "dev\.sh"; then
                TYPE="Dev Script - Startup Launcher"
            elif echo "$CMDLINE" | grep -q "backend"; then
                if echo "$CMDLINE" | grep -q "ts-node"; then
                    TYPE="Backend - TypeScript Runtime (ts-node)"
                elif echo "$CMDLINE" | grep -q "nodemon"; then
                    TYPE="Backend - File Watcher (nodemon)"
                else
                    TYPE="Backend - npm Launcher"
                fi
            elif echo "$CMDLINE" | grep -q "frontend"; then
                if echo "$CMDLINE" | grep -q "vite"; then
                    TYPE="Frontend - Dev Server (Vite)"
                else
                    TYPE="Frontend - npm Launcher"
                fi
            fi
            
            echo -e "    - PID $PID: $TYPE"
        fi
    done
    
    # Kill all processes
    echo "$ALL_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED_COUNT=$((KILLED_COUNT + COUNT))
fi

# Method 2: Kill by port
echo -e "${CYAN}Stopping processes by port...${NC}"

if command -v lsof &> /dev/null; then
    PORT_3000_PID=$(lsof -ti :3000 2>/dev/null || true)
    if [ -n "$PORT_3000_PID" ]; then
        PROC_NAME=$(ps -p $PORT_3000_PID -o comm= 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}  - Port 3000 (Backend): PID $PORT_3000_PID ($PROC_NAME)${NC}"
        kill -9 $PORT_3000_PID 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
    
    PORT_5173_PID=$(lsof -ti :5173 2>/dev/null || true)
    if [ -n "$PORT_5173_PID" ]; then
        PROC_NAME=$(ps -p $PORT_5173_PID -o comm= 2>/dev/null || echo "unknown")
        echo -e "${YELLOW}  - Port 5173 (Frontend): PID $PORT_5173_PID ($PROC_NAME)${NC}"
        kill -9 $PORT_5173_PID 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
fi

# Kill tmux sessions if they exist
if command -v tmux &> /dev/null; then
    if tmux has-session -t ServiceMonitor-Backend 2>/dev/null; then
        echo -e "${YELLOW}  Stopping tmux session: ServiceMonitor-Backend${NC}"
        tmux kill-session -t ServiceMonitor-Backend 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
    
    if tmux has-session -t ServiceMonitor-Frontend 2>/dev/null; then
        echo -e "${YELLOW}  Stopping tmux session: ServiceMonitor-Frontend${NC}"
        tmux kill-session -t ServiceMonitor-Frontend 2>/dev/null || true
        KILLED_COUNT=$((KILLED_COUNT + 1))
    fi
fi

# Method 3: Clean up background processes writing to /tmp logs
echo -e "${CYAN}Cleaning up background processes...${NC}"
BG_PIDS=$(pgrep -f "/tmp/ServiceMonitor" 2>/dev/null || true)
if [ -n "$BG_PIDS" ]; then
    COUNT=$(echo "$BG_PIDS" | wc -w)
    echo -e "${YELLOW}  Found $COUNT background log process(es)${NC}"
    echo "$BG_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED_COUNT=$((KILLED_COUNT + COUNT))
fi

# Wait a moment for processes to fully terminate
sleep 1

if [ $KILLED_COUNT -gt 0 ]; then
    echo -e "\n${GREEN}[OK] Stopped $KILLED_COUNT process(es)${NC}\n"
else
    echo -e "\n${GREEN}[OK] No running processes found${NC}\n"
fi
