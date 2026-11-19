
param(
    [switch]$BackendOnly
)

$backendPath = Join-Path $PSScriptRoot "backend"
$flutterPath = Join-Path $PSScriptRoot "flutter_game"
$port = 3000

Write-Host "Checking Type and Run backend..." -ForegroundColor Cyan

# Check whether the backend is already listening
$connection = Test-NetConnection 127.0.0.1 -Port $port -WarningAction SilentlyContinue

if (-not $connection.TcpTestSucceeded) {

    Write-Host "Backend not running. Starting it..." -ForegroundColor Yellow

    Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/k", "npm run dev" `
        -WorkingDirectory $backendPath

    # Wait for backend to become available
    $ready = $false

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1

        $connection = Test-NetConnection 127.0.0.1 -Port $port -WarningAction SilentlyContinue

        if ($connection.TcpTestSucceeded) {
            $ready = $true
            break
        }
    }

    if (-not $ready) {
        Write-Host "Backend failed to start. Check its terminal." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Backend is running!" -ForegroundColor Green

# When called by VS Code F5, return control to the Dart debugger
if ($BackendOnly) {
    exit 0
}

# Otherwise launch Flutter directly
Write-Host "Launching Type and Run..." -ForegroundColor Cyan

Set-Location $flutterPath
flutter run -d web-server --web-hostname 0.0.0.0 --web-port 58286
