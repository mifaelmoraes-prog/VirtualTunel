<#
.SYNOPSIS
Inicia automaticamente o ambiente de simulação "Virtual Tunel By Mifael".

.DESCRIPTION
Este script executa dois processos em segundo plano:
1. Servidor Backend FastAPI (Motor CFD em Python) na porta 8000.
2. Servidor Frontend Vite (Renderizador WebGL) na porta 5173.
Em seguida, ele aguarda o boot e abre automaticamente a URL local no navegador padrão.
#>

Write-Host "Iniciando a plataforma Virtual Tunel By Mifael..." -ForegroundColor Cyan

# 1. Iniciar o Backend
Write-Host "[1/3] Acordando o Motor CFD (Python)..." -ForegroundColor Yellow
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\python.exe main.py; if (`$?) { exit }" -WindowStyle Minimized -PassThru

# 2. Iniciar o Frontend
Write-Host "[2/3] Levantando a Interface WebGL (Node)..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev -- --port 5173" -WindowStyle Minimized -PassThru

# Aguardando portas estabilizarem
Write-Host "Aguardando serviços... (3s)" -ForegroundColor Magenta
Start-Sleep -Seconds 3

# 3. Chamar o navegador
Write-Host "[3/3] Abrindo interface no navegador local..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "========================================="
Write-Host " VIRTUAL TUNEL by Mifael está Online!"
Write-Host "========================================="
Write-Host "As janelas do terminal foram minimizadas."
Write-Host "Pressione qualquer tecla para finalizar os servidores e encerrar o script."
$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") | Out-Null

Write-Host "Encerrando plataforma..." -ForegroundColor Red
Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontendProcess.Id -Force -ErrorAction SilentlyContinue
Write-Host "Concluído. Até a próxima!" -ForegroundColor Cyan
