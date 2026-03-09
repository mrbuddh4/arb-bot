@echo off
REM Quick setup script for Paxeer Arbitrage Bot (Windows)

echo.
echo 🚀 Paxeer Arbitrage Bot - Quick Setup
echo ======================================
echo.

REM Check if .env exists
if exist .env (
    echo ✅ .env file already exists
) else (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ✅ .env created! Please edit it with your credentials
)

REM Install dependencies if not already installed
if not exist "node_modules" (
    echo.
    echo 📦 Installing dependencies...
    call npm install
) else (
    echo ✅ Dependencies already installed
)

REM Create directories
if not exist "data" mkdir data
if not exist "logs" mkdir logs

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Edit .env with your credentials:
echo    - TELEGRAM_BOT_TOKEN (from @BotFather)
echo    - TELEGRAM_CHAT_ID (your chat ID)
echo    - SIDIORA_API_KEY and SIDIORA_API_SECRET
echo    - PAXEER_PRIVATE_KEY
echo.
echo 2. Start the bot:
echo    npm start       (production)
echo    npm run dev     (development with auto-restart)
echo.
echo 3. Check logs:
echo    type logs\app.log
echo.
echo Read SETUP.md for detailed configuration guide
echo.
pause
