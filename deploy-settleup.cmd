@echo off
setlocal
REM Deploy script for Settle Up project
REM This deploys the settleup/ folder to Cloudflare Pages project "settleup"
REM Run from the root Supm3n directory (where this script lives)
cd /d "%~dp0settleup" || (echo Could not find "settleup" folder & exit /b 1)

echo Deploying Cloudflare Pages project: settleup ...
echo Deploying from: %CD%
npx wrangler pages deploy . --project-name settleup || (echo Deploy failed & exit /b 1)

echo ✓ settleup deployed to https://settleup.supm3n.com/


