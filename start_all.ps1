Write-Host "Starting SmartRewards Services..." -ForegroundColor Cyan

# Start Backend Server
Write-Host "Starting Express Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm run dev"

# Start Frontend
Write-Host "Starting React Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev"

# Instructions for Python
Write-Host ""
Write-Host "To start the Python Analytics Service, open a new terminal and run:" -ForegroundColor Green
Write-Host "cd analytics"
Write-Host "python -m venv venv"
Write-Host ".\venv\Scripts\activate"
Write-Host "pip install -r requirements.txt"
Write-Host "python main.py"
Write-Host ""
Write-Host "Make sure you have added your Supabase credentials to client/.env and server/.env" -ForegroundColor Red
