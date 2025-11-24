#!/bin/bash
# SAFEST Autark deployment - uses CLI flags instead of config file
# No config file needed in out/ directory - completely safe!

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PROJECT_ROOT/.." && pwd)"
OUT_DIR="$PROJECT_ROOT/out"
CONFIG_FILE="$ROOT_DIR/secure-deploy.config.json"

echo "🔒 SAFEST Autark Deployment (Using CLI Flags)"
echo "✅ No config file in out/ directory needed!"
echo ""

# Check if autark command exists
if ! command -v autark &> /dev/null; then
  echo "✗ ERROR: autark command not found"
  exit 1
fi

# Check if config file exists in root (to read values from)
if [ ! -f "$CONFIG_FILE" ]; then
  echo "✗ ERROR: secure-deploy.config.json not found in root directory"
  exit 1
fi

# Check if out/ directory exists
if [ ! -d "$OUT_DIR" ]; then
  echo "✗ ERROR: Build output directory does not exist"
  echo "   Please run 'npm run build' first."
  exit 1
fi

# Verify config is NOT in out/
CONFIG_IN_OUT="$OUT_DIR/secure-deploy.config.json"
if [ -f "$CONFIG_IN_OUT" ] || [ -L "$CONFIG_IN_OUT" ]; then
  echo "⚠️  WARNING: Config file found in out/ - removing for safety..."
  rm "$CONFIG_IN_OUT"
  echo "   ✓ Removed"
  echo ""
fi

# Read config values from JSON file (using Node.js or jq if available)
echo "📋 Reading config values from: $CONFIG_FILE"
echo ""

# Try to parse JSON - use Node.js if available, otherwise jq
if command -v node &> /dev/null; then
  NETWORK=$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$CONFIG_FILE'));console.log(c.network||'mainnet')")
  RPC_URL=$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$CONFIG_FILE'));console.log(c.rpcUrl||'')")
  ENS_DOMAIN=$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$CONFIG_FILE'));console.log(c.ensDomain||'')")
  SAFE_ADDRESS=$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$CONFIG_FILE'));console.log(c.safeAddress||'')")
  OWNER_PRIVATE_KEY=$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$CONFIG_FILE'));console.log(c.ownerPrivateKey||'')")
  SAFE_API_KEY=$(node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$CONFIG_FILE'));console.log(c.safeApiKey||'')")
elif command -v jq &> /dev/null; then
  NETWORK=$(jq -r '.network // "mainnet"' "$CONFIG_FILE")
  RPC_URL=$(jq -r '.rpcUrl // ""' "$CONFIG_FILE")
  ENS_DOMAIN=$(jq -r '.ensDomain // ""' "$CONFIG_FILE")
  SAFE_ADDRESS=$(jq -r '.safeAddress // ""' "$CONFIG_FILE")
  OWNER_PRIVATE_KEY=$(jq -r '.ownerPrivateKey // ""' "$CONFIG_FILE")
  SAFE_API_KEY=$(jq -r '.safeApiKey // ""' "$CONFIG_FILE")
else
  echo "✗ ERROR: Need either 'node' or 'jq' to parse JSON config file"
  echo "   Install Node.js or jq, or manually pass config via environment variables"
  exit 1
fi

# Build Autark command with CLI flags
AUTARK_CMD="autark deploy \"$OUT_DIR\""

if [ -n "$NETWORK" ]; then
  AUTARK_CMD="$AUTARK_CMD --network \"$NETWORK\""
fi

if [ -n "$RPC_URL" ]; then
  AUTARK_CMD="$AUTARK_CMD --rpc-url \"$RPC_URL\""
fi

if [ -n "$ENS_DOMAIN" ]; then
  AUTARK_CMD="$AUTARK_CMD --ens-domain \"$ENS_DOMAIN\""
fi

if [ -n "$SAFE_ADDRESS" ]; then
  AUTARK_CMD="$AUTARK_CMD --safe-address \"$SAFE_ADDRESS\""
fi

if [ -n "$OWNER_PRIVATE_KEY" ]; then
  AUTARK_CMD="$AUTARK_CMD --owner-private-key \"$OWNER_PRIVATE_KEY\""
fi

if [ -n "$SAFE_API_KEY" ]; then
  AUTARK_CMD="$AUTARK_CMD --safe-api-key \"$SAFE_API_KEY\""
fi

echo "✅ Config values extracted from: $CONFIG_FILE"
echo "   Network: $NETWORK"
echo "   ENS Domain: $ENS_DOMAIN"
echo "   Safe Address: ${SAFE_ADDRESS:0:10}..."
echo ""
echo "📋 Deployment Command:"
echo "   $AUTARK_CMD"
echo ""
echo "🔒 Security: Config file is NOT in out/ directory"
echo "   It will NOT be uploaded to IPFS!"
echo ""

read -p "Press Enter to proceed with deployment..."

# Run from root directory (config file is here, but we're deploying out/)
cd "$ROOT_DIR"

# Execute the command
eval "$AUTARK_CMD"

echo ""
echo "✅ Deployment complete!"
echo "🔒 Config file was never in out/ directory - completely safe!"

