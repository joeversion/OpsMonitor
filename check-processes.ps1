# Check OpsMonitor Running Processes
# Shows all node processes related to OpsMonitor

Write-Host "`n=== OpsMonitor Process Details ===" -ForegroundColor Cyan
Write-Host ""

$processes = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
    $cmdLine -like "*OpsMonitor*"
}

if (-not $processes) {
    Write-Host "[INFO] No OpsMonitor processes found" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

$count = ($processes | Measure-Object).Count
Write-Host "Found $count process(es):" -ForegroundColor Green
Write-Host ""

$processes | ForEach-Object {
    $processId = $_.Id
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId" -ErrorAction SilentlyContinue
    $cmdLine = $process.CommandLine
    $parentPid = $process.ParentProcessId
    
    # Determine type
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
    
    Write-Host "Process ID: $processId" -ForegroundColor Yellow
    Write-Host "Parent PID: $parentPid" -ForegroundColor Gray
    Write-Host "Type:       $type" -ForegroundColor Cyan
    
    # Show shortened command line
    $shortCmd = if ($cmdLine.Length -gt 120) { 
        $cmdLine.Substring(0, 120) + "..." 
    } else { 
        $cmdLine 
    }
    Write-Host "Command:    $shortCmd" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Total: $count process(es)" -ForegroundColor Green
Write-Host ""
