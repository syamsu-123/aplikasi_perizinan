@echo off
title Auto-Build APK MyIzin
color 0A
echo ===================================================
echo     AUTO-BUILD APK MYIZIN BY GEMINI
echo ===================================================
echo.

echo [1/4] Masuk ke folder frontend...
cd frontend

echo [2/4] Membangun antarmuka aplikasi (React Vite)...
call npm run build

echo [3/4] Menyiapkan platform Android (Capacitor)...
call npx cap sync android

echo [4/4] Membuat file APK (Membutuhkan beberapa menit)...
cd android
call gradlew.bat assembleDebug

echo.
echo ===================================================
echo                  BUILD SELESAI!
echo ===================================================
echo Silakan buka folder berikut untuk mengambil APK Anda:
echo d:\aplikasi_perizinan\frontend\android\app\build\outputs\apk\debug\
echo.
pause