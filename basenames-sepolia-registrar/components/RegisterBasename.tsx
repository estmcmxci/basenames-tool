'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@/lib/useWallet'
import { normalize } from 'viem/ens'
import { namehash, keccak256, encodePacked, toBytes, encodeFunctionData } from 'viem'

const getRegistrarController = (): `0x${string}` => {
  const addr = process.env.NEXT_PUBLIC_BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA as `0x${string}`
  if (!addr) {
    throw new Error('NEXT_PUBLIC_BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA is not set. Please set BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA in parent .env.local')
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
  const [name, setName] = useState('')
  const [addressToSet, setAddressToSet] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState<bigint | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isSettingRecords, setIsSettingRecords] = useState(false)
  const [isWaitingRegister, setIsWaitingRegister] = useState(false)
  const [isWaitingRecords, setIsWaitingRecords] = useState(false)
  const [registerTxHash, setRegisterTxHash] = useState<`0x${string}` | null>(null)
  const [recordsTxHash, setRecordsTxHash] = useState<`0x${string}` | null>(null)
  const [isRegisterSuccess, setIsRegisterSuccess] = useState(false)
  const [isRecordsSuccess, setIsRecordsSuccess] = useState(false)

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

      resolverData.push(
        encodeFunctionData({
          abi: RESOLVER_ABI,
          functionName: 'setAddr',
          args: [subnameNode, addressToSet as `0x${string}`],
        })
      )

      if (description) {
        resolverData.push(
          encodeFunctionData({
            abi: RESOLVER_ABI,
            functionName: 'setText',
            args: [subnameNode, 'description', description],
          })
        )
      }

      // Get account from wallet client
      const accounts = await walletClient.getAddresses()
      if (accounts.length === 0) {
        throw new Error('No accounts found in wallet')
      }
      const account = accounts[0]

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
    } catch (err: any) {
      console.error('Error setting records:', err)
      alert(err.message || 'Failed to set resolver records')
      setIsSettingRecords(false)
      setIsWaitingRecords(false)
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
            onChange={(e) => setAddressToSet(e.target.value)}
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

        {price === null && normalizedName && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            ⚠️ Unable to fetch registration price. You can still attempt registration, but the transaction may fail if insufficient funds are sent.
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
            !addressToSet
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
      </div>
    </div>
  )
}
