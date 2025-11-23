'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/useWallet'
import { ConnectButton } from '@/components/ConnectButton'
import { RegisterBasename } from '@/components/RegisterBasename'
import { QueryBasename } from '@/components/QueryBasename'
import { CheckAvailability } from '@/components/CheckAvailability'

export default function Home() {
  const { isConnected, address } = useWallet()
  const [activeTab, setActiveTab] = useState<'register' | 'query' | 'check'>('register')
  const [mounted, setMounted] = useState(false)

  // Fix hydration error by only rendering wallet-dependent content after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Basenames on Base Sepolia</h1>
            <p className="text-gray-600">
              Register and query basenames (basetest.eth subdomains) on Base Sepolia
            </p>
          </div>
          <div className="flex-shrink-0">
            <ConnectButton />
          </div>
        </div>

        {mounted && !isConnected && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            <p className="font-medium mb-2">Please connect your wallet to register basenames</p>
            <p className="text-sm">
              If you don't see any wallet options, make sure you have a wallet extension installed (like MetaMask).
              You can still query and check availability without a wallet.
            </p>
          </div>
        )}

        {mounted && isConnected && address && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Connected:</span> {address}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b">
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'register'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Register
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'query'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Query
          </button>
          <button
            onClick={() => setActiveTab('check')}
            className={`px-4 py-2 font-medium ${
              activeTab === 'check'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Check Availability
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {activeTab === 'register' && <RegisterBasename />}
          {activeTab === 'query' && <QueryBasename />}
          {activeTab === 'check' && <CheckAvailability />}
        </div>
      </div>
    </main>
  )
}

