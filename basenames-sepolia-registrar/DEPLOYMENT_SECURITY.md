# Deployment Security Guide

## ⚠️ CRITICAL: Protecting Sensitive Files from IPFS Upload

**The Problem:** If `secure-deploy.config.json` is in the `out/` directory when you run `autark deploy`, it **WILL be included in the IPFS upload**, making your private keys publicly accessible!

## ✅ Safe Deployment Workflow

### ⚠️ CRITICAL: Config file MUST be removed from `out/` BEFORE deployment

**The Problem:** If `secure-deploy.config.json` is in `out/` when you run `autark deploy`, it WILL be uploaded to IPFS!

### Option 1: Use the Secure Wrapper Script (Recommended)

This script ensures the config file is NOT in `out/` during deployment:

```bash
cd basenames-sepolia-registrar

# Step 1: Build (automatically removes config from out/)
npm run build

# Step 2: Verify config is NOT in out/
find out -name "secure-deploy.config.json"
# Should return nothing

# Step 3: Deploy using secure wrapper
# (Runs from root directory where config lives, but config is NOT in out/)
./scripts/autark-deploy.sh deploy
```

### Option 2: Manual Safe Deployment (Safest)

**Key principle: Config file must be OUTSIDE the `out/` directory during deployment**

```bash
cd basenames-sepolia-registrar

# Step 1: Build (automatically removes config from out/)
npm run build

# Step 2: Verify config is NOT in out/ (CRITICAL CHECK!)
find out -name "secure-deploy.config.json"
# MUST return nothing - if it finds the file, DELETE IT:
# rm out/secure-deploy.config.json

# Step 3: Deploy from parent directory
# Autark CLI reads config from current directory (root), not from out/
cd ..
autark deploy

# The config file is in the root directory, NOT in out/
# So it will be read by Autark but NOT uploaded to IPFS
```

### Option 3: Deploy from out/ Directory (NOT Recommended - Risky)

Only if Autark CLI absolutely requires running from `out/`:

```bash
cd basenames-sepolia-registrar
npm run build  # Removes config automatically

# CRITICAL: Verify config is NOT in out/
find out -name "secure-deploy.config.json"
# MUST return nothing

# Deploy from out/ (config file is NOT there, so it won't be uploaded)
cd out
autark deploy
```

## How the Secure Wrapper Works

The `autark-deploy.sh` script:
1. ✅ Verifies config file exists in `out/`
2. ✅ Creates a temporary backup
3. ✅ **Removes config from `out/` BEFORE running autark**
4. ✅ Temporarily restores it just for Autark to read
5. ✅ **Removes it immediately after Autark reads it (before IPFS upload)**
6. ✅ Automatically cleans up on exit

## Files Protected

- ✅ `secure-deploy.config.json` - Contains private keys and API keys
- ✅ Any other `*.config.json` files (except `next.config.js`)

## Automatic Protection

The build process automatically:
1. **Pre-build check**: Removes sensitive files before building
2. **Post-build cleanup**: Removes sensitive files after building

## Verification Checklist

Before deploying, always verify:

```bash
cd basenames-sepolia-registrar

# Check that config is NOT in out/
find out -name "secure-deploy.config.json"
# Should return nothing

# If it returns a file, remove it immediately:
rm out/secure-deploy.config.json
```

## What Happened Previously

Previously, `secure-deploy.config.json` was accidentally included in the `out/` directory, which meant:
- ❌ If deployed to IPFS, it would be publicly accessible
- ❌ Private keys and API keys would be exposed
- ❌ Anyone could access your Safe wallet and API keys

## Current Protection Layers

1. ✅ `.gitignore` - Prevents committing the file
2. ✅ Pre-build script - Removes it before building
3. ✅ Post-build script - Removes it after building
4. ✅ Secure deployment wrapper - Removes it before IPFS upload
5. ✅ Manual verification - You can check before deploying

## Best Practices

1. **ALWAYS** verify `out/` doesn't contain the config file before deploying
2. **NEVER** manually copy `secure-deploy.config.json` to the `out/` directory
3. **USE** the secure wrapper script for deployment
4. **CHECK** IPFS gateway after deployment to verify config file is not accessible
5. **ROTATE** keys if you ever accidentally uploaded the config file

## Emergency: If You Already Deployed With Config File

If you accidentally deployed with the config file:

1. **Immediately rotate all exposed credentials:**
   - Generate new private key
   - Revoke old API keys
   - Transfer funds from exposed wallet

2. **Remove from IPFS:**
   - Unpin the content from IPFS
   - Update ENS record to point to new deployment

3. **Deploy clean version:**
   - Follow the safe deployment workflow above
   - Verify config file is NOT in the IPFS upload
