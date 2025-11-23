/**
 * Basename Registration Script
 * 
 * Programmatically checks if a basename is available on Base Sepolia,
 * registers it with expiry, and sets address + resolver records in one transaction.
 * 
 * Based on Basenames RegistrarController pattern (simpler than ENS - no commit-reveal!)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createPublicClient, createWalletClient, http, encodeFunctionData, http as httpTransport, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { namehash, keccak256, encodePacked, toBytes } from 'viem';
import { normalize } from 'viem/ens';

// ==============================================================================
// CONFIGURATION
// ==============================================================================

// Contract addresses (Base Sepolia)
// Note: Using Legacy GA Controller - it works for registration without resolver data
// We can set resolver records separately after registration
const REGISTRAR_CONTROLLER = process.env.BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA as `0x${string}`;
const RESOLVER = process.env.BASENAMES_RESOLVER_BASE_SEPOLIA as `0x${string}`;
const BASE_REGISTRAR = process.env.BASENAMES_BASE_REGISTRAR_BASE_SEPOLIA as `0x${string}`;
const REVERSE_REGISTRAR = process.env.BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA as `0x${string}`;

// Minimum registration duration (1 year in seconds)
const MIN_DURATION = 365 * 24 * 60 * 60;

// Parent domain (basetest.eth for Base Sepolia, base.eth for Base Mainnet)
// Note: Base Sepolia uses "basetest.eth" as the parent domain
const PARENT_DOMAIN = 'basetest.eth';
const PARENT_NODE = namehash(PARENT_DOMAIN) as `0x${string}`;

// ==============================================================================
// ABI DEFINITIONS
// ==============================================================================

const REGISTRAR_CONTROLLER_ABI = [
  {
    name: 'available',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'registerPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'request',
        type: 'tuple',
        components: [
          { name: 'name', type: 'string' },
          { name: 'owner', type: 'address' },
          { name: 'duration', type: 'uint256' },
          { name: 'resolver', type: 'address' },
          { name: 'data', type: 'bytes[]' },
          { name: 'reverseRecord', type: 'bool' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

const RESOLVER_ABI = [
  {
    name: 'setAddr',
    type: 'function',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'addr', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'setText',
    type: 'function',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Calculate subname node hash
 * Basenames uses: keccak256(abi.encodePacked(rootNode, keccak256(label)))
 * Where rootNode is the namehash of "basetest.eth" (Base Sepolia) or "base.eth" (Base Mainnet)
 * 
 * This matches RegistrarController._setRecords() which uses:
 * nodehash = keccak256(abi.encodePacked(rootNode, label))
 * where label = keccak256(bytes(name))
 */
function calculateSubnameNode(label: string, rootNode: `0x${string}`): `0x${string}` {
  const labelHash = keccak256(toBytes(label));
  // Match Basenames pattern: keccak256(abi.encodePacked(rootNode, label))
  // where rootNode is namehash of "basetest.eth" for Base Sepolia
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rootNode, labelHash]));
}

/**
 * Build batched resolver data for setting records
 */
function buildResolverData(
  subnameNode: `0x${string}`,
  addressToSet: Address,
  textRecords?: Record<string, string>
): `0x${string}`[] {
  const data: `0x${string}`[] = [];

  // Add setAddr call
  data.push(
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'setAddr',
      args: [subnameNode, addressToSet],
    })
  );

  // Add setText calls for each text record
  if (textRecords) {
    for (const [key, value] of Object.entries(textRecords)) {
      data.push(
        encodeFunctionData({
          abi: RESOLVER_ABI,
          functionName: 'setText',
          args: [subnameNode, key, value],
        })
      );
    }
  }

  return data;
}

// ==============================================================================
// MAIN REGISTRATION FUNCTION
// ==============================================================================

/**
 * Check if basename is available
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

/**
 * Get registration price for a basename
 */
export async function getBasenamePrice(
  name: string,
  duration: number = MIN_DURATION
): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_RPC_URL!),
  });

  const normalizedName = normalize(name);
  
  const price = await publicClient.readContract({
    address: REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'registerPrice',
    args: [normalizedName, BigInt(duration)],
  });

  return price as bigint;
}

/**
 * Register basename with address and resolver records in one transaction
 * 
 * @param name - Label only (e.g., "SOMA001", not "SOMA001.basetest.eth")
 * @param owner - Address that will own the basename
 * @param addressToSet - Address to set in resolver (addr record)
 * @param duration - Registration duration in seconds (min 1 year)
 * @param textRecords - Optional text records to set (key-value pairs)
 * @param reverseRecord - Whether to set reverse record (optional)
 */
export async function registerBasenameWithRecords(
  name: string,
  owner: Address,
  addressToSet: Address,
  duration: number = MIN_DURATION,
  textRecords?: Record<string, string>,
  reverseRecord: boolean = false
): Promise<{
  txHash: `0x${string}`;
  subnameNode: `0x${string}`;
  fullName: string;
  price: bigint;
}> {
  const rpcUrl = process.env.BASE_RPC_URL!;
  const privateKey = process.env.CURATOR_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('CURATOR_PRIVATE_KEY not set in .env.local');
  }

  // Create clients
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Normalize name (ENSIP-15)
  const normalizedName = normalize(name);
  const fullName = `${normalizedName}.${PARENT_DOMAIN}`;

  console.log(`\n📝 Registering Basename: ${fullName}`);
  console.log(`   Label: ${normalizedName}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Duration: ${duration} seconds (${duration / (365 * 24 * 60 * 60)} years)`);

  // Step 1: Check availability
  console.log(`\n🔍 Step 1: Checking availability...`);
  const isAvailable = await checkBasenameAvailable(normalizedName);
  
  if (!isAvailable) {
    throw new Error(`Basename "${normalizedName}" is not available`);
  }
  console.log(`   ✅ Name is available`);

  // Step 2: Calculate subname node
  // Base Sepolia uses namehash of "basetest.eth" as rootNode
  // This is the same rootNode used by all controllers on Base Sepolia
  console.log(`\n📊 Step 2: Calculating subname node...`);
  const rootNode = PARENT_NODE; // namehash("basetest.eth") for Base Sepolia
  console.log(`   RootNode (basetest.eth): ${rootNode}`);
  
  const subnameNode = calculateSubnameNode(normalizedName, rootNode);
  console.log(`   Calculated subname node: ${subnameNode}`);

  // Step 3: Build batched resolver data
  // Note: Legacy GA Controller doesn't work with resolver data in the same transaction
  // We'll register first, then set resolver records separately
  console.log(`\n📦 Step 3: Building registration request...`);
  console.log(`   ⚠️  Note: Resolver records will be set separately after registration`);
  const resolverData: `0x${string}`[] = []; // Empty for now - set records separately

  // Step 4: Get registration price
  console.log(`\n💰 Step 4: Getting registration price...`);
  const price = await getBasenamePrice(normalizedName, duration);
  console.log(`   Price: ${price.toString()} wei (${(Number(price) / 1e18).toFixed(6)} ETH)`);

  // Step 5: Build RegisterRequest
  const request = {
    name: normalizedName,
    owner: owner,
    duration: BigInt(duration),
    resolver: RESOLVER,
    data: resolverData,
    reverseRecord: reverseRecord,
  };

  console.log(`\n🚀 Step 5: Registering basename with all records...`);
  console.log(`   Contract: ${REGISTRAR_CONTROLLER}`);
  console.log(`   Resolver: ${RESOLVER}`);

  // Step 6: Simulate transaction
  try {
    console.log(`   📋 Simulating transaction...`);
    await publicClient.simulateContract({
      account,
      address: REGISTRAR_CONTROLLER,
      abi: REGISTRAR_CONTROLLER_ABI,
      functionName: 'register',
      args: [request],
      value: price,
    });
    console.log(`   ✅ Simulation passed`);
  } catch (simError) {
    console.error(`   ❌ Simulation failed:`, simError);
    throw simError;
  }

  // Step 7: Execute transaction
  console.log(`   🚀 Sending transaction...`);
  const txHash = await walletClient.writeContract({
    address: REGISTRAR_CONTROLLER,
    abi: REGISTRAR_CONTROLLER_ABI,
    functionName: 'register',
    args: [request],
    value: price,
  });

  console.log(`   ✅ Transaction sent: ${txHash}`);
  console.log(`   📊 Explorer: https://sepolia.basescan.org/tx/${txHash}`);

  // Step 8: Wait for confirmation
  console.log(`\n⏳ Step 6: Waiting for confirmation...`);
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash: txHash,
    confirmations: 2 
  });

  if (receipt.status === 'success') {
    console.log(`   ✅ Confirmed (block ${receipt.blockNumber})`);
    console.log(`   📊 Gas used: ${receipt.gasUsed.toString()}`);
  } else {
    throw new Error(`Transaction reverted (block ${receipt.blockNumber})`);
  }

  console.log(`\n✅ Basename registration complete!`);
  console.log(`   Full name: ${fullName}`);
  console.log(`   Node: ${subnameNode}`);
  console.log(`   Owner: ${owner}`);
  console.log(`   Resolver: ${RESOLVER}`);
  console.log(`   Expiry: ${new Date(Date.now() + duration * 1000).toISOString()}`);

  // Step 7: Set resolver records (address and text) in a separate transaction
  if (addressToSet || textRecords) {
    console.log(`\n📝 Step 7: Setting resolver records...`);
    try {
      const resolverTxHash = await setResolverRecords(
        subnameNode,
        addressToSet,
        textRecords
      );
      console.log(`   ✅ Resolver records set: ${resolverTxHash}`);
      console.log(`   📊 Explorer: https://sepolia.basescan.org/tx/${resolverTxHash}`);
    } catch (resolverError) {
      console.error(`   ⚠️  Failed to set resolver records:`, resolverError);
      console.error(`   You can set them manually later using the setResolverRecords function`);
    }
  }

  // Step 8: Set reverse record (address → name) if requested
  // Note: Reverse record is set for the addressToSet (Safe), not the owner
  // This allows querying the Safe address to get the basename
  // The Safe should be named after the basename for on-chain operations
  if (reverseRecord && addressToSet) {
    console.log(`\n🔄 Step 8: Setting reverse record...`);
    console.log(`   Setting reverse record for Safe address: ${addressToSet}`);
    console.log(`   This will allow querying the Safe to get: ${fullName}`);
    try {
      const reverseTxHash = await setReverseRecord(
        fullName,
        addressToSet // Set reverse record for the Safe address, not the curator
      );
      console.log(`   ✅ Reverse record set: ${reverseTxHash}`);
      console.log(`   📊 Explorer: https://sepolia.basescan.org/tx/${reverseTxHash}`);
      console.log(`   ℹ️  Querying ${addressToSet} will now return: ${fullName}`);
      console.log(`   ℹ️  The Safe is now named after the basename for on-chain operations`);
    } catch (reverseError) {
      console.error(`   ⚠️  Failed to set reverse record:`, reverseError);
      console.error(`   Note: Reverse records require authorization for the Safe address`);
      console.error(`   The Safe must call this function, or a Safe owner must be authorized`);
      console.error(`   You can set it manually later from the Safe using the setReverseRecord function`);
    }
  }

  return {
    txHash,
    subnameNode,
    fullName,
    price,
  };
}

/**
 * Set resolver records (address and text) for a registered basename
 * 
 * @param subnameNode - The nodehash of the basename (e.g., namehash("scenius.basetest.eth"))
 * @param addressToSet - Address to set in resolver (addr record)
 * @param textRecords - Optional text records to set (key-value pairs)
 */
export async function setResolverRecords(
  subnameNode: `0x${string}`,
  addressToSet: Address,
  textRecords?: Record<string, string>
): Promise<`0x${string}`> {
  const rpcUrl = process.env.BASE_RPC_URL!;
  const privateKey = process.env.CURATOR_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('CURATOR_PRIVATE_KEY not set in .env.local');
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  console.log(`\n📝 Setting resolver records for node: ${subnameNode}`);
  console.log(`   Address: ${addressToSet}`);
  if (textRecords) {
    console.log(`   Text records: ${Object.keys(textRecords).length}`);
  }

  // Build resolver data
  const resolverData = buildResolverData(subnameNode, addressToSet, textRecords);

  // Use multicall to set all records in one transaction
  // Note: The owner of the basename can set records directly on the resolver
  const txHash = await walletClient.writeContract({
    address: RESOLVER,
    abi: [
      {
        name: 'multicall',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'data', type: 'bytes[]' }],
        outputs: [{ name: 'results', type: 'bytes[]' }],
      },
    ],
    functionName: 'multicall',
    args: [resolverData],
  });

  console.log(`   ✅ Transaction sent: ${txHash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  if (receipt.status === 'success') {
    console.log(`   ✅ Confirmed (block ${receipt.blockNumber})`);
  } else {
    throw new Error(`Transaction reverted (block ${receipt.blockNumber})`);
  }

  return txHash;
}

/**
 * Set reverse record (address → name) for a basename
 * 
 * @param fullName - The full basename (e.g., "scenius.basetest.eth")
 * @param addressToSet - The address that should resolve to this name
 * 
 * @note This sets the primary reverse record for the address.
 *       Only one name can be the primary reverse record per address at a time.
 *       Setting a new reverse record overwrites the previous one.
 */
export async function setReverseRecord(
  fullName: string,
  addressToSet: Address
): Promise<`0x${string}`> {
  const rpcUrl = process.env.BASE_RPC_URL!;
  const privateKey = process.env.CURATOR_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('CURATOR_PRIVATE_KEY not set in .env.local');
  }

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  console.log(`\n🔄 Setting reverse record...`);
  console.log(`   Address: ${addressToSet}`);
  console.log(`   Name: ${fullName}`);
  console.log(`   Note: This will set ${fullName} as the primary name for ${addressToSet}`);

  // ReverseRegistrar.setNameForAddr(address, owner, resolver, name)
  // Note: The caller must be authorized for the address (owner or approved)
  const txHash = await walletClient.writeContract({
    address: REVERSE_REGISTRAR,
    abi: [
      {
        name: 'setNameForAddr',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'addr', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'resolver', type: 'address' },
          { name: 'name', type: 'string' },
        ],
        outputs: [{ name: '', type: 'bytes32' }],
      },
    ],
    functionName: 'setNameForAddr',
    args: [addressToSet, account.address, RESOLVER, fullName],
  });

  console.log(`   ✅ Transaction sent: ${txHash}`);

  // Wait for confirmation
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  if (receipt.status === 'success') {
    console.log(`   ✅ Confirmed (block ${receipt.blockNumber})`);
  } else {
    throw new Error(`Transaction reverted (block ${receipt.blockNumber})`);
  }

  return txHash;
}

// ==============================================================================
// CLI ENTRY POINT
// ==============================================================================

/**
 * Example usage:
 * 
 * npx tsx lib/services/register-basename.ts SOMA001 0x1234... 0x5678...
 */
async function main() {
  const name = process.argv[2];
  const owner = process.argv[3] as Address;
  const addressToSet = process.argv[4] as Address;
  const duration = process.argv[5] ? parseInt(process.argv[5]) : MIN_DURATION;

  if (!name || !owner || !addressToSet) {
    console.error('\n❌ Usage: npx tsx lib/services/register-basename.ts <name> <owner> <addressToSet> [duration]');
    console.error('   Example: npx tsx lib/services/register-basename.ts SOMA001 0x1234... 0x5678... 31536000\n');
    process.exit(1);
  }

  try {
    // Optional: Add text records
    const textRecords: Record<string, string> = {
      'description': 'Catalogue release',
      // Add more text records as needed
    };

    const result = await registerBasenameWithRecords(
      name,
      owner,
      addressToSet,
      duration,
      textRecords,
      true // reverseRecord - set to true to enable reverse resolution
    );

    console.log(`\n🎉 Success!`);
    console.log(`   Transaction: ${result.txHash}`);
    console.log(`   Full name: ${result.fullName}`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Registration failed:`, error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

