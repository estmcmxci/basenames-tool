/**
 * Basename Availability Check - Frontend Version
 */

import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { normalize } from 'viem/ens'

// Base Sepolia contract addresses (hardcoded)
const REGISTRAR_CONTROLLER = '0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581' as `0x${string}`

const getRegistrarController = (): `0x${string}` => REGISTRAR_CONTROLLER

// Use Base official public RPC endpoint for Base Sepolia
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const getRpcUrl = (): string => {
  // Allow override via env var, but default to OnFinality
  return process.env.NEXT_PUBLIC_BASE_RPC_URL || BASE_SEPOLIA_RPC
}

const REGISTRAR_CONTROLLER_ABI = [
  {
    name: 'available',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
] as const

export async function checkBasenameAvailable(name: string): Promise<boolean> {
  const rpcUrl = getRpcUrl()
  const REGISTRAR_CONTROLLER = getRegistrarController()
  
  console.log('[checkBasenameAvailable] Using RPC URL:', rpcUrl)
  console.log('[checkBasenameAvailable] Registrar Controller:', REGISTRAR_CONTROLLER)
  
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl, {
      fetchOptions: {
        mode: 'cors',
        credentials: 'omit',
      },
    }),
  })

  const normalizedName = normalize(name)
  console.log('[checkBasenameAvailable] Checking name:', normalizedName)
  
  try {
    const isAvailable = await publicClient.readContract({
      address: REGISTRAR_CONTROLLER,
      abi: REGISTRAR_CONTROLLER_ABI,
      functionName: 'available',
      args: [normalizedName],
    })
    
    console.log('[checkBasenameAvailable] Result:', isAvailable)
    return isAvailable as boolean
  } catch (error: any) {
    console.error('[checkBasenameAvailable] RPC call failed:', error)
    console.error('[checkBasenameAvailable] Error details:', {
      message: error.message,
      cause: error.cause,
      name: error.name,
      stack: error.stack
    })
    throw error
  }
}

