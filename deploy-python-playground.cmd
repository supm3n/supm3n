@echo off
setlocal
REM Run from the folder this script lives in
cd /d "%~dp0python-playground" || (echo Could not find "python-playground" folder & exit /b 1)

echo Deploying Cloudflare Pages project: python-playground ...
npx wrangler pages deploy . --project-name python-playground || (echo Deploy failed & exit /b 1)

echo ✓ python-playground deployed.

