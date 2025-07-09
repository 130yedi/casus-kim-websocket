@echo off
echo Casus Kim WebSocket Sunucusu baslatiliyor...
echo.

REM Node.js kurulu mu kontrol et
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo HATA: Node.js kurulu degil!
    echo Node.js'i https://nodejs.org adresinden indirip kurun.
    pause
    exit /b 1
)

REM npm paketleri kurulu mu kontrol et
if not exist "node_modules" (
    echo npm paketleri kuruluyor...
    npm install
    if %errorlevel% neq 0 (
        echo HATA: npm paketleri kurulamiyor!
        pause
        exit /b 1
    )
)

echo Sunucu baslatiliyor...
echo Sunucu durdirmak icin Ctrl+C basin.
echo.
npm start 