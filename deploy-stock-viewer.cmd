@echo off
setlocal
REM Deploy script for Stock Viewer project
REM This deploys the stock-viewer/ folder to Cloudflare Pages project "stock-viewer"
REM Run from the root Supm3n directory (where this script lives)
cd /d "%~dp0stock-viewer" || (echo Could not find "stock-viewer" folder & exit /b 1)

echo Deploying Cloudflare Pages project: stock-viewer ...
echo Deploying from: %CD%
npx wrangler pages deploy . --project-name stock-viewer || (echo Deploy failed & exit /b 1)

echo ✓ stock-viewer deployed to https://stocks.supm3n.com/
