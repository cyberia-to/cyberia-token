#!/bin/bash

# Setup script for Cyberia Token project
# Runs after npm install to ensure all dependencies (including Foundry) are installed

set -e

echo "🔧 Cyberia Token Setup"
echo "====================="
echo ""

# Check if Foundry is installed
if command -v forge &> /dev/null; then
    echo "✅ Foundry is already installed"
    forge --version
else
    echo "⏳ Foundry not found. Installing Foundry..."
    echo ""

    # Install foundryup
    if ! command -v foundryup &> /dev/null; then
        echo "📦 Installing foundryup..."
        curl -L https://foundry.paradigm.xyz | bash

        # Source the new PATH
        export PATH="$HOME/.foundry/bin:$PATH"

        # Run foundryup
        echo "📥 Installing Foundry tools..."
        foundryup
    else
        echo "📥 Running foundryup to install Foundry..."
        foundryup
    fi

    echo ""
    echo "✅ Foundry installed successfully!"
    forge --version
fi

echo ""
echo "📋 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure"
echo "2. Run 'npm test' to verify everything works"
echo ""
