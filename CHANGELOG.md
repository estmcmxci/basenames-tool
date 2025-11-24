# Changelog

## [v12] - 2025-01-XX

### 🎉 Major Enhancements

#### Full ENSIP-5 Standard Record Support
- ✅ Added support for all 17 standard ENS records (ENSIP-5)
  - **10 Global Keys**: avatar, description, display, email, keywords, mail, notice, location, phone, url
  - **6 Service Keys**: com.github, com.peepeth, com.linkedin, com.twitter, io.keybase, org.telegram
  - **1 Address Record**: addr (forward resolution)

#### Enhanced Registration Flow
- ✅ **Expandable Additional Records Section**: All 17 records can now be set during registration
  - Records organized by category: Profile, Contact, Social, Other
  - Clean, collapsible UI for better organization
- ✅ **Real-time Validation**: All fields validate as you type
  - Email format validation
  - Phone number E.164 format validation
  - URL format validation
  - Ethereum address validation
  - Social media username format validation
- ✅ **Validation Summary**: Clear error display before registration
  - Shows all validation errors in one place
  - Register button disabled if validation errors exist

#### Comprehensive Verification System
- ✅ **Automatic Verification After Registration**: 
  - Automatically verifies all 17 records after successful registration
  - Shows complete verification summary with all records
- ✅ **Enhanced Query Feature**:
  - Query tab now shows all 17 standard records (not just a few)
  - Clear status indicators: ✅ Set, ⚠️ Available, ❌ Error
  - Shows which records are set and which are available to configure
- ✅ **Verification Summary Component**:
  - Reusable component displaying verification results
  - Grouped by category with expandable sections
  - Shows completion percentage (e.g., "10/17 records set (59%)")
  - Displays owner and resolver information

### 🔧 Technical Improvements

- ✅ **Hardcoded Contract Addresses**: All Base Sepolia contract addresses now hardcoded
  - No need for `.env.local` file for basic operation
  - Easier setup and deployment
- ✅ **Improved Code Organization**:
  - New validation library (`lib/validate-records.ts`)
  - New verification library (`lib/verify-basename-records.ts`)
  - Modular, reusable components

### 🔒 Security Enhancements

- ✅ **Deployment Security**: Multiple safeguards to prevent exposing sensitive files
  - Pre-build checks to remove sensitive files
  - Post-build cleanup scripts
  - Deployment scripts that protect config files from IPFS upload
  - CLI flags deployment option (config file never in upload directory)

### 📝 New Files

- `lib/validate-records.ts` - Validation utilities for ENSIP-5 records
- `lib/verify-basename-records.ts` - On-chain verification library
- `components/VerificationSummary.tsx` - Reusable verification display component
- `scripts/` - Deployment and security scripts
  - `autark-deploy-cli-flags.sh` - Safe deployment using CLI flags
  - `autark-deploy-safe.sh` - Manual safe deployment
  - `clean-build.js` - Post-build cleanup
  - `pre-build-check.js` - Pre-build security check
- `DEPLOYMENT_SECURITY.md` - Security documentation

### 🔄 Modified Files

- `components/RegisterBasename.tsx` - Full ENSIP-5 record support with validation
- `components/QueryBasename.tsx` - Enhanced with full verification display
- `lib/check-basename-available.ts` - Hardcoded contract addresses
- `lib/query-basenames.ts` - Hardcoded contract addresses
- `package.json` - Added build scripts for security checks

### 🐛 Bug Fixes

- Fixed address record display in verification summary
- Fixed node calculation for Basenames-specific subname handling
- Improved error handling and user feedback

### 📚 Documentation

- Added `DEPLOYMENT_SECURITY.md` with deployment best practices
- Updated README with new features
- Added deployment scripts documentation

---

**Live Demo**: [https://v12.oakgroup.eth.limo/](https://v12.oakgroup.eth.limo/)

