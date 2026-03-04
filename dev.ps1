# OpsMonitor Development Startup Script for Windows
# Automatically installs dependencies, cleans old processes, and starts both services

$ErrorActionPreference = "Stop"
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootPath = $ScriptPath

Write-Host "`nStarting OpsMonitor Dev Environment...`n" -ForegroundColor Green

# Check if npm is available
Write-Host "Checking Node.js environment..." -ForegroundColor Yellow
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "Error: npm is not installed. Please install Node.js first." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}
Write-Host "[OK] Node.js found: $(node --version)" -ForegroundColor Green
Write-Host "[OK] npm found: $(npm --version)" -ForegroundColor Green

# Install dependencies if node_modules doesn't exist
Write-Host "`nChecking dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "$RootPath\backend\node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Push-Location "$RootPath\backend"
    npm install
    Pop-Location
    Write-Host "[OK] Backend dependencies installed" -ForegroundColor Green
}

if (-not (Test-Path "$RootPath\frontend\node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location "$RootPath\frontend"
    npm install
    Pop-Location
    Write-Host "[OK] Frontend dependencies installed" -ForegroundColor Green
}

# Clean up all old processes
Write-Host "`nStopping all old OpsMonitor processes..." -ForegroundColor Yellow

$killedCount = 0

# Method 1: Kill by process pattern (backend and frontend)
Write-Host "Checking for old processes by pattern..." -ForegroundColor DarkYellow
$oldBackendProcesses = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    $cmdLine -like "*OpsMonitor*backend*" -and ($cmdLine -like "*ts-node*" -or $cmdLine -like "*nodemon*" -or $cmdLine -like "*npm*dev*")
}

if ($oldBackendProcesses) {
    $count = $oldBackendProcesses.Count
    Write-Host "  Found $count backend process(es), stopping..." -ForegroundColor Yellow
    $oldBackendProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    $killedCount += $count
}

$oldFrontendProcesses = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    $cmdLine -like "*OpsMonitor*frontend*" -and ($cmdLine -like "*vite*" -or $cmdLine -like "*npm*dev*")
}

if ($oldFrontendProcesses) {
    $count = $oldFrontendProcesses.Count
    Write-Host "  Found $count frontend process(es), stopping..." -ForegroundColor Yellow
    $oldFrontendProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    $killedCount += $count
}

# Method 2: Kill by port (3000 for backend, 5173 for frontend)
Write-Host "Checking ports 3000 and 5173..." -ForegroundColor DarkYellow

# Kill process on port 3000 (backend)
$port3000Connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($port3000Connection) {
    $processId = $port3000Connection.OwningProcess
    Write-Host "  Killing process on port 3000 (PID: $processId)" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $killedCount++
}

# Kill process on port 5173 (frontend)
$port5173Connection = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
if ($port5173Connection) {
    $processId = $port5173Connection.OwningProcess
    Write-Host "  Killing process on port 5173 (PID: $processId)" -ForegroundColor Yellow
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $killedCount++
}

# Wait for cleanup
if ($killedCount -gt 0) {
    Start-Sleep -Seconds 2
    Write-Host "[OK] Stopped $killedCount old process(es)" -ForegroundColor Green
} else {
    Write-Host "[OK] No old processes found" -ForegroundColor Green
}

# Start Backend
Write-Host "`nStarting Backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'OpsMonitor Backend' -ForegroundColor Cyan; cd '$RootPath\backend'; npm run dev"

# Wait for backend to be ready (check if port 3000 is listening)
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
$maxWaitSeconds = 15  # 减少到15秒，因为health端点启动很快
$waitedSeconds = 0
$backendReady = $false

while (-not $backendReady -and $waitedSeconds -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 2
    $waitedSeconds += 2
    
    # Check if port 3000 is listening
    $port3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    
    if ($port3000) {
        # 使用 /health 端点检查，快速启动
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $backendReady = $true
                Write-Host "[OK] Backend is ready! (took $waitedSeconds seconds)" -ForegroundColor Green
            }
        } catch {
            # Backend port is open but not responding yet, keep waiting
            $statusMsg = "  Port 3000 is open, waiting for health endpoint... ($waitedSeconds/$maxWaitSeconds seconds)"
            Write-Host $statusMsg -ForegroundColor DarkYellow
        }
    } else {
        $statusMsg = "  Waiting for backend... ($waitedSeconds/$maxWaitSeconds seconds)"
        Write-Host $statusMsg -ForegroundColor DarkYellow
    }
}

if (-not $backendReady) {
    Write-Host "`nWarning: Backend did not respond within $maxWaitSeconds seconds." -ForegroundColor Red
    Write-Host "Starting frontend anyway. Please check the backend terminal for errors." -ForegroundColor Yellow
}

# Start Frontend
Write-Host "`nStarting Frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'OpsMonitor Frontend' -ForegroundColor Cyan; cd '$RootPath\frontend'; npm run dev"

Write-Host "`n=== Done! Both services are starting ===" -ForegroundColor Green
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C in each terminal window to stop the services.`n" -ForegroundColor Yellow

