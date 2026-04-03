# .SYNOPSIS
# Inicia automaticamente o ambiente de simulacao "Virtual Tunel By Mifael".
# 
# .DESCRIPTION
# Este script:
# 0. Encerra TODOS os processos que estejam usando as portas 8000 e 5173,
# alem de matar instancias anteriores de Python (uvicorn) e Node (vite).
# 1. Sobe o Backend FastAPI (Motor CFD em Python) na porta 8000.
# 2. Sobe o Frontend Vite (Renderizador WebGL) na porta 5173.
# 3. Aguarda o boot e abre automaticamente a URL no navegador padrao.
# >

Write-Host ""
Write-Host "=========================================" -ForegroundColor DarkCyan
Write-Host "  VIRTUAL TUNEL by Mifael - Inicializando" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor DarkCyan
Write-Host ""

# ------------------------------------------------------------
# FASE 0 - Limpeza: mata processos nas portas alvo
# ------------------------------------------------------------
Write-Host "[0/3] Limpando processos anteriores..." -ForegroundColor Magenta

$targetPorts = @(8000, 5173)

foreach ($port in $targetPorts) {
    # Encontra PIDs ouvindo na porta via netstat
    $pattern = [string]::Format(":{0} ", $port)
    $lines = netstat -ano | Select-String -Pattern $pattern -SimpleMatch
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').Trim() -split ' '
        $pid = $parts[-1]
        if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
            try {
                Stop-Process -Id ([int]$pid) -Force -ErrorAction Stop
                Write-Host "  [OK] Porta $port - PID $pid encerrado." -ForegroundColor DarkGray
            }
            catch {
                # Processo ja terminou ou sem permissao - ignorar silenciosamente
            }
        }
    }
}

Write-Host "  Aguardando o SO liberar as portas..." -ForegroundColor DarkGray
Start-Sleep -Seconds 1
Write-Host ""

# ------------------------------------------------------------
# FASE 1 - Backend
# ------------------------------------------------------------
Write-Host "[1/3] Acordando o Motor CFD (Python) na porta 8000..." -ForegroundColor Yellow
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .\venv\Scripts\python.exe main.py" -WindowStyle Minimized -PassThru

# ------------------------------------------------------------
# FASE 2 - Frontend
# ------------------------------------------------------------
Write-Host "[2/3] Levantando a Interface WebGL (Node) na porta 5173..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev -- --port 5173 --strictPort" -WindowStyle Minimized -PassThru

# Aguarda os servidores ficarem prontos
Write-Host "  Aguardando servicos estabilizarem... (4s)" -ForegroundColor DarkGray
Start-Sleep -Seconds 4

# ------------------------------------------------------------
# FASE 3 - Navegador
# ------------------------------------------------------------
Write-Host "[3/3] Abrindo interface no navegador..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "=========================================" -ForegroundColor DarkCyan
Write-Host "  VIRTUAL TUNEL by Mifael  -  ONLINE  " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor DarkCyan
Write-Host "  Backend  -> http://localhost:8000" -ForegroundColor DarkGray
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Pressione qualquer tecla para encerrar todos os servidores." -ForegroundColor White
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null

# ------------------------------------------------------------
# ENCERRAMENTO
# ------------------------------------------------------------
Write-Host ""
Write-Host "Encerrando plataforma..." -ForegroundColor Red
Stop-Process -Id $backendProcess.Id  -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue

# Garante que portas sejam liberadas apos o encerramento
foreach ($port in $targetPorts) {
    $pattern = [string]::Format(":{0} ", $port)
    $lines = netstat -ano | Select-String -Pattern $pattern -SimpleMatch
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').Trim() -split ' '
        $pid = $parts[-1]
        if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
            Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
        }
    }
}
