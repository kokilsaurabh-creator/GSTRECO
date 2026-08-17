@echo off
echo =========================================
echo Starting GSTRECO Application (Dev Mode)
echo =========================================

echo Cleaning up orphaned backend processes (Port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo Starting Python FastAPI Backend...
start "GSTRECO Backend" cmd /k "cd backend && call .\venv\Scripts\activate.bat && uvicorn app.main:app --reload"

echo Starting React Frontend...
start "GSTRECO Frontend" cmd /k "cd frontend && npm run dev"

echo Both services have been launched in separate windows.
echo You can close this window now.
