Write-Host "Starting CardIO Full-Stack Services..." -ForegroundColor Cyan

# 1. Start Express Backend Server
Write-Host "[1/3] Starting Express Backend (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm run dev"

# 2. Start React Frontend Client
Write-Host "[2/3] Starting React Client (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev"

# 3. Start Python FastAPI Analytics Service
Write-Host "[3/3] Starting Python Analytics Service (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd analytics; .\venv\Scripts\python.exe main.py"

Write-Host ""
Write-Host "All CardIO services have been launched in separate terminal windows." -ForegroundColor Green
Write-Host "Make sure you have added your Supabase credentials to client/.env and server/.env" -ForegroundColor Red
