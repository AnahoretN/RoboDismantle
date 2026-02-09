@echo off
echo.
echo ========================================
echo Pushing to GitHub
echo ========================================
echo.
echo 1. Create repository at: https://github.com/new
echo    Name: RoboDismantle
echo    Description: Browser-based 2D multiplayer platformer with WebRTC
echo    Public
echo    DO NOT initialize with README
echo.
echo 2. After creating, press any key to push...
pause > nul
echo.
cd /d "%~dp0"
git push -u origin main
echo.
echo Done! Repository at: https://github.com/AnahoretN/RoboDismantle
pause
