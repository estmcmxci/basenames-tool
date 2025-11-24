'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/useWallet'
import { normalize } from 'viem/ens'
import { namehash, keccak256, encodePacked, toBytes, encodeFunctionData } from 'viem'
import { STANDARD_ENS_KEYS, getRecordsByCategory, getRecordLabel, validateRecord, validateRecords } from '@/lib/validate-records'
import type { VerificationResult } from '@/lib/verify-basename-records'
import { verifyBasenameRecords } from '@/lib/verify-basename-records'
import { VerificationSummary } from '@/components/VerificationSummary'

// Base Sepolia contract addresses (hardcoded)
const REGISTRAR_CONTROLLER = '0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581' as `0x${string}`
const RESOLVER = '0x85C87e548091f204C2d0350b39ce1874f02197c6' as `0x${string}`

const getRegistrarController = (): `0x${string}` => REGISTRAR_CONTROLLER
const getResolver = (): `0x${string}` => RESOLVER

const PARENT_DOMAIN = 'basetest.eth'
const PARENT_NODE = namehash(PARENT_DOMAIN) as `0x${string}`

const REGISTRAR_CONTROLLER_ABI = [
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
] as const

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
  {
    name: 'multicall',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ name: 'results', type: 'bytes[]' }],
  },
] as const

function calculateSubnameNode(label: string, rootNode: `0x${string}`): `0x${string}` {
  const labelHash = keccak256(toBytes(label))
  return keccak256(encodePacked(['bytes32', 'bytes32'], [rootNode, labelHash]))
}

export function RegisterBasename() {
  const { address, isConnected, publicClient, getWalletClient } = useWallet()
  
  // Basic fields
  const [name, setName] = useState('')
  const [addressToSet, setAddressToSet] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<bigint | null>(null)
  
  // Registration state
  const [isRegistering, setIsRegistering] = useState(false)
  const [isSettingRecords, setIsSettingRecords] = useState(false)
  const [isWaitingRegister, setIsWaitingRegister] = useState(false)
  const [isWaitingRecords, setIsWaitingRecords] = useState(false)
  const [registerTxHash, setRegisterTxHash] = useState<`0x${string}` | null>(null)
  const [recordsTxHash, setRecordsTxHash] = useState<`0x${string}` | null>(null)
  const [isRegisterSuccess, setIsRegisterSuccess] = useState(false)
  const [isRecordsSuccess, setIsRecordsSuccess] = useState(false)
  
  // Additional records state - all standard ENS keys except 'addr' (handled separately) and 'description' (existing field)
  // addr is handled as addressToSet, description is separate field
  const additionalRecordKeys = STANDARD_ENS_KEYS.filter(key => key !== 'addr' && key !== 'description')
  
  const [additionalRecords, setAdditionalRecords] = useState<Record<string, string>>({})
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  
  // Verification state
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  
  // UI state for expandable categories
  const [showAdditionalRecords, setShowAdditionalRecords] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])

  // Get records organized by category
  const recordsByCategory = getRecordsByCategory()

  // Helper function to toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  // Helper function to update additional records with validation
  const updateAdditionalRecord = (key: string, value: string) => {
    // Update the value
    setAdditionalRecords(prev => ({
      ...prev,
      [key]: value,
    }))
    
    // Validate on change
    const validation = validateRecord(key, value)
    setValidationErrors(prev => {
      const updated = { ...prev }
      if (validation.valid) {
        delete updated[key]
      } else {
        updated[key] = validation.error || 'Invalid value'
      }
      return updated
    })
  }

  // Validate address field
  const validateAddress = (addr: string) => {
    const validation = validateRecord('addr', addr)
    setValidationErrors(prev => {
      const updated = { ...prev }
      if (validation.valid) {
        delete updated['addr']
      } else {
        updated['addr'] = validation.error || 'Invalid Ethereum address'
      }
      return updated
    })
  }

  // Helper function to get all records (including description and addr)
  const getAllRecords = (): Record<string, string> => {
    const all: Record<string, string> = {}
    
    // Add description if provided
    if (description.trim()) {
      all['description'] = description.trim()
    }
    
    // Add all additional records that have values
    Object.entries(additionalRecords).forEach(([key, value]) => {
      if (value.trim()) {
        all[key] = value.trim()
      }
    })
    
    return all
  }

  const normalizedName = name ? normalize(name) : ''
  const fullName = normalizedName ? `${normalizedName}.${PARENT_DOMAIN}` : ''
  const duration = BigInt(365 * 24 * 60 * 60) // 1 year

  // Fetch registration price
  useEffect(() => {
    const fetchPrice = async () => {
      if (!normalizedName || !publicClient) {
        setPrice(null)
        return
      }

      try {
        const REGISTRAR_CONTROLLER = getRegistrarController()
        const result = await publicClient.readContract({
          address: REGISTRAR_CONTROLLER,
          abi: REGISTRAR_CONTROLLER_ABI,
          functionName: 'registerPrice',
          args: [normalizedName, duration],
        })
        setPrice(result as bigint)
      } catch (err) {
        console.error('Error fetching price:', err)
        setPrice(null)
      }
    }

    fetchPrice()
  }, [normalizedName, duration, publicClient])

  const handleRegister = async () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet')
      return
    }

    if (!name || !addressToSet) {
      alert('Please fill in name and address to set')
      return
    }

    const walletClient = getWalletClient()
    if (!walletClient) {
      alert('Wallet not connected')
      return
    }

    setIsRegistering(true)
    setIsWaitingRegister(false)
    setRegisterTxHash(null)
    setIsRegisterSuccess(false)

    try {
      const REGISTRAR_CONTROLLER = getRegistrarController()
      const RESOLVER = getResolver()
      
      const request = {
        name: normalizedName,
        owner: address,
        duration: duration,
        resolver: RESOLVER,
        data: [],
        reverseRecord: false,
      }

      // Get account from wallet client
      const accounts = await walletClient.getAddresses()
      if (accounts.length === 0) {
        throw new Error('No accounts found in wallet')
      }
      const account = accounts[0]

      // Send registration transaction
      const hash = await walletClient.writeContract({
        account,
        address: REGISTRAR_CONTROLLER,
        abi: REGISTRAR_CONTROLLER_ABI,
        functionName: 'register',
        args: [request],
        value: price || BigInt(0),
      })

      setRegisterTxHash(hash)
      setIsRegistering(false)
      setIsWaitingRegister(true)

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash })
      
      setIsWaitingRegister(false)
      setIsRegisterSuccess(true)

      // Automatically set resolver records after registration
      if (addressToSet) {
        await handleSetRecords(hash)
      }
    } catch (err: any) {
      console.error('Error registering:', err)
      alert(err.message || 'Failed to register basename')
      setIsRegistering(false)
      setIsWaitingRegister(false)
    }
  }

  const handleSetRecords = async (registrationHash?: `0x${string}`) => {
    if (!isConnected || !address || !normalizedName || !addressToSet) {
      return
    }

    const walletClient = getWalletClient()
    if (!walletClient) {
      alert('Wallet not connected')
      return
    }

    setIsSettingRecords(true)
    setIsWaitingRecords(false)
    setRecordsTxHash(null)
    setIsRecordsSuccess(false)

    try {
      const RESOLVER = getResolver()
      const subnameNode = calculateSubnameNode(normalizedName, PARENT_NODE)
      const resolverData: `0x${string}`[] = []

      // Step 1: Set address record (required)
      resolverData.push(
        encodeFunctionData({
          abi: RESOLVER_ABI,
          functionName: 'setAddr',
          args: [subnameNode, addressToSet as `0x${string}`],
        })
      )

      // Step 2: Get all text records (description + additional records)
      const allTextRecords = getAllRecords()
      
      // Step 3: Add all text records to multicall
      for (const [key, value] of Object.entries(allTextRecords)) {
        if (value && value.trim() !== '') {
          resolverData.push(
            encodeFunctionData({
              abi: RESOLVER_ABI,
              functionName: 'setText',
              args: [subnameNode, key, value],
            })
          )
        }
      }

      // Get account from wallet client
      const accounts = await walletClient.getAddresses()
      if (accounts.length === 0) {
        throw new Error('No accounts found in wallet')
      }
      const account = accounts[0]

      // Only send transaction if there are records to set
      if (resolverData.length === 0) {
        setIsSettingRecords(false)
        setIsRecordsSuccess(true)
        return
      }

      const hash = await walletClient.writeContract({
        account,
        address: RESOLVER,
        abi: RESOLVER_ABI,
        functionName: 'multicall',
        args: [resolverData],
      })

      setRecordsTxHash(hash)
      setIsSettingRecords(false)
      setIsWaitingRecords(true)

      // Wait for transaction confirmation
      await publicClient.waitForTransactionReceipt({ hash })
      
      setIsWaitingRecords(false)
      setIsRecordsSuccess(true)

      // Auto-verify after all records are set
      if (fullName) {
        await runVerification(fullName)
      }
    } catch (err: any) {
      console.error('Error setting records:', err)
      alert(err.message || 'Failed to set resolver records')
      setIsSettingRecords(false)
      setIsWaitingRecords(false)
    }
  }

  // Run verification after all records are set
  const runVerification = async (basenameToVerify: string) => {
    setIsVerifying(true)
    setVerificationResult(null)

    try {
      // Wait a moment for the transaction to be fully indexed
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const result = await verifyBasenameRecords(basenameToVerify)
      setVerificationResult(result)
    } catch (err: any) {
      console.error('Error verifying records:', err)
      // Don't show alert - verification failure is not critical
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Register Basename</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Basename (label only, e.g., "mysubname")
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mysubname"
            className="w-full px-4 py-2 border rounded-lg"
            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
          />
          <p className="text-sm text-gray-500 mt-1">
            Will be registered as: {fullName || 'name.basetest.eth'}
          </p>
          {price && (
            <p className="text-sm text-gray-500 mt-1">
              Price: {(Number(price) / 1e18).toFixed(6)} ETH
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Address to Set (forward resolution)
          </label>
          <input
            type="text"
            value={addressToSet}
            onChange={(e) => {
              setAddressToSet(e.target.value)
              validateAddress(e.target.value)
            }}
            placeholder="0x..."
            className="w-full px-4 py-2 border rounded-lg"
            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
          />
          <p className="text-sm text-gray-500 mt-1">
            The address this basename will resolve to
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Description (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="My basename description"
            className="w-full px-4 py-2 border rounded-lg"
            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
          />
        </div>

        {/* Additional Records Section */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <button
            type="button"
            onClick={() => setShowAdditionalRecords(!showAdditionalRecords)}
            className="flex items-center justify-between w-full text-left font-semibold mb-2"
          >
            <span>Additional Records (optional)</span>
            <span>{showAdditionalRecords ? '▼' : '▶'}</span>
          </button>

          {showAdditionalRecords && (
            <div className="space-y-4 mt-4">
              {/* Profile Category */}
              <div className="border rounded p-3 bg-white">
                <button
                  type="button"
                  onClick={() => toggleCategory('profile')}
                  className="flex items-center justify-between w-full text-left font-medium mb-2"
                >
                  <span>Profile</span>
                  <span>{expandedCategories.includes('profile') ? '▼' : '▶'}</span>
                </button>
                {expandedCategories.includes('profile') && (
                  <div className="space-y-3 mt-3">
                    {recordsByCategory.profile.map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium mb-1">
                          {getRecordLabel(key)}
                          {key === 'avatar' || key === 'url' ? ' (URL)' : ''}
                        </label>
                        {key === 'keywords' ? (
                          <textarea
                            value={additionalRecords[key] || ''}
                            onChange={(e) => updateAdditionalRecord(key, e.target.value)}
                            placeholder={
                              key === 'keywords'
                                ? 'Comma-separated keywords'
                                : getRecordLabel(key)
                            }
                            className="w-full px-4 py-2 border rounded-lg"
                            rows={2}
                            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
                          />
                        ) : (
                          <input
                            type={key === 'email' ? 'email' : key === 'url' || key === 'avatar' ? 'url' : 'text'}
                            value={additionalRecords[key] || ''}
                            onChange={(e) => updateAdditionalRecord(key, e.target.value)}
                            placeholder={getRecordLabel(key)}
                            className="w-full px-4 py-2 border rounded-lg"
                            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Category */}
              <div className="border rounded p-3 bg-white">
                <button
                  type="button"
                  onClick={() => toggleCategory('contact')}
                  className="flex items-center justify-between w-full text-left font-medium mb-2"
                >
                  <span>Contact</span>
                  <span>{expandedCategories.includes('contact') ? '▼' : '▶'}</span>
                </button>
                {expandedCategories.includes('contact') && (
                  <div className="space-y-3 mt-3">
                    {recordsByCategory.contact.map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium mb-1">
                          {getRecordLabel(key)}
                          {key === 'phone' ? ' (E.164 format, e.g., +1234567890)' : ''}
                          {key === 'email' ? ' (email address)' : ''}
                        </label>
                        <input
                          type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                          value={additionalRecords[key] || ''}
                          onChange={(e) => updateAdditionalRecord(key, e.target.value)}
                          placeholder={
                            key === 'phone'
                              ? '+1234567890'
                              : key === 'location'
                              ? 'e.g., Toronto, Canada'
                              : getRecordLabel(key)
                          }
                          className="w-full px-4 py-2 border rounded-lg"
                          disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Social Category */}
              <div className="border rounded p-3 bg-white">
                <button
                  type="button"
                  onClick={() => toggleCategory('social')}
                  className="flex items-center justify-between w-full text-left font-medium mb-2"
                >
                  <span>Social</span>
                  <span>{expandedCategories.includes('social') ? '▼' : '▶'}</span>
                </button>
                {expandedCategories.includes('social') && (
                  <div className="space-y-3 mt-3">
                    {recordsByCategory.social.map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium mb-1">
                          {getRecordLabel(key)}
                          {key === 'com.twitter' || key === 'org.telegram' || key === 'com.github'
                            ? ' (username only, no @)'
                            : ''}
                        </label>
                        <input
                          type="text"
                          value={additionalRecords[key] || ''}
                          onChange={(e) => updateAdditionalRecord(key, e.target.value)}
                          placeholder={
                            key === 'com.twitter' || key === 'org.telegram'
                              ? 'username'
                              : key === 'com.linkedin'
                              ? 'LinkedIn URL or username'
                              : getRecordLabel(key)
                          }
                          className="w-full px-4 py-2 border rounded-lg"
                          disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Other Category */}
              <div className="border rounded p-3 bg-white">
                <button
                  type="button"
                  onClick={() => toggleCategory('other')}
                  className="flex items-center justify-between w-full text-left font-medium mb-2"
                >
                  <span>Other</span>
                  <span>{expandedCategories.includes('other') ? '▼' : '▶'}</span>
                </button>
                {expandedCategories.includes('other') && (
                  <div className="space-y-3 mt-3">
                    {recordsByCategory.other.map((key) => (
                      <div key={key}>
                        <label className="block text-sm font-medium mb-1">
                          {getRecordLabel(key)}
                          {key === 'url' ? ' (URL)' : ''}
                        </label>
                        {key === 'notice' || key === 'mail' ? (
                          <textarea
                            value={additionalRecords[key] || ''}
                            onChange={(e) => updateAdditionalRecord(key, e.target.value)}
                            placeholder={getRecordLabel(key)}
                            className="w-full px-4 py-2 border rounded-lg"
                            rows={2}
                            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
                          />
                        ) : (
                          <input
                            type={key === 'url' ? 'url' : 'text'}
                            value={additionalRecords[key] || ''}
                            onChange={(e) => updateAdditionalRecord(key, e.target.value)}
                            placeholder={getRecordLabel(key)}
                            className="w-full px-4 py-2 border rounded-lg"
                            disabled={isRegistering || isSettingRecords || isWaitingRegister || isWaitingRecords}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {price === null && normalizedName && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            ⚠️ Unable to fetch registration price. You can still attempt registration, but the transaction may fail if insufficient funds are sent.
          </div>
        )}

        {/* Validation Summary */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <div className="font-semibold mb-2">❌ Validation Errors:</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {Object.entries(validationErrors).map(([key, error]) => (
                <li key={key}>
                  <span className="font-medium">{getRecordLabel(key)}:</span> {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={
            isRegistering ||
            isSettingRecords ||
            isWaitingRegister ||
            isWaitingRecords ||
            !isConnected ||
            !name ||
            !addressToSet ||
            Object.keys(validationErrors).length > 0
          }
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isRegistering || isWaitingRegister
            ? 'Registering...'
            : isSettingRecords || isWaitingRecords
            ? 'Setting records...'
            : 'Register Basename'}
        </button>

        {registerTxHash && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
            Registration TX: {registerTxHash}
          </div>
        )}

        {isRegisterSuccess && !isRecordsSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            ✅ Registration complete! Setting resolver records...
          </div>
        )}

        {recordsTxHash && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
            Records TX: {recordsTxHash}
          </div>
        )}

        {isRecordsSuccess && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            ✅ Success! Basename registered and records set.
          </div>
        )}

        {/* Verification Status */}
        {isVerifying && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
            🔍 Verifying records...
          </div>
        )}

        {/* Verification Summary */}
        {verificationResult && !isVerifying && (
          <VerificationSummary result={verificationResult} showAllRecords={true} />
        )}
      </div>
    </div>
  )
}
