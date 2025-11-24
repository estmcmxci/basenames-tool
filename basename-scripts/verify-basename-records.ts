/**
 * Verify Basename Records - Direct Resolver Query
 * 
 * Queries the resolver contract directly to verify all records were set correctly
 * This works on Base Sepolia where Universal Resolver isn't available
 * 
 * Usage:
 *   npx tsx lib/services/verify-basename-records.ts eros006.scenius.basetest.eth
 */

import { createPublicClient, http, decodeFunctionResult, encodeFunctionData } from 'viem';
import { baseSepolia } from 'viem/chains';
import { normalize, namehash } from 'viem/ens';
import { keccak256, encodePacked, toBytes } from 'viem';

// Default public Base Sepolia RPC (fallback if BASE_RPC_URL not set)
const DEFAULT_BASE_RPC_URL = 'https://sepolia.base.org';

const RESOLVER_ADDRESS = process.env.ENS_RESOLVER_BASE_SEPOLIA || '0x85C87e548091f204C2d0350b39ce1874f02197c6';
const REGISTRY_ADDRESS = '0x1493b2567056c2181630115660963E13A8E32735'; // Base Sepolia Registry
const REVERSE_REGISTRAR = process.env.BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA || '0x876eF94ce0773052a2f81921E70FF25a5e76841f';
const SAFE_ADDRESS = process.env.SAFE_ADDRESS || process.env.CURATOR_SAFE_ADDRESS || '0x09b27FEbCAc92408628515132695E046B9dF929B';

const RESOLVER_ABI = [
  {
    name: 'addr',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: 'addr', type: 'address' }],
  },
  {
    name: 'text',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
    ],
    outputs: [{ name: 'value', type: 'string' }],
  },
] as const;

const REGISTRY_ABI = [
  {
    name: 'resolver',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: 'resolver', type: 'address' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: 'owner', type: 'address' }],
  },
] as const;

const REVERSE_REGISTRAR_ABI = [
  {
    name: 'node',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: 'node', type: 'bytes32' }],
  },
] as const;

const RESOLVER_NAME_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: 'name', type: 'string' }],
  },
] as const;

const RPC_URL = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL;
const PARENT_DOMAIN = 'basetest.eth';
const PARENT_NODE = namehash(PARENT_DOMAIN) as `0x${string}`;

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

/**
 * Calculate subname node hash (same as Basenames uses)
 * This is the Basenames-specific algorithm for calculating subname nodes
 */
function calculateSubnameNode(label: string, rootNode: `0x${string}`): `0x${string}` {
  const labelHash = keccak256(toBytes(label));
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rootNode, labelHash]));
}

/**
 * Extract label from full basename
 * e.g., "eros006.scenius.basetest.eth" -> "eros006"
 */
function extractLabel(fullName: string): string {
  const parts = fullName.split('.');
  if (parts.length === 0) return fullName;
  return parts[0];
}

// Expected records based on buildRecordsFromRelease
const EXPECTED_RECORDS = [
  'avatar',
  'description',
  'address', // Text record (separate from addr)
  'eth.scenedex.releaseId',
  'eth.scenedex.artists',
  'eth.scenedex.mediaIPFS',
  'eth.scenedex.metadataURI',
  'eth.scenedex.zoraCoinAddress',
  'eth.scenedex.zoraCoinSymbol',
  'eth.scenedex.splitAddress',
];

async function verifyBasenameRecords(ensName: string) {
  console.log(`\n🔍 VERIFYING BASENAME RECORDS`);
  console.log(`================================================\n`);
  console.log(`Basename: ${ensName}\n`);
  
  // Normalize the Basename (required for proper node calculation)
  const normalizedName = normalize(ensName);
  console.log(`✅ Normalized name: ${normalizedName}\n`);
  
  // Extract label and calculate node using Basenames algorithm
  const label = extractLabel(normalizedName);
  console.log(`📋 Label: ${label}\n`);
  
  const node = calculateSubnameNode(label, PARENT_NODE);
  console.log(`Node: ${node}\n`);
  
  // Step 1: Check if subname exists in Registry
  console.log(`📋 Step 1: Checking Registry...`);
  const owner = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'owner',
    args: [node],
  });
  
  if (owner === '0x0000000000000000000000000000000000000000') {
    console.log(`   ❌ Subname does not exist in Registry`);
    return;
  }
  console.log(`   ✅ Owner: ${owner}`);
  
  // Step 2: Get resolver address
  const resolverAddress = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'resolver',
    args: [node],
  });
  
  if (resolverAddress === '0x0000000000000000000000000000000000000000') {
    console.log(`   ❌ No resolver set`);
    return;
  }
  console.log(`   ✅ Resolver: ${resolverAddress}`);
  
  if (resolverAddress.toLowerCase() !== RESOLVER_ADDRESS.toLowerCase()) {
    console.log(`   ⚠️  Warning: Resolver doesn't match expected (${RESOLVER_ADDRESS})`);
  }
  console.log();
  
  // Step 3: Query address record (addr)
  console.log(`📋 Step 2: Querying address record (addr)...`);
  try {
    const addr = await publicClient.readContract({
      address: resolverAddress as `0x${string}`,
      abi: RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    });
    console.log(`   ✅ Address: ${addr}`);
  } catch (error) {
    console.log(`   ❌ Failed to query address: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();
  
  // Step 4: Query all text records
  console.log(`📋 Step 3: Querying text records...\n`);
  const results: Record<string, { expected: boolean; value: string | null; status: string }> = {};
  
  for (const key of EXPECTED_RECORDS) {
    try {
      const value = await publicClient.readContract({
        address: resolverAddress as `0x${string}`,
        abi: RESOLVER_ABI,
        functionName: 'text',
        args: [node, key],
      });
      
      const hasValue = value && value !== '';
      results[key] = {
        expected: true,
        value: hasValue ? value : null,
        status: hasValue ? '✅ SET' : '❌ EMPTY',
      };
      
      if (hasValue) {
        const displayValue = value.length > 60 ? `${value.substring(0, 60)}...` : value;
        console.log(`   ${results[key].status} ${key}: ${displayValue}`);
      } else {
        console.log(`   ${results[key].status} ${key}: (empty)`);
      }
    } catch (error) {
      results[key] = {
        expected: true,
        value: null,
        status: '❌ ERROR',
      };
      console.log(`   ${results[key].status} ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Step 5: Check reverse record (primary name for Safe address)
  // The reverse record should set Safe address → scenius.basetest.eth (parent domain)
  const PARENT_DOMAIN = process.env.ENS_DOMAIN || 'scenius.basetest.eth';
  console.log(`📋 Step 4: Checking reverse record (primary name)...`);
  console.log(`   Safe Address: ${SAFE_ADDRESS}`);
  console.log(`   Expected primary name: ${PARENT_DOMAIN}\n`);
  
  let primaryName: string | null = null;
  try {
    // Get reverse node for Safe address
    const reverseNode = await publicClient.readContract({
      address: REVERSE_REGISTRAR as `0x${string}`,
      abi: REVERSE_REGISTRAR_ABI,
      functionName: 'node',
      args: [SAFE_ADDRESS as `0x${string}`],
    });
    
    if (reverseNode === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log(`   ❌ No reverse record set (reverse node is zero)`);
    } else {
      console.log(`   ✅ Reverse node found: ${reverseNode}`);
      
      // Query resolver for the name
      try {
        primaryName = await publicClient.readContract({
          address: RESOLVER_ADDRESS as `0x${string}`,
          abi: RESOLVER_NAME_ABI,
          functionName: 'name',
          args: [reverseNode],
        });
        
        if (primaryName && primaryName !== '') {
          console.log(`   ✅ Primary name: ${primaryName}`);
          if (primaryName.toLowerCase() === PARENT_DOMAIN.toLowerCase()) {
            console.log(`   ✅ Matches expected parent domain!`);
          } else {
            console.log(`   ⚠️  Does not match expected (${PARENT_DOMAIN})`);
          }
        } else {
          console.log(`   ⚠️  Reverse node exists but name is empty`);
        }
      } catch (error) {
        console.log(`   ⚠️  Could not query name from resolver: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Failed to query reverse record: ${error instanceof Error ? error.message : String(error)}`);
  }
  console.log();
  
  // Summary
  console.log(`\n================================================`);
  console.log(`📊 SUMMARY`);
  console.log(`================================================\n`);
  
  const setCount = Object.values(results).filter(r => r.value !== null).length;
  const totalCount = EXPECTED_RECORDS.length;
  
  console.log(`Records set: ${setCount}/${totalCount}`);
  console.log(`Success rate: ${Math.round((setCount / totalCount) * 100)}%\n`);
  
  if (setCount === totalCount) {
    console.log(`✅ All records verified successfully!\n`);
  } else {
    console.log(`⚠️  Some records are missing:\n`);
    for (const [key, result] of Object.entries(results)) {
      if (result.value === null) {
        console.log(`   ❌ ${key}`);
      }
    }
    console.log();
  }
  
  // Reverse record summary
  if (primaryName && primaryName !== '') {
    const expectedDomain = PARENT_DOMAIN.toLowerCase();
    const actualDomain = primaryName.toLowerCase();
    if (actualDomain === expectedDomain) {
      console.log(`✅ Reverse record verified:`);
      console.log(`   ${SAFE_ADDRESS} → ${primaryName}\n`);
    } else {
      console.log(`⚠️  Reverse record set but to different name:`);
      console.log(`   Expected: ${PARENT_DOMAIN}`);
      console.log(`   Actual: ${primaryName}\n`);
    }
  } else {
    console.log(`⚠️  Reverse record not set for Safe address`);
    console.log(`   Expected: ${SAFE_ADDRESS} → ${PARENT_DOMAIN}\n`);
  }
}

const ensName = process.argv[2];
if (!ensName) {
  console.error(`\n❌ Usage: npx tsx lib/services/verify-basename-records.ts <basename>`);
  console.error(`   Example: npx tsx lib/services/verify-basename-records.ts eros006.scenius.basetest.eth\n`);
  process.exit(1);
}

verifyBasenameRecords(ensName).catch(console.error);

