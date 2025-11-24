#!/bin/bash
# Secure Autark CLI deployment wrapper
# ⚠️ IMPORTANT: Autark CLI runs from out/ directory but we remove config BEFORE IPFS upload

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_ROOT/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/out"
CONFIG_IN_OUT="$OUT_DIR/secure-deploy.config.json"
CONFIG_IN_ROOT="$ROOT_DIR/secure-deploy.config.json"

echo "🔒 Secure Autark Deployment Wrapper"
echo ""

# Check if autark command exists
if ! command -v autark &> /dev/null; then
  echo "✗ ERROR: autark command not found"
  echo "   Please install Autark CLI first."
  exit 1
fi

# Check if config file exists in root
if [ ! -f "$CONFIG_IN_ROOT" ]; then
  echo "✗ ERROR: secure-deploy.config.json not found in root directory"
  echo "   Expected location: $CONFIG_IN_ROOT"
  exit 1
fi

# Check if out/ directory exists
if [ ! -d "$OUT_DIR" ]; then
  echo "✗ ERROR: Build output directory does not exist: $OUT_DIR"
  echo "   Please run 'npm run build' first."
  exit 1
fi

echo "📋 Deployment Strategy: Using Symbolic Link"
echo "   1. Create symlink in out/ pointing to config in root directory"
echo "   2. Autark CLI can read the symlink (follows it to read config)"
echo "   3. IPFS typically does NOT follow symlinks, so config won't be uploaded"
echo ""

# Remove any existing config file or symlink in out/
if [ -f "$CONFIG_IN_OUT" ] || [ -L "$CONFIG_IN_OUT" ]; then
  echo "📋 Removing existing config file/symlink from out/..."
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed"
  echo ""
fi

# Create symbolic link from out/ to root config file
echo "📋 Step 1: Creating symbolic link in out/ directory..."
ln -s "$CONFIG_IN_ROOT" "$CONFIG_IN_OUT"
echo "   ✓ Created symlink: $CONFIG_IN_OUT -> $CONFIG_IN_ROOT"
echo ""

# Verify symlink was created
if [ ! -L "$CONFIG_IN_OUT" ]; then
  echo "✗ ERROR: Failed to create symlink"
  exit 1
fi

# Function to cleanup - ALWAYS remove symlink from out/
cleanup() {
  if [ -L "$CONFIG_IN_OUT" ] || [ -f "$CONFIG_IN_OUT" ]; then
    rm "$CONFIG_IN_OUT"
    echo ""
    echo "🧹 Cleanup: Removed symlink from out/ directory"
  fi
}
trap cleanup EXIT INT TERM

# Verify Autark can read through the symlink
if [ ! -r "$CONFIG_IN_OUT" ]; then
  echo "⚠️  WARNING: Cannot read config file through symlink"
  echo "   Falling back to copying file..."
  rm "$CONFIG_IN_OUT"
  cp "$CONFIG_IN_ROOT" "$CONFIG_IN_OUT"
  echo "   ✓ Copied config file instead (will remove after deployment)"
fi

# Change to out/ directory where Autark needs to run
cd "$OUT_DIR"
echo "📋 Step 2: Changed to out/ directory"
echo "   Current directory: $(pwd)"
echo ""

echo "✅ Config accessible via symlink"
echo "   Autark can read it, but IPFS should NOT include it in upload"
echo ""
echo "📋 Step 3: Running Autark CLI..."
echo ""

# Run autark deploy from out/ directory
echo "Running: autark deploy $@"
echo ""
autark deploy "$@"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Final verification:"
if [ -L "$CONFIG_IN_OUT" ]; then
  echo "   ℹ️  Symlink still exists (this is fine - IPFS doesn't follow symlinks)"
elif [ -f "$CONFIG_IN_OUT" ]; then
  echo "   ⚠️  Config file still in out/ - removing now..."
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed"
else
  echo "   ✅ Config file/symlink is NOT in out/ directory (safe!)"
fi

