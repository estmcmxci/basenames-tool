/**
 * Verification library for ENSIP-5 standard records
 * Based on the working logic from verify-basename-records.ts
 */

import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { normalize, namehash } from 'viem/ens'
import { keccak256, encodePacked, toBytes } from 'viem'
import { STANDARD_ENS_KEYS } from './validate-records'

// Base Sepolia contract addresses (hardcoded)
const REGISTRY = '0x1493b2567056c2181630115660963E13A8E32735' as `0x${string}`
const RESOLVER = '0x85C87e548091f204C2d0350b39ce1874f02197c6' as `0x${string}`
const REVERSE_REGISTRAR = '0x876eF94ce0773052a2f81921E70FF25a5e76841f' as `0x${string}`

const getRegistry = (): `0x${string}` => REGISTRY
const getResolver = (): `0x${string}` => RESOLVER
const getReverseRegistrar = (): `0x${string}` => REVERSE_REGISTRAR

// Use Base official public RPC endpoint for Base Sepolia
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const getRpcUrl = (): string => {
  return process.env.NEXT_PUBLIC_BASE_RPC_URL || BASE_SEPOLIA_RPC
}

const PARENT_DOMAIN = 'basetest.eth'
const PARENT_NODE = namehash(PARENT_DOMAIN) as `0x${string}`

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
] as const

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
] as const

/**
 * Calculate subname node hash (same as Basenames uses)
 * This is the Basenames-specific algorithm for calculating subname nodes
 */
function calculateSubnameNode(label: string, rootNode: `0x${string}`): `0x${string}` {
  const labelHash = keccak256(toBytes(label))
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rootNode, labelHash]))
}

/**
 * Extract label from full basename
 * e.g., "mysubname.basetest.eth" -> "mysubname"
 */
function extractLabel(fullName: string): string {
  const parts = fullName.split('.')
  if (parts.length === 0) return fullName
  return parts[0]
}

export type RecordStatus = 'set' | 'empty' | 'error'

export interface RecordResult {
  status: RecordStatus
  value: string | null
  error?: string
}

export interface VerificationResult {
  basename: string
  normalizedName: string
  node: `0x${string}`
  owner: Address | null
  resolver: Address | null
  records: Record<string, RecordResult>
  addressRecord: Address | null
  summary: {
    set: number
    empty: number
    error: number
    total: number
    percentage: number
  }
}

/**
 * Verifies all standard ENSIP-5 records for a basename
 * Uses the same proven logic from verify-basename-records.ts
 * 
 * @param basename - Full basename (e.g., "mysubname.basetest.eth") or label (e.g., "mysubname")
 * @returns Verification result with status for all 17 standard records
 */
export async function verifyBasenameRecords(basename: string): Promise<VerificationResult> {
  const rpcUrl = getRpcUrl()
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, {
      fetchOptions: {
        mode: 'cors',
        credentials: 'omit',
      },
    }),
  })

  // Normalize the Basename (required for proper node calculation)
  const normalizedName = normalize(basename)
  
  // Extract label and calculate node using Basenames algorithm
  const label = extractLabel(normalizedName)
  const node = calculateSubnameNode(label, PARENT_NODE)

  // Step 1: Check if subname exists in Registry
  let owner: Address | null = null
  let resolverAddress: Address | null = null

  try {
    owner = await publicClient.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'owner',
      args: [node],
    }) as Address

    if (owner === '0x0000000000000000000000000000000000000000') {
      // Name doesn't exist - return empty result
      return createEmptyResult(normalizedName, node)
    }

    // Step 2: Get resolver address
    resolverAddress = await publicClient.readContract({
      address: REGISTRY,
      abi: REGISTRY_ABI,
      functionName: 'resolver',
      args: [node],
    }) as Address

    if (resolverAddress === '0x0000000000000000000000000000000000000000') {
      // No resolver set - return result with owner but no records
      return createResultWithOwner(normalizedName, node, owner, null)
    }
  } catch (error) {
    // Registry query failed
    return createEmptyResult(normalizedName, node)
  }

  // Step 3: Query address record (addr)
  let addressRecord: Address | null = null
  try {
    const addr = await publicClient.readContract({
      address: resolverAddress,
      abi: RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    }) as Address

    if (addr && addr !== '0x0000000000000000000000000000000000000000') {
      addressRecord = addr
    }
  } catch (error) {
    // Address record not set or error querying
  }

  // Step 4: Query all standard text records
  const records: Record<string, RecordResult> = {}
  
  // Filter out 'addr' from text records (we handle it separately)
  const textRecordKeys = STANDARD_ENS_KEYS.filter(key => key !== 'addr')

  for (const key of textRecordKeys) {
    try {
      const value = await publicClient.readContract({
        address: resolverAddress,
        abi: RESOLVER_ABI,
        functionName: 'text',
        args: [node, key],
      }) as string

      const hasValue = value && value !== ''
      records[key] = {
        status: hasValue ? 'set' : 'empty',
        value: hasValue ? value : null,
      }
    } catch (error) {
      records[key] = {
        status: 'error',
        value: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Add address record to results
  if (addressRecord) {
    records['addr'] = {
      status: 'set',
      value: addressRecord,
    }
  } else {
    records['addr'] = {
      status: 'empty',
      value: null,
    }
  }

  // Calculate summary
  const setCount = Object.values(records).filter(r => r.status === 'set').length
  const emptyCount = Object.values(records).filter(r => r.status === 'empty').length
  const errorCount = Object.values(records).filter(r => r.status === 'error').length
  const totalCount = Object.keys(records).length

  return {
    basename: basename,
    normalizedName,
    node,
    owner,
    resolver: resolverAddress,
    records,
    addressRecord,
    summary: {
      set: setCount,
      empty: emptyCount,
      error: errorCount,
      total: totalCount,
      percentage: totalCount > 0 ? Math.round((setCount / totalCount) * 100) : 0,
    },
  }
}

/**
 * Creates an empty result when name doesn't exist
 */
function createEmptyResult(
  normalizedName: string,
  node: `0x${string}`
): VerificationResult {
  const records: Record<string, RecordResult> = {}
  
  // Initialize all records as empty
  for (const key of STANDARD_ENS_KEYS) {
    records[key] = {
      status: 'empty',
      value: null,
    }
  }

  return {
    basename: normalizedName,
    normalizedName,
    node,
    owner: null,
    resolver: null,
    records,
    addressRecord: null,
    summary: {
      set: 0,
      empty: STANDARD_ENS_KEYS.length,
      error: 0,
      total: STANDARD_ENS_KEYS.length,
      percentage: 0,
    },
  }
}

/**
 * Creates a result when name exists but no resolver is set
 */
function createResultWithOwner(
  normalizedName: string,
  node: `0x${string}`,
  owner: Address,
  resolver: Address | null
): VerificationResult {
  const records: Record<string, RecordResult> = {}
  
  // Initialize all records as empty
  for (const key of STANDARD_ENS_KEYS) {
    records[key] = {
      status: 'empty',
      value: null,
    }
  }

  return {
    basename: normalizedName,
    normalizedName,
    node,
    owner,
    resolver,
    records,
    addressRecord: null,
    summary: {
      set: 0,
      empty: STANDARD_ENS_KEYS.length,
      error: 0,
      total: STANDARD_ENS_KEYS.length,
      percentage: 0,
    },
  }
}

