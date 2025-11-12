@echo off
REM Deploy the 'disasters' project (Cloudflare Pages) from subdirectory
set PROJECT_DIR=disasters
echo Deploying %PROJECT_DIR% ...
npx wrangler pages deploy ./%PROJECT_DIR%