#!/usr/bin/env node
/**
 * Post-build cleanup script
 * Removes sensitive files from build output
 */

const fs = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..', 'out')
const sensitiveFiles = [
  'secure-deploy.config.json',
  '*.config.json', // Also check for any other config.json files
]

function cleanSensitiveFiles() {
  if (!fs.existsSync(outDir)) {
    console.log('ℹ️  Build output directory does not exist, skipping cleanup.')
    return
  }

  let cleaned = 0
  
  // Check for specific sensitive files
  sensitiveFiles.forEach((pattern) => {
    if (pattern.includes('*')) {
      // Handle glob patterns - find all matching files
      const files = fs.readdirSync(outDir)
      files.forEach((file) => {
        if (file.includes('.config.json') && file !== 'next.config.js') {
          const filePath = path.join(outDir, file)
          try {
            fs.unlinkSync(filePath)
            console.log(`✓ Removed ${file} from build output`)
            cleaned++
          } catch (error) {
            console.error(`✗ Failed to remove ${file}:`, error.message)
          }
        }
      })
    } else {
      // Handle specific files
      const filePath = path.join(outDir, pattern)
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
          console.log(`✓ Removed ${pattern} from build output`)
          cleaned++
        } catch (error) {
          console.error(`✗ Failed to remove ${pattern}:`, error.message)
        }
      }
    }
  })

  if (cleaned === 0) {
    console.log('✓ Build output is clean - no sensitive files found.')
  } else {
    console.log(`✓ Cleaned ${cleaned} sensitive file(s) from build output.`)
  }
}

cleanSensitiveFiles()

