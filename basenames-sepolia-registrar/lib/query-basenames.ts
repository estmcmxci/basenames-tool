/**
 * Basenames Query Functions - Frontend Version
 */

import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { normalize, namehash } from 'viem/ens'
import { keccak256, encodePacked, toBytes } from 'viem'

const getRegistry = (): `0x${string}` => {
  const addr = process.env.NEXT_PUBLIC_BASENAMES_REGISTRY_BASE_SEPOLIA as `0x${string}`
  if (!addr) {
    throw new Error('NEXT_PUBLIC_BASENAMES_REGISTRY_BASE_SEPOLIA is not set. Please set BASENAMES_REGISTRY_BASE_SEPOLIA in parent .env.local')
  }
  return addr
}

const getResolver = (): `0x${string}` => {
  const addr = process.env.NEXT_PUBLIC_BASENAMES_RESOLVER_BASE_SEPOLIA as `0x${string}`
  if (!addr) {
    throw new Error('NEXT_PUBLIC_BASENAMES_RESOLVER_BASE_SEPOLIA is not set. Please set BASENAMES_RESOLVER_BASE_SEPOLIA in parent .env.local')
  }
  return addr
}

const getReverseRegistrar = (): `0x${string}` => {
  const addr = process.env.NEXT_PUBLIC_BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA as `0x${string}`
  if (!addr) {
    throw new Error('NEXT_PUBLIC_BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA is not set. Please set BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA in parent .env.local')
  }
  return addr
}

// Use Base official public RPC endpoint for Base Sepolia
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const getRpcUrl = (): string => {
  // Allow override via env var, but default to OnFinality
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
] as const

const REVERSE_REGISTRAR_ABI = [
  {
    name: 'node',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const

function calculateSubnameNode(label: string, rootNode: `0x${string}`): `0x${string}` {
  const labelHash = keccak256(toBytes(label))
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rootNode, labelHash]))
}

function extractLabel(fullName: string): string {
  const parts = fullName.split('.')
  if (parts.length === 0) return fullName
  return parts[0]
}

export async function queryBasename(basename: string) {
  const rpcUrl = getRpcUrl()
  const REGISTRY = getRegistry()
  const RESOLVER = getResolver()
  const REVERSE_REGISTRAR = getReverseRegistrar()
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, {
      fetchOptions: {
        mode: 'cors',
        credentials: 'omit',
      },
    }),
  })

  const normalizedName = normalize(basename)
  const label = extractLabel(normalizedName)
  const node = calculateSubnameNode(label, PARENT_NODE)

  // Get resolver
  const resolver = await publicClient.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'resolver',
    args: [node],
  }) as Address

  if (!resolver || resolver === '0x0000000000000000000000000000000000000000') {
    return {
      basename: normalizedName,
      node,
      resolver: null,
      owner: null,
      addressRecord: null,
      primaryName: null,
      records: {},
    }
  }

  // Get owner
  const owner = await publicClient.readContract({
    address: REGISTRY,
    abi: REGISTRY_ABI,
    functionName: 'owner',
    args: [node],
  }) as Address

  // Get address record
  let addressRecord: Address | null = null
  try {
    addressRecord = await publicClient.readContract({
      address: resolver,
      abi: RESOLVER_ABI,
      functionName: 'addr',
      args: [node],
    }) as Address
    if (addressRecord === '0x0000000000000000000000000000000000000000') {
      addressRecord = null
    }
  } catch (error) {
    // Address record not set
  }

  // Get text records
  const records: Record<string, string | null> = {}
  const textKeys = ['avatar', 'description', 'address']
  for (const key of textKeys) {
    try {
      const value = await publicClient.readContract({
        address: resolver,
        abi: RESOLVER_ABI,
        functionName: 'text',
        args: [node, key],
      }) as string
      records[key] = value || null
    } catch (error) {
      records[key] = null
    }
  }

  // Get reverse resolution (primary name)
  let primaryName: string | null = null
  if (addressRecord) {
    try {
      const reverseNode = await publicClient.readContract({
        address: REVERSE_REGISTRAR,
        abi: REVERSE_REGISTRAR_ABI,
        functionName: 'node',
        args: [addressRecord],
      }) as `0x${string}`

      if (reverseNode !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        try {
          primaryName = await publicClient.readContract({
            address: RESOLVER,
            abi: RESOLVER_ABI,
            functionName: 'name',
            args: [reverseNode],
          }) as string
        } catch (error) {
          // Primary name not set
        }
      }
    } catch (error) {
      // Reverse resolution not set
    }
  }

  return {
    basename: normalizedName,
    node,
    resolver,
    owner,
    addressRecord,
    primaryName,
    records,
  }
}

