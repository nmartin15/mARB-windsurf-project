# PowerShell script to properly launch Vite with elevated permissions

# First, prepare environment
Write-Host "Preparing environment for Vite..." -ForegroundColor Cyan

# Clean up processes that might be blocking the port
Write-Host "Clearing any existing Node.js processes that might block ports..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# Clear out potential problem directories
if (Test-Path "node_modules\.vite") {
    Write-Host "Removing Vite cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules\.vite" -ErrorAction SilentlyContinue
}
if (Test-Path ".vite") {
    Write-Host "Removing .vite directory..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".vite" -ErrorAction SilentlyContinue
}

# Set proper NODE_OPTIONS for Windows environments
Write-Host "Setting NODE_OPTIONS to resolve permission issues..." -ForegroundColor Yellow
$env:NODE_OPTIONS = "--max-old-space-size=4096 --no-experimental-fetch"

# Set strict mode to false to prevent TypeScript errors from stopping the server
$env:VITE_TSCONFIG_STRICT = "false"

# Set appropriate permission flags
$env:CHOKIDAR_USEPOLLING = "true"

# Run Vite with --force to bypass caching issues
Write-Host "Starting Vite development server with proper settings..." -ForegroundColor Green
Write-Host "Open your browser to http://localhost:5173/ to view your application" -ForegroundColor Green
npm run dev -- --force --host
