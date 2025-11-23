'use client'

import { useState } from 'react'
import { checkBasenameAvailable } from '@/lib/check-basename-available'

export function CheckAvailability() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async () => {
    if (!name) {
      setError('Please enter a name')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const isAvailable = await checkBasenameAvailable(name)
      setResult(isAvailable)
    } catch (err: any) {
      console.error('Check availability error:', err)
      let errorMessage = err.message || 'Check failed'
      // Provide more helpful error messages
      if (errorMessage.includes('NEXT_PUBLIC_BASE_RPC_URL') || errorMessage.includes('BASE_RPC_URL')) {
        errorMessage = 'RPC URL not configured. Please set BASE_RPC_URL in parent .env.local file.'
      } else if (errorMessage.includes('REGISTRAR_CONTROLLER')) {
        errorMessage = 'Registrar controller address not configured. Please set BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA in parent .env.local file.'
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('HTTP request failed') || errorMessage.includes('fetch')) {
        errorMessage = `Failed to connect to RPC endpoint: ${err.message || 'Network error'}. Please check your browser console for details.`
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Check Availability</h2>
      
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
            disabled={loading}
            onKeyPress={(e) => e.key === 'Enter' && handleCheck()}
          />
          <p className="text-sm text-gray-500 mt-1">
            Checking: {name ? `${name}.basetest.eth` : 'name.basetest.eth'}
          </p>
        </div>

        <button
          onClick={handleCheck}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Checking...' : 'Check Availability'}
        </button>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {result !== null && (
          <div
            className={`px-4 py-3 rounded ${
              result
                ? 'bg-green-100 border border-green-400 text-green-700'
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}
          >
            {result ? (
              <div>
                ✅ <strong>{name}.basetest.eth</strong> is available!
              </div>
            ) : (
              <div>
                ❌ <strong>{name}.basetest.eth</strong> is already taken
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

