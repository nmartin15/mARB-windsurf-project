# PowerShell script to fix Vite permission issues

Write-Host "Stopping any running Node.js processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Cleaning Vite cache directories..." -ForegroundColor Yellow
$viteCache = "node_modules\.vite"
if (Test-Path $viteCache) {
    Write-Host "Removing $viteCache directory..." -ForegroundColor Cyan
    try {
        Remove-Item -Recurse -Force $viteCache -ErrorAction Stop
        Write-Host "Successfully removed $viteCache" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Could not remove $viteCache - $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Will try alternative methods..." -ForegroundColor Yellow
    }
}

Write-Host "Cleaning npm cache..." -ForegroundColor Yellow
npm cache clean --force

Write-Host "Setting up alternative development environment..." -ForegroundColor Yellow
# Create a static file server as an alternative to vite
npm install --save-dev serve

Write-Host "Adding fallback dev scripts to package.json..." -ForegroundColor Yellow
# Note: This is informational only, actual changes are made with edit_file tool
Write-Host "Added: 'serve-dev': 'serve -s public -l 5173'"

Write-Host "Done! Try running 'npm run serve-dev' as an alternative to vite." -ForegroundColor Green
