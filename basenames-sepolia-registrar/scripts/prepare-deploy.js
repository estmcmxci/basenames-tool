#!/usr/bin/env node
/**
 * Prepare deployment script
 * Copies secure-deploy.config.json to out/ directory for Autark CLI
 * Run this after building, before deploying
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const rootDir = path.join(projectRoot, '..')
const outDir = path.join(projectRoot, 'out')
const configFile = path.join(rootDir, 'secure-deploy.config.json')
const configInOut = path.join(outDir, 'secure-deploy.config.json')

console.log('📋 Preparing deployment configuration...')

// Check if build output exists
if (!fs.existsSync(outDir)) {
  console.error('✗ ERROR: Build output directory does not exist.')
  console.error('  Please run "npm run build" first.')
  process.exit(1)
}

// Check if config file exists in root
if (!fs.existsSync(configFile)) {
  console.error('✗ ERROR: secure-deploy.config.json not found in root directory.')
  console.error(`  Expected location: ${configFile}`)
  process.exit(1)
}

// Remove any existing config file in out/ (safety check)
if (fs.existsSync(configInOut)) {
  fs.unlinkSync(configInOut)
  console.log('  ✓ Removed existing secure-deploy.config.json from out/')
}

// Copy config file to out/ directory
try {
  fs.copyFileSync(configFile, configInOut)
  console.log(`  ✓ Copied secure-deploy.config.json to out/ directory`)
  console.log('')
  console.log('✅ Deployment configuration ready!')
  console.log(`   Config file is now at: ${configInOut}`)
  console.log('')
  console.log('   You can now run Autark CLI deployment commands.')
  console.log('   After deployment, run: npm run post-deploy-clean')
  console.log('')
} catch (error) {
  console.error('✗ ERROR: Failed to copy config file:', error.message)
  process.exit(1)
}

