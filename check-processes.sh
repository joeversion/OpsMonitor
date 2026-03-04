#!/bin/bash
# Check OpsMonitor Running Processes
# Shows all node processes related to OpsMonitor

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}=== OpsMonitor Process Details ===${NC}\n"

# Find all OpsMonitor related processes (including dev.sh)
ALL_PIDS=$(pgrep -f "OpsMonitor.*(backend|frontend|dev\.sh)" 2>/dev/null || true)

if [ -z "$ALL_PIDS" ]; then
    echo -e "${YELLOW}[INFO] No OpsMonitor processes found${NC}\n"
    exit 0
fi

COUNT=$(echo "$ALL_PIDS" | wc -w)
echo -e "${GREEN}Found $COUNT process(es):${NC}\n"

for PID in $ALL_PIDS; do
    if ps -p $PID > /dev/null 2>&1; then
        CMDLINE=$(ps -p $PID -o args= 2>/dev/null || echo "Unknown")
        PARENT_PID=$(ps -p $PID -o ppid= 2>/dev/null | tr -d ' ' || echo "?")
        
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
        
        echo -e "${YELLOW}Process ID: $PID${NC}"
        echo -e "${GRAY}Parent PID: $PARENT_PID${NC}"
        echo -e "${CYAN}Type:       $TYPE${NC}"
        
        # Show shortened command line
        CMDLINE_SHORT="$CMDLINE"
        if [ ${#CMDLINE} -gt 120 ]; then
            CMDLINE_SHORT="${CMDLINE:0:120}..."
        fi
        echo -e "${GRAY}Command:    $CMDLINE_SHORT${NC}"
        echo ""
    fi
done

echo -e "${GREEN}Total: $COUNT process(es)${NC}\n"
