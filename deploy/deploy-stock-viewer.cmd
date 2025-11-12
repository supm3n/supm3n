@echo off
setlocal ENABLEDELAYEDEXPANSION
REM ----------------------------------------------------------------------------
REM Cloudflare Pages deploy helper
REM - Runs from the repo's /deploy/ folder
REM - Uses wrangler to deploy a subfolder to a Pages project (Direct Upload)
REM - If your Pages project is Git-connected, prefer pushing to Git instead.
REM ----------------------------------------------------------------------------

REM Move to repo root (parent of this script folder)
pushd "%~dp0\.."

REM Check wrangler availability
where wrangler >nul 2>&1
if errorlevel 1 (
  echo ERROR: wrangler not found. Install with: npm i -g wrangler
  popd
  exit /b 1
)

set "PROJECT_NAME=stock-viewer"
set "PROJECT_DIR=projects\stock-viewer"

if not exist "!PROJECT_DIR!\index.html" (
  echo ERROR: "!PROJECT_DIR!\index.html" not found.
  echo Make sure the path is correct relative to the repo root.
  popd
  exit /b 1
)

echo.
echo Deploying Cloudflare Pages project: !PROJECT_NAME!
echo Source directory: !CD!\!PROJECT_DIR!
echo.

REM For Git-connected projects, push to Git instead of running this command.
REM Direct upload deploy:
npx wrangler pages deploy "!PROJECT_DIR!" --project-name "!PROJECT_NAME!"
if errorlevel 1 (
  echo Deploy failed. See errors above.
  popd
  exit /b 1
)

echo.
echo ✓ Deployed to https://!PROJECT_NAME!.pages.dev
echo ✓ Custom domain: https://stocks.supm3n.com/
echo.

popd
endlocal
