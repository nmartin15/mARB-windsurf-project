# PowerShell script to start a simple static server without Vite

Write-Host "Starting a simple static server for the messaging platform..." -ForegroundColor Cyan

# First make sure we have serve installed
Write-Host "Installing serve package if not already installed..." -ForegroundColor Yellow
npm install --save-dev serve

# Stop any running node processes that might block ports
Write-Host "Stopping any running Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# Launch the static server
Write-Host "Starting the static server on port 5173..." -ForegroundColor Green
Write-Host "Open your browser to http://localhost:5173/ to view the messaging platform" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

npx serve -s public -l 5173
