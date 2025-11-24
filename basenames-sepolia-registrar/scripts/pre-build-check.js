#!/usr/bin/env node
/**
 * Pre-build safety check
 * Warns if sensitive files exist in build output before building
 */

const fs = require('fs')
const path = require('path')

const outDir = path.join(__dirname, '..', 'out')
const sensitiveFiles = ['secure-deploy.config.json']

function checkSensitiveFiles() {
  if (!fs.existsSync(outDir)) {
    // No out directory yet, that's fine
    return
  }

  let found = []
  
  sensitiveFiles.forEach((fileName) => {
    const filePath = path.join(outDir, fileName)
    if (fs.existsSync(filePath)) {
      found.push(fileName)
      // Remove it immediately as a safety measure
      try {
        fs.unlinkSync(filePath)
        console.log(`⚠️  WARNING: Found and removed ${fileName} from out/ directory before build.`)
      } catch (error) {
        console.error(`✗ ERROR: Failed to remove ${fileName}:`, error.message)
        process.exit(1)
      }
    }
  })

  // Also check for any other .config.json files that might be sensitive
  try {
    const files = fs.readdirSync(outDir)
    files.forEach((file) => {
      if (file.includes('.config.json') && file !== 'next.config.js') {
        const filePath = path.join(outDir, file)
        try {
          fs.unlinkSync(filePath)
          console.log(`⚠️  WARNING: Found and removed ${file} from out/ directory before build.`)
          found.push(file)
        } catch (error) {
          console.error(`✗ ERROR: Failed to remove ${file}:`, error.message)
        }
      }
    })
  } catch (error) {
    // Directory read failed, that's okay
  }

  if (found.length > 0) {
    console.log(`\n⚠️  Security Check: Removed ${found.length} sensitive file(s) before build.\n`)
  }
}

checkSensitiveFiles()

