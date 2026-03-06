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

# -- Check Codex CLI (warning only) -------------------------------------------
if command -v codex &>/dev/null; then
    echo "[ok] Codex CLI found"
else
    echo "[!!] Codex CLI not found (optional — needed for AI skills)"
    echo "     Install: https://github.com/openai/codex"
fi

# -- Environment file ---------------------------------------------------------
if [ ! -f ".env" ]; then
    echo ""
    echo "-> Creating .env from .env.example..."
    cp .env.example .env
    echo "[ok] .env created"
else
    echo "[ok] .env already exists"
fi

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
mkdir -p data/essays data/samples/files data/profiles data/research/papers data/research/cache
echo "[ok] Data directories ready"

# -- Copy starter data (only if data/essays is empty) -------------------------
if [ -d "fixtures" ] && [ -z "$(ls -A data/essays/ 2>/dev/null | grep -v .gitkeep)" ]; then
    echo ""
    echo "-> Copying starter sample data..."
    cp fixtures/essays/*.md data/essays/ 2>/dev/null || true
    cp fixtures/samples/*.json data/samples/ 2>/dev/null || true
    cp fixtures/profiles/*.json data/profiles/ 2>/dev/null || true
    echo "[ok] Starter data copied (essays, samples, profile)"
else
    echo "[ok] Data already present, skipping starter data"
fi

# -- Build .app (if swiftc available) -----------------------------------------
if [ -d "launcher/dist/EssayBuddy.app" ]; then
    echo "[ok] EssayBuddy.app already built"
elif command -v swiftc &>/dev/null; then
    echo ""
    echo "-> Building EssayBuddy.app..."
    bash launcher/build.sh
    echo "[ok] EssayBuddy.app built"
else
    echo ""
    echo "[!!] swiftc not found — install Xcode Command Line Tools to build the app:"
    echo "     xcode-select --install"
    echo "     Then re-run: bash setup.sh"
    echo "     You can still run manually via terminal."
fi

# -- Gatekeeper (if .app exists) -----------------------------------------------
if [ -d "launcher/dist/EssayBuddy.app" ]; then
    echo "-> Clearing Gatekeeper quarantine..."
    xattr -dr com.apple.quarantine "launcher/dist/EssayBuddy.app" 2>/dev/null || true
    echo "[ok] Quarantine cleared"
fi

echo ""
echo "=========================================="
echo "Setup complete! Launch Zora:"
echo "  open launcher/dist/EssayBuddy.app"
echo ""
echo "Or run manually:"
echo "  cd api && source .venv/bin/activate && python3 main.py &"
echo "  cd web && npm run dev"
echo "=========================================="
