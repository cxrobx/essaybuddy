#!/bin/bash
# Zora — one-command bootstrap
# Usage: bash setup.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Zora Setup"
echo "=========="
echo ""

# -- Check Python 3.9+ --------------------------------------------------------
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found."
    echo "  Ask your AI CLI: \"Install Python 3.12 on this Mac\""
    exit 1
fi

PY_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 9 ]); then
    echo "ERROR: Python 3.9+ required, found $PY_VERSION"
    echo "  Ask your AI CLI: \"Install Python 3.12 on this Mac\""
    exit 1
fi
echo "[ok] Python $PY_VERSION"

# -- Check Node 18+ -----------------------------------------------------------
if ! command -v node &>/dev/null; then
    echo "ERROR: node not found."
    echo "  Ask your AI CLI: \"Install Node.js 22 LTS on this Mac\""
    exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.version.slice(1).split('.')[0])")
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "ERROR: Node 18+ required, found $(node --version)"
    echo "  Ask your AI CLI: \"Install Node.js 22 LTS on this Mac\""
    exit 1
fi
echo "[ok] Node $(node --version)"

# -- Check npm -----------------------------------------------------------------
if ! command -v npm &>/dev/null; then
    echo "ERROR: npm not found."
    echo "  Ask your AI CLI: \"Install npm on this Mac\""
    exit 1
fi
echo "[ok] npm $(npm --version)"

# -- Python venv + deps -------------------------------------------------------
if [ ! -f "api/.venv/bin/python3" ]; then
    echo ""
    echo "-> Creating Python virtual environment..."
    python3 -m venv api/.venv
fi

echo "-> Installing Python dependencies..."
(cd api && source .venv/bin/activate && pip install -q -r requirements.txt)
echo "[ok] Python dependencies installed"

# -- npm packages --------------------------------------------------------------
if [ ! -d "web/node_modules" ]; then
    echo ""
    echo "-> Installing npm packages..."
    (cd web && npm install --silent)
    echo "[ok] npm packages installed"
else
    echo "[ok] npm packages already installed"
fi

# -- Data directories ----------------------------------------------------------
mkdir -p data/essays data/samples/files data/profiles
echo "[ok] Data directories ready"

# -- Gatekeeper (if .app exists) -----------------------------------------------
if [ -d "launcher/dist/EssayBuddy.app" ]; then
    echo ""
    echo "-> Clearing Gatekeeper quarantine on Zora (EssayBuddy.app)..."
    xattr -dr com.apple.quarantine "launcher/dist/EssayBuddy.app" 2>/dev/null || true
    echo "[ok] Quarantine cleared"
fi

echo ""
echo "Setup complete! You can now:"
echo "  1. Open launcher/dist/EssayBuddy.app"
echo "  2. Or run manually:"
echo "     cd api && source .venv/bin/activate && python3 main.py &"
echo "     cd web && npm run dev"
