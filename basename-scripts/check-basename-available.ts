/**
 * Basename Availability Check
 * 
 * Simple script to check if a basename is available on Base Sepolia.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { normalize } from 'viem/ens';

// ==============================================================================
// CONFIGURATION
// ==============================================================================

// Base Sepolia uses "basetest.eth" as the parent domain (not "base.eth")
const PARENT_DOMAIN = 'basetest.eth';

const REGISTRAR_CONTROLLER = process.env.BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA as `0x${string}`;

// ==============================================================================
// ABI DEFINITION
// ==============================================================================

const REGISTRAR_CONTROLLER_ABI = [
  {
    name: 'available',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

// ==============================================================================
// AVAILABILITY CHECK FUNCTION
// ==============================================================================

/**
 * Check if basename is available on Base Sepolia
 * 
 * @param name - Label only (e.g., "SOMA001", not "SOMA001.base.eth")
 * @returns true if available, false if taken
 */
export async function checkBasenameAvailable(name: string): Promise<boolean> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_RPC_URL!),
  });

  const normalizedName = normalize(name);
  
  const isAvailable = await publicClient.readContract({
    address: REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'available',
    args: [normalizedName],
  });

  return isAvailable as boolean;
}

// ==============================================================================
// CLI ENTRY POINT
// ==============================================================================

/**
 * Example usage:
 * 
 * npx tsx lib/services/check-basename-available.ts SOMA001
 */
async function main() {
  const name = process.argv[2];

  if (!name) {
    console.error('\n❌ Usage: npx tsx lib/services/check-basename-available.ts <name>');
    console.error('   Example: npx tsx lib/services/check-basename-available.ts SOMA001\n');
    process.exit(1);
  }

  try {
    const normalizedName = normalize(name);
    const fullName = `${normalizedName}.${PARENT_DOMAIN}`;
    
    console.log(`\n🔍 Checking availability for: ${fullName}`);
    console.log(`   Label: ${normalizedName}`);
    console.log(`   Network: Base Sepolia (basetest.eth)`);
    
    const isAvailable = await checkBasenameAvailable(normalizedName);
    
    if (isAvailable) {
      console.log(`\n✅ "${fullName}" is AVAILABLE`);
    } else {
      console.log(`\n❌ "${fullName}" is TAKEN`);
    }
    
    process.exit(isAvailable ? 0 : 1);
  } catch (error) {
    console.error(`\n❌ Error checking availability:`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

