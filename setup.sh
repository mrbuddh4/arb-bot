#!/bin/bash
# Quick setup script for Paxeer Arbitrage Bot

echo "🚀 Paxeer Arbitrage Bot - Quick Setup"
echo "======================================"
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "✅ .env file already exists"
else
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env created! Please edit it with your credentials"
fi

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✅ Dependencies already installed"
fi

# Create data directory
mkdir -p data logs

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your credentials:"
echo "   - TELEGRAM_BOT_TOKEN (from @BotFather)"
echo "   - TELEGRAM_CHAT_ID (your chat ID)"
echo "   - SIDIORA_API_KEY and SIDIORA_API_SECRET"
echo "   - PAXEER_PRIVATE_KEY"
echo ""
echo "2. Start the bot:"
echo "   npm start       (production)"
echo "   npm run dev     (development with auto-restart)"
echo ""
echo "3. Check logs:"
echo "   cat logs/app.log"
echo ""
echo "Read SETUP.md for detailed configuration guide"
