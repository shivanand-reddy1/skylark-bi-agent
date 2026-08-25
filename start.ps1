# Skylark BI Agent — Startup Script
# Run this from the Project root directory

Write-Host "🚁 Starting Skylark BI Agent..." -ForegroundColor Cyan

# Check for .env files
if (-not (Test-Path "backend\.env")) {
    Write-Host "⚠️  backend\.env not found. Copying from .env.example..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "   Please edit backend\.env with your API keys before continuing." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "frontend\.env.local")) {
    Write-Host "📝 Creating frontend\.env.local..." -ForegroundColor Yellow
    Copy-Item "frontend\.env.example" "frontend\.env.local"
}

# Check node_modules
if (-not (Test-Path "backend\node_modules")) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Blue
    Push-Location backend
    npm install
    Pop-Location
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Blue
    Push-Location frontend
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "✅ Starting servers..." -ForegroundColor Green
Write-Host "   Backend: http://localhost:3001" -ForegroundColor Gray
Write-Host "   Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop." -ForegroundColor Gray
Write-Host ""

# Start backend in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; npm run dev" -WindowStyle Normal

# Start frontend in foreground
Push-Location frontend
npm run dev
Pop-Location
