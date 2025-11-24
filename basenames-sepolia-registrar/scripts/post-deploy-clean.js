#!/usr/bin/env node
/**
 * Post-deployment cleanup script
 * Removes secure-deploy.config.json from out/ directory after deployment
 * Run this after deploying with Autark CLI
 */

const fs = require('fs')
const path = require('path')

const projectRoot = path.join(__dirname, '..')
const outDir = path.join(projectRoot, 'out')
const configInOut = path.join(outDir, 'secure-deploy.config.json')

console.log('🧹 Cleaning up deployment configuration...')

if (fs.existsSync(configInOut)) {
  try {
    fs.unlinkSync(configInOut)
    console.log('  ✓ Removed secure-deploy.config.json from out/ directory')
    console.log('')
    console.log('✅ Cleanup complete! Build output is now clean.')
  } catch (error) {
    console.error('✗ ERROR: Failed to remove config file:', error.message)
    process.exit(1)
  }
} else {
  console.log('  ℹ️  No config file found in out/ directory (already clean)')
  console.log('')
  console.log('✅ Cleanup complete!')
}

