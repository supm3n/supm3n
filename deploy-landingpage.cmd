@echo off
setlocal
REM Deploy script for Landing Page project
REM This deploys the landingpage/ folder to Cloudflare Pages project "landingpage"
REM Run from the root Supm3n directory (where this script lives)
cd /d "%~dp0landingpage" || (echo Could not find "landingpage" folder & exit /b 1)

echo Deploying Cloudflare Pages project: landingpage ...
echo Deploying from: %CD%
npx wrangler pages deploy . --project-name landingpage || (echo Deploy failed & exit /b 1)

echo ✓ landingpage deployed to https://supm3n.com/
