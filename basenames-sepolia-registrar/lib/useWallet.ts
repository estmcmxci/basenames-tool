'use client'

import { useState, useEffect } from 'react'
import { createPublicClient, createWalletClient, custom, http, Address } from 'viem'
import { baseSepolia } from 'viem/chains'

// Use Base official public RPC endpoint for Base Sepolia
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const getRpcUrl = () => {
  // Allow override via env var, but default to OnFinality
  return process.env.NEXT_PUBLIC_BASE_RPC_URL || BASE_SEPOLIA_RPC
}

// Create public client for reads
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(getRpcUrl(), {
    fetchOptions: {
      mode: 'cors',
      credentials: 'omit',
    },
  }),
})

export function useWallet() {
  const [address, setAddress] = useState<Address | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if already connected
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return
    }

    const checkConnection = async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          setAddress(accounts[0] as Address)
          setIsConnected(true)
        }
      } catch (err) {
        console.error('Error checking connection:', err)
      }
    }

    checkConnection()

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAddress(accounts[0] as Address)
        setIsConnected(true)
      } else {
        setAddress(null)
        setIsConnected(false)
      }
    }

    // Listen for chain changes
    const handleChainChanged = () => {
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged)
      window.ethereum?.removeListener('chainChanged', handleChainChanged)
    }
  }, [])

  const connect = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet found. Please install MetaMask or another wallet extension.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (accounts.length > 0) {
        const account = accounts[0] as Address
        setAddress(account)
        setIsConnected(true)

        // Check if on correct chain
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        const baseSepoliaChainId = `0x${baseSepolia.id.toString(16)}`
        
        if (chainId !== baseSepoliaChainId) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: baseSepoliaChainId }],
            })
          } catch (switchError: any) {
            // Chain doesn't exist, try to add it
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: baseSepoliaChainId,
                    chainName: 'Base Sepolia',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    rpcUrls: [getRpcUrl()],
                    blockExplorerUrls: ['https://sepolia-explorer.base.org'],
                  },
                ],
              })
            } else {
              throw switchError
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet')
      console.error('Error connecting wallet:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setAddress(null)
    setIsConnected(false)
    setError(null)
  }

  const getWalletClient = () => {
    if (typeof window === 'undefined' || !window.ethereum || !isConnected) {
      return null
    }

    return createWalletClient({
      chain: baseSepolia,
      transport: custom(window.ethereum),
    })
  }

  return {
    address,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    publicClient,
    getWalletClient,
  }
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}

