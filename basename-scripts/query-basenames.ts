/**
 * Basenames Query Tool - Read Basename Records from Base Sepolia
 * 
 * This script queries Basename records on Base Sepolia (basetest.eth subdomains).
 * Basenames uses ENS-compatible interfaces, so the query logic is similar to ENS.
 * 
 * Usage:
 *   npx tsx lib/services/query-basenames.ts somasomasoma.basetest.eth
 *   npx tsx lib/services/query-basenames.ts scenius.basetest.eth
 * 
 * What it does:
 * 1. Connects to Base Sepolia via RPC
 * 2. Resolves the Basename to find its resolver contract
 * 3. Queries address records and text records
 * 4. Displays the complete metadata
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createPublicClient, http, type Address, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { normalize, namehash } from 'viem/ens';
import { keccak256, encodePacked, toBytes } from 'viem';

// ============================================================================
// PART 1: Configuration
// ============================================================================
const REGISTRY = process.env.BASENAMES_REGISTRY_BASE_SEPOLIA as `0x${string}`;
const RESOLVER = process.env.BASENAMES_RESOLVER_BASE_SEPOLIA as `0x${string}`;
const REVERSE_REGISTRAR = process.env.BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA as `0x${string}`;
const PARENT_DOMAIN = 'basetest.eth';
const PARENT_NODE = namehash(PARENT_DOMAIN) as `0x${string}`;

// ============================================================================
// PART 2: Initialize Viem Public Client
// ============================================================================
// Creates a read-only client to query Base Sepolia blockchain
// - No private key needed (read-only operations)
// - Uses BASE_RPC_URL from .env.local
// - Connects to Base Sepolia testnet where Basenames are registered
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_RPC_URL),
});

// ============================================================================
// PART 3: ABI Definitions
// ============================================================================
const REGISTRY_ABI = [
  {
    name: 'resolver',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
] as const;

const RESOLVER_ABI = [
  {
    name: 'addr',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'text',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ type: 'string' }],
  },
] as const;

const REVERSE_REGISTRAR_ABI = [
  {
    name: 'node',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

// ============================================================================
// PART 2: Define Custom Text Record Keys (if needed)
// ============================================================================
// These are custom text records that might be set
// Format: eth.scenedex.* (or your custom namespace)
const CUSTOM_RECORD_KEYS = {
  description: 'description',
  // Add more custom keys as needed
};

// ============================================================================
// PART 3: Standard ENS Keys (ENSIP-5)
// ============================================================================
// These are standard ENS keys that work across all ENS-compatible apps
const STANDARD_ENS_KEYS = {
  // Avatar image (cover art)
  avatar: 'avatar',
  
  // Human-readable description
  description: 'description',
  
  // Ethereum address this name resolves to
  // Note: This is also available via getEnsAddress()
  address: 'address',
};

// ============================================================================
// PART 4: Query Function - Get All Records for a Basename
// ============================================================================
/**
 * Calculate subname node hash (same as Basenames uses)
 */
function calculateSubnameNode(label: string, rootNode: `0x${string}`): `0x${string}` {
  const labelHash = keccak256(toBytes(label));
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rootNode, labelHash]));
}

/**
 * Extract label from full basename
 * e.g., "somasomasoma.basetest.eth" -> "somasomasoma"
 */
function extractLabel(fullName: string): string {
  const parts = fullName.split('.');
  if (parts.length === 0) return fullName;
  return parts[0];
}

/**
 * Queries all records from Basenames for a given name
 * 
 * How it works:
 * 1. Normalizes the Basename (lowercase, proper encoding)
 * 2. Calculates the node hash using Basenames algorithm
 * 3. Queries registry for resolver address
 * 4. Queries resolver for address and text records
 * 5. Returns structured object with all metadata
 * 
 * @param basename - Full Basename (e.g., "somasomasoma.basetest.eth")
 * @returns Object containing all on-chain metadata
 */
export async function queryBasename(basename: string) {
  console.log(`\n🔍 Querying Basename Records for: ${basename}`);
  console.log(`================================================\n`);
  
  // Normalize the Basename (required for proper namehash calculation)
  const normalizedName = normalize(basename);
  console.log(`✅ Normalized name: ${normalizedName}\n`);
  
  try {
    // Extract label (e.g., "somasomasoma" from "somasomasoma.basetest.eth")
    const label = extractLabel(normalizedName);
    console.log(`📋 Label: ${label}\n`);
    
    // Calculate node hash using Basenames algorithm
    const node = calculateSubnameNode(label, PARENT_NODE);
    console.log(`📋 Node hash: ${node}\n`);
    
    // ========================================================================
    // Step 1: Get the resolver address from registry
    // ========================================================================
    console.log(`📋 Step 1: Fetching resolver contract from registry...`);
    const resolver = await publicClient.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    }) as Address;
    
    if (!resolver || resolver === '0x0000000000000000000000000000000000000000') {
      console.log(`   No resolver (name not registered or no resolver set)\n`);
      return {
        basename: normalizedName,
        node,
        resolver: null,
        owner: null,
        addressRecord: null,
        primaryName: null,
        records: {},
      };
    }
    console.log(`   Resolver: ${resolver}\n`);
    
    // ========================================================================
    // Step 2: Get owner from registry
    // ========================================================================
    console.log(`📋 Step 2: Fetching owner from registry...`);
    const owner = await publicClient.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'owner',
      args: [node],
    }) as Address;
    console.log(`   Owner: ${owner}\n`);
    
    // ========================================================================
    // Step 3: Query address record from resolver (forward resolution: name → address)
    // ========================================================================
    console.log(`📋 Step 3: Querying address record (forward resolution: name → address)...`);
    console.log(`   Resolver contract: ${resolver}`);
    console.log(`   Node hash: ${node}`);
    let addressRecord: Address | null = null;
    try {
      addressRecord = await publicClient.readContract({
        address: resolver,
        abi: RESOLVER_ABI,
        functionName: 'addr',
        args: [node],
      }) as Address;
      
      // Check if it's a zero address (not set)
      if (addressRecord === '0x0000000000000000000000000000000000000000') {
        console.log(`   Address Record: Not set (zero address)\n`);
        addressRecord = null;
      } else {
        console.log(`   Address Record: ${addressRecord}\n`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown';
      console.log(`   Address Record: Query failed (error: ${errorMsg})\n`);
      console.log(`   This might mean the address record is not set, or the resolver doesn't support addr()\n`);
    }
    
    // ========================================================================
    // Step 4: Query standard ENS text records
    // ========================================================================
    console.log(`📋 Step 4: Querying standard text records...`);
    const records: Record<string, string | null> = {};
    
    for (const [key, recordKey] of Object.entries(STANDARD_ENS_KEYS)) {
      try {
        const value = await publicClient.readContract({
          address: resolver,
          abi: RESOLVER_ABI,
          functionName: 'text',
          args: [node, recordKey],
        }) as string;
        records[key] = value || null;
        console.log(`   ${recordKey}: ${value || 'Not set'}`);
      } catch (error) {
        records[key] = null;
        console.log(`   ${recordKey}: Not set`);
      }
    }
    console.log();
    
    // ========================================================================
    // Step 5: Check reverse resolution (address → name) - This is the "Primary Name"
    // ========================================================================
    let primaryName: string | null = null;
    if (addressRecord) {
      console.log(`📋 Step 5: Checking reverse resolution / Primary Name (address → name)...`);
      console.log(`   Address: ${addressRecord}`);
      try {
        // Get the reverse node for this address
        const reverseNode = await publicClient.readContract({
          address: REVERSE_REGISTRAR,
          abi: REVERSE_REGISTRAR_ABI,
          functionName: 'node',
          args: [addressRecord],
        }) as `0x${string}`;
        
        if (reverseNode !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
          // Query the resolver for the name record
          try {
            primaryName = await publicClient.readContract({
              address: RESOLVER,
              abi: RESOLVER_ABI,
              functionName: 'name',
              args: [reverseNode],
            }) as string;
            console.log(`   ✅ Primary Name: ${addressRecord} → ${primaryName}`);
          } catch (error) {
            console.log(`   ❌ Primary Name: Not set (name record not found)`);
          }
        } else {
          console.log(`   ❌ Primary Name: Not set (no reverse node)`);
        }
      } catch (error) {
        console.log(`   ❌ Primary Name: Failed to query (${error instanceof Error ? error.message : 'Unknown'})`);
      }
      console.log();
    }
    
    // ========================================================================
    // Step 6: Return structured data
    // ========================================================================
    return {
      basename: normalizedName,
      node,
      resolver,
      owner,
      addressRecord, // Forward resolution: name → address
      primaryName,   // Reverse resolution / Primary Name: address → name
      records,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error querying Basename:`, errorMessage);
    throw error;
  }
}

// ============================================================================
// PART 5: Display Helper - Pretty Print Results
// ============================================================================
/**
 * Formats and displays query results in a readable way
 */
function displayResults(data: Awaited<ReturnType<typeof queryBasename>>) {
  console.log(`\n================================================`);
  console.log(`✅ QUERY COMPLETE`);
  console.log(`================================================\n`);
  
  console.log(`📍 Basename: ${data.basename}`);
  console.log(`📍 Node Hash: ${data.node}`);
  console.log(`📍 Owner: ${data.owner || 'Not set'}`);
  console.log(`📍 Resolver: ${data.resolver || 'Not set'}`);
  console.log(`📍 Address Record (Forward): ${data.addressRecord || 'Not set'}`);
  console.log(`📍 Primary Name (Reverse): ${data.primaryName || '❌ NOT SET'}\n`);
  
  // Explain the difference using correct ENS terminology
  if (data.addressRecord) {
    console.log(`📊 Resolution Status:`);
    console.log(`   ✅ Forward Resolution: ${data.basename} → ${data.addressRecord}`);
    if (data.primaryName) {
      console.log(`   ✅ Reverse Resolution (Primary Name): ${data.addressRecord} → ${data.primaryName}`);
    } else {
      console.log(`   ❌ Reverse Resolution (Primary Name): ${data.addressRecord} → (not set - authorization failed)`);
    }
    console.log();
  }
  
  if (data.addressRecord) {
    console.log(`🔗 View on BaseScan:`);
    console.log(`   Address: https://sepolia.basescan.org/address/${data.addressRecord}`);
    if (data.owner) {
      console.log(`   Owner:  https://sepolia.basescan.org/address/${data.owner}`);
    }
    console.log();
  }
  
  console.log(`📝 Text Records:`);
  for (const [key, value] of Object.entries(data.records)) {
    console.log(`   ${key}: ${value || 'Not set'}`);
  }
  console.log();
  
  console.log(`🌐 View on ENS App (Base Sepolia):`);
  console.log(`   https://app.ens.domains/${data.basename}\n`);
}

// ============================================================================
// PART 6: CLI Entry Point
// ============================================================================
/**
 * Main execution function
 * Parses command-line arguments and runs the query
 */
async function main() {
  // Get Basename from command line argument
  // Example: npx tsx lib/services/query-basenames.ts somasomasoma.basetest.eth
  const basename = process.argv[2];
  
  if (!basename) {
    console.error(`\n❌ Usage: npx tsx lib/services/query-basenames.ts <basename>`);
    console.error(`   Example: npx tsx lib/services/query-basenames.ts somasomasoma.basetest.eth\n`);
    process.exit(1);
  }
  
  try {
    // Run the query
    const data = await queryBasename(basename);
    
    // Display results
    displayResults(data);
    
    // Exit successfully
    process.exit(0);
    
  } catch (error) {
    console.error(`\n❌ Failed to query Basename\n`);
    process.exit(1);
  }
}

// Run if executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export for use in other modules
export { STANDARD_ENS_KEYS };

