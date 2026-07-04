@echo off
echo.
echo  ============================================
echo   SignAvatar -- ISL to 3D Avatar (Backend)
echo  ============================================
echo.
echo  API server starts on http://0.0.0.0:8000
echo  Mobile app connects via your LAN IP address.
echo.
echo  Find your LAN IP:  ipconfig | findstr "IPv4"
echo  Then update Backend URL in the app settings.
echo.
echo  Press CTRL+C to stop.
echo.

cd /d "%~dp0"
.\venv\Scripts\python.exe backend\app.py
