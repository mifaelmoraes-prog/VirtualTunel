@echo off
setlocal enabledelayedexpansion

echo.
echo =========================================
echo   VIRTUAL TUNEL by Mifael - Inicializando
echo =========================================
echo.

echo [0/3] Limpando processos anteriores...

for %%P in (8000 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P "') do (
        echo matando PID %%A na porta %%P
        taskkill /F /PID %%A >nul 2>&1
    )
)

timeout /t 1 /nobreak >nul

echo [1/3] Acordando o Motor CFD (Python) na porta 8000...
start "Backend" /D "%~dp0backend" ".\venv\Scripts\python.exe" main.py

echo [2/3] Levantando a Interface WebGL (Node) na porta 5173...
start "Frontend" /D "%~dp0frontend" "npm.cmd" run dev -- --port 5173 --strictPort

echo   Aguardando servicos estabilizarem... (4s)
timeout /t 4 /nobreak >nul

echo [3/3] Abrindo interface no navegador...
start http://localhost:5173

echo.
echo =========================================
echo   VIRTUAL TUNEL by Mifael  -  ONLINE
echo =========================================
echo   Backend  -^> http://localhost:8000
echo   Frontend -^> http://localhost:5173
echo.
echo   Pressione qualquer tecla para encerrar todos os servidores.
pause >nul

echo.
echo Encerrando plataforma...

for %%P in (8000 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P "') do (
        taskkill /F /PID %%A >nul 2>&1
    )
)

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
