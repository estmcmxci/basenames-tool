#!/bin/bash
# Test script to check if IPFS/Autark follows symlinks
# This creates a test scenario to see what gets uploaded

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_ROOT/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/out"
TEST_FILE="$ROOT_DIR/TEST_FILE_DO_NOT_UPLOAD.txt"
TEST_SYMLINK="$OUT_DIR/TEST_FILE_DO_NOT_UPLOAD.txt"

echo "🧪 Testing if IPFS/Autark follows symlinks"
echo ""

# Create a test file in root
echo "Creating test file in root directory..."
echo "THIS FILE SHOULD NOT BE UPLOADED TO IPFS" > "$TEST_FILE"
echo "✓ Created: $TEST_FILE"

# Create symlink in out/
echo "Creating symlink in out/ directory..."
ln -sf "$TEST_FILE" "$TEST_SYMLINK"
echo "✓ Created symlink: $TEST_SYMLINK -> $TEST_FILE"
echo ""

echo "📋 Test Setup Complete:"
echo "   - Test file exists in root: $TEST_FILE"
echo "   - Symlink exists in out/: $TEST_SYMLINK"
echo ""
echo "⚠️  Next steps:"
echo "   1. Run 'autark deploy' from out/ directory"
echo "   2. Check the IPFS upload/CID"
echo "   3. Check if TEST_FILE_DO_NOT_UPLOAD.txt appears in the IPFS content"
echo "   4. If it DOES appear: Autark/IPFS follows symlinks (BAD for our use case)"
echo "   5. If it DOESN'T appear: Autark/IPFS doesn't follow symlinks (GOOD - safe to use)"
echo ""
echo "After testing, run this script again with 'cleanup' to remove test files"
echo ""

# Cleanup function
if [ "$1" = "cleanup" ]; then
  echo "🧹 Cleaning up test files..."
  [ -f "$TEST_FILE" ] && rm "$TEST_FILE" && echo "✓ Removed test file"
  [ -L "$TEST_SYMLINK" ] && rm "$TEST_SYMLINK" && echo "✓ Removed symlink"
  echo "✅ Cleanup complete"
fi

