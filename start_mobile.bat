@echo off
echo.
echo  ============================================
echo   SignAvatar -- Mobile App (Expo Dev Server)
echo  ============================================
echo.
echo  Starting Expo development server...
echo  Scan the QR code with Expo Go app on your phone.
echo  Or press 'a' to open on Android emulator.
echo.
echo  NOTE: Make sure the backend is running first!
echo  Run start.bat in a separate terminal window.
echo.
echo  Press CTRL+C to stop.
echo.

cd /d "%~dp0\frontend"
npx expo start --offline
