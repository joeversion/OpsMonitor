# Stop OpsMonitor Development Services (Windows)
# Kills all running backend and frontend processes

Write-Host "`nStopping OpsMonitor services...`n" -ForegroundColor Yellow

$killedCount = 0

# Method 1: Kill by process pattern
Write-Host "Stopping processes by pattern..." -ForegroundColor Cyan
$processes = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    $cmdLine -like "*OpsMonitor*" -and ($cmdLine -like "*backend*" -or $cmdLine -like "*frontend*")
}

if ($processes) {
    $count = $processes.Count
    Write-Host "  Found $count OpsMonitor process(es):" -ForegroundColor Yellow
    
    # Print details of each process before stopping
    $processes | ForEach-Object {
        $processId = $_.Id
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
        $cmdLine = $process.CommandLine
        
        # Determine type with clear description
        $type = "Unknown"
        if ($cmdLine -like "*backend*") {
            if ($cmdLine -like "*ts-node*") {
                $type = "Backend - TypeScript Runtime (ts-node)"
            } elseif ($cmdLine -like "*nodemon*") {
                $type = "Backend - File Watcher (nodemon)"
            } else {
                $type = "Backend - npm Launcher"
            }
        } elseif ($cmdLine -like "*frontend*") {
            if ($cmdLine -like "*vite*") {
                $type = "Frontend - Dev Server (Vite)"
            } else {
                $type = "Frontend - npm Launcher"
            }
        }
        
        Write-Host "    - PID $processId`: $type" -ForegroundColor Gray
    }
    
    $processes | Stop-Process -Force -ErrorAction SilentlyContinue
    $killedCount += $count
}

# Method 2: Kill by port
Write-Host "Stopping processes by port..." -ForegroundColor Cyan

$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($port3000) {
    $processId = $port3000.OwningProcess
    $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "  - Port 3000 (Backend): PID $processId ($processName)" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $killedCount++
}

$port5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($port5173) {
    $processId = $port5173.OwningProcess
    $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "  - Port 5173 (Frontend): PID $processId ($processName)" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $killedCount++
}

if ($killedCount -gt 0) {
    Write-Host "`n[OK] Stopped $killedCount process(es)" -ForegroundColor Green
} else {
    Write-Host "`n[OK] No running processes found" -ForegroundColor Green
}

Write-Host ""
