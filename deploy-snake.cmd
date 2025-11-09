@echo off
setlocal
REM Deploy script for Snake Game project
REM This deploys the snake/ folder to Cloudflare Pages project "snake"
REM Run from the root Supm3n directory (where this script lives)
cd /d "%~dp0snake" || (echo Could not find "snake" folder & exit /b 1)

echo Deploying Cloudflare Pages project: snake ...
echo Deploying from: %CD%
npx wrangler pages deploy . --project-name snake || (echo Deploy failed & exit /b 1)

echo ✓ snake deployed to https://snake.supm3n.com/

