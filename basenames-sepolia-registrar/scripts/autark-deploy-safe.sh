#!/bin/bash
# SAFEST Autark deployment script
# Uses a manual approach that you control completely
# This script does NOT use symlinks (to be safe)

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_ROOT/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/out"
CONFIG_IN_OUT="$OUT_DIR/secure-deploy.config.json"
CONFIG_IN_ROOT="$ROOT_DIR/secure-deploy.config.json"

echo "🔒 SAFEST Autark Deployment Script"
echo "⚠️  This uses manual control - you need to verify the config is removed"
echo ""

# Check if autark command exists
if ! command -v autark &> /dev/null; then
  echo "✗ ERROR: autark command not found"
  exit 1
fi

# Check if config file exists in root
if [ ! -f "$CONFIG_IN_ROOT" ]; then
  echo "✗ ERROR: secure-deploy.config.json not found in root directory"
  exit 1
fi

# Check if out/ directory exists
if [ ! -d "$OUT_DIR" ]; then
  echo "✗ ERROR: Build output directory does not exist"
  echo "   Please run 'npm run build' first."
  exit 1
fi

# Verify config is NOT already in out/
if [ -f "$CONFIG_IN_OUT" ] || [ -L "$CONFIG_IN_OUT" ]; then
  echo "⚠️  WARNING: Config file or symlink already exists in out/"
  echo "   Removing it for safety..."
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed"
  echo ""
fi

echo "📋 SAFE Deployment Workflow:"
echo ""
echo "   1. Copy config file to out/ for Autark to read"
echo "   2. You will manually run 'autark deploy' from out/ directory"
echo "   3. IMMEDIATELY after deployment, remove the config file"
echo "   4. Verify it's not in IPFS before continuing"
echo ""

read -p "Press Enter to copy config file to out/..."

# Copy config file to out/
cp "$CONFIG_IN_ROOT" "$CONFIG_IN_OUT"
echo "✓ Config file copied to: $CONFIG_IN_OUT"
echo ""

cd "$OUT_DIR"
echo "📋 Changed to out/ directory: $(pwd)"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Config file is now in out/ directory"
echo "   - Run your Autark deployment command NOW"
echo "   - IMMEDIATELY after it completes, press Enter to remove the config file"
echo ""
echo "   Run: autark deploy [your-options]"
echo ""
read -p "Press Enter AFTER Autark deployment completes to remove config file..."

# Remove config file
if [ -f "$CONFIG_IN_OUT" ]; then
  rm "$CONFIG_IN_OUT"
  echo "✓ Removed secure-deploy.config.json from out/ directory"
else
  echo "⚠️  Config file not found (maybe already removed?)"
fi

echo ""
echo "✅ Config file removed!"
echo ""
echo "📋 Next Steps:"
echo "   1. Check your IPFS deployment/CID"
echo "   2. Verify secure-deploy.config.json is NOT in the uploaded content"
echo "   3. If it IS there, your keys are exposed - rotate them immediately!"
echo ""

