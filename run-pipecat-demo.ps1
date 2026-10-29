# Pipecat voice demo - setup and run (Windows)
# Put this file and demo_bot.py in the same folder, open PowerShell there, and run:
#   powershell -ExecutionPolicy Bypass -File .\run-pipecat-demo.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "=== Pipecat voice demo ===" -ForegroundColor Cyan

# 0. Check files and Git
if (-not (Test-Path ".\demo_bot.py") -or -not (Test-Path ".\bot_core.py")) {
    Write-Host "demo_bot.py or bot_core.py was not found. Put them in the same folder as this script." -ForegroundColor Red
    exit 1
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git is not installed. Get it from https://git-scm.com/download/win , then run this again." -ForegroundColor Red
    exit 1
}

# 1. Install uv (Python manager) if missing
$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host "Installing uv..."
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
}

# 2. Install Python 3.12
Write-Host "Making sure Python 3.12 is installed..."
uv python install 3.12
if ($LASTEXITCODE -ne 0) { throw "Python install failed." }

# 3. Clone the Pipecat repo
if (-not (Test-Path ".\pipecat")) {
    Write-Host "Cloning the Pipecat repo..."
    git clone --depth 1 https://github.com/pipecat-ai/pipecat.git
    if ($LASTEXITCODE -ne 0) { throw "git clone failed." }
}

# 4. Install only the pieces this demo needs
Set-Location ".\pipecat"
Write-Host "Installing packages (first run takes a few minutes)..."
uv sync --python 3.12 --extra openai --extra google --extra webrtc --extra runner --extra silero
if ($LASTEXITCODE -ne 0) { throw "Package install failed." }

# 5. Ask for each key once, save it in a local .env file (keeps keys already saved)
$envFile = Join-Path (Get-Location) ".env"
if (-not (Test-Path $envFile)) { New-Item $envFile -ItemType File | Out-Null }

function Ensure-Key($name, $label, $optional) {
    $line = Select-String -Path $envFile -Pattern "^$name=.{10,}" -Quiet
    $skipFlag = Join-Path (Get-Location) ".skip_$name"
    if (-not $line -and -not (Test-Path $skipFlag)) {
        $secure = Read-Host "Paste your $label" -AsSecureString
        $key = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
        if ($key -eq "" -and $optional) {
            New-Item $skipFlag -ItemType File | Out-Null
            Write-Host "Skipped. The bot will use the OpenAI voice."
            return
        }
        $rest = Get-Content $envFile | Where-Object { $_ -notmatch "^$name=" }
        [IO.File]::WriteAllLines($envFile, @($rest) + "$name=$key")
        Write-Host "$name saved in pipecat\.env (only on this PC)."
    }
}
Ensure-Key "OPENAI_API_KEY" "OpenAI API key" $false
Ensure-Key "GOOGLE_API_KEY" "Gemini API key for the Gemini voice (or just press Enter to skip)" $true

# 6. Copy the bot in and open the browser once the server is up
Copy-Item "..\demo_bot.py" ".\demo_bot.py" -Force
if (-not (Test-Path "..\bot_core.py")) { throw "bot_core.py was not found. Put it next to this script." }
Copy-Item "..\bot_core.py" ".\bot_core.py" -Force
if (-not (Test-Path "..\company_info.txt")) { throw "company_info.txt was not found. Put it next to this script." }
Copy-Item "..\company_info.txt" ".\company_info.txt" -Force
if (Test-Path "..\hayat_ui.html") { Copy-Item "..\hayat_ui.html" ".\hayat_ui.html" -Force }
$url = "http://localhost:7860/client/"
Start-Job -ScriptBlock {
    param($u)
    for ($i = 0; $i -lt 90; $i++) {
        try { Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 2 | Out-Null; Start-Process $u; return } catch { Start-Sleep 2 }
    }
} -ArgumentList $url | Out-Null

Write-Host ""
Write-Host "Starting the bot. Your browser will open $url" -ForegroundColor Green
Write-Host "Click Connect, allow the microphone, and start talking. Press Ctrl+C to stop."
uv run --python 3.12 demo_bot.py -t webrtc
