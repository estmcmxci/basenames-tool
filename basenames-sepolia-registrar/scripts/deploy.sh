#!/bin/bash
# Deployment script with secure config file handling
# This script ensures secure-deploy.config.json is available for Autark CLI
# but removed after deployment

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_ROOT/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/out"
CONFIG_FILE="$ROOT_DIR/secure-deploy.config.json"
CONFIG_IN_OUT="$OUT_DIR/secure-deploy.config.json"

echo "🚀 Starting deployment process..."

# Step 1: Ensure build is clean (remove any existing config file)
echo "📋 Step 1: Cleaning build output..."
if [ -f "$CONFIG_IN_OUT" ]; then
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed existing secure-deploy.config.json from out/"
fi

# Step 2: Run pre-build check
echo "📋 Step 2: Running pre-build safety check..."
npm run prebuild

# Step 3: Build the application
echo "📋 Step 3: Building application..."
npm run build

# Step 4: Verify build output is clean
echo "📋 Step 4: Verifying build output is clean..."
if [ -f "$CONFIG_IN_OUT" ]; then
  echo "   ⚠️  WARNING: secure-deploy.config.json found in build output (shouldn't happen)"
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed it"
fi

# Step 5: Copy config file to out/ directory for Autark CLI
echo "📋 Step 5: Preparing config file for deployment..."
if [ ! -f "$CONFIG_FILE" ]; then
  echo "   ✗ ERROR: secure-deploy.config.json not found in root directory: $CONFIG_FILE"
  exit 1
fi

cp "$CONFIG_FILE" "$CONFIG_IN_OUT"
echo "   ✓ Copied secure-deploy.config.json to out/ directory"

# Step 6: Deploy using Autark CLI (assuming you run it from the out/ directory or root)
echo ""
echo "📋 Step 6: Ready for Autark CLI deployment"
echo "   Config file is now in: $CONFIG_IN_OUT"
echo ""
echo "   You can now run Autark CLI deployment commands."
echo "   After deployment completes, the config file will be automatically removed."
echo ""
echo "   Example:"
echo "   cd $OUT_DIR"
echo "   autark deploy"
echo ""
read -p "   Press Enter when deployment is complete to clean up..."

# Step 7: Clean up - remove config file from out/ directory
echo ""
echo "📋 Step 7: Cleaning up..."
if [ -f "$CONFIG_IN_OUT" ]; then
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed secure-deploy.config.json from out/ directory"
fi

echo ""
echo "✅ Deployment process complete!"
echo "   Build output is clean and ready for IPFS or other static hosting."

