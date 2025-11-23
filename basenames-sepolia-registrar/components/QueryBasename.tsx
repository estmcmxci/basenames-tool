'use client'

import { useState } from 'react'
import { queryBasename } from '@/lib/query-basenames'

export function QueryBasename() {
  const [basename, setBasename] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleQuery = async () => {
    if (!basename) {
      setError('Please enter a basename')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await queryBasename(basename)
      setResult(data)
    } catch (err: any) {
      let errorMessage = err.message || 'Query failed'
      // Provide more helpful error messages
      if (errorMessage.includes('NEXT_PUBLIC_BASE_RPC_URL') || errorMessage.includes('BASE_RPC_URL')) {
        errorMessage = 'RPC URL not configured. Please set BASE_RPC_URL in parent .env.local file.'
      } else if (errorMessage.includes('BASENAMES_')) {
        errorMessage = 'Contract address not configured. Please set the required BASENAMES_* variables in parent .env.local file.'
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('HTTP request failed')) {
        errorMessage = 'Failed to connect to RPC endpoint. Please check your BASE_RPC_URL configuration.'
      }
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Query Basename</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Basename (full name, e.g., "mysubname.basetest.eth")
          </label>
          <input
            type="text"
            value={basename}
            onChange={(e) => setBasename(e.target.value)}
            placeholder="mysubname.basetest.eth"
            className="w-full px-4 py-2 border rounded-lg"
            disabled={loading}
            onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
          />
        </div>

        <button
          onClick={handleQuery}
          disabled={loading}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Querying...' : 'Query Basename'}
        </button>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 space-y-4">
            <h3 className="text-xl font-bold">Results</h3>
            
            <div className="bg-gray-100 p-4 rounded-lg space-y-2">
              <div>
                <span className="font-medium">Basename:</span> {result.basename}
              </div>
              <div>
                <span className="font-medium">Owner:</span> {result.owner || 'Not set'}
              </div>
              <div>
                <span className="font-medium">Resolver:</span> {result.resolver || 'Not set'}
              </div>
              <div>
                <span className="font-medium">Address Record (Forward):</span>{' '}
                {result.addressRecord || 'Not set'}
              </div>
              <div>
                <span className="font-medium">Primary Name (Reverse):</span>{' '}
                {result.primaryName || '❌ NOT SET'}
              </div>
              
              {Object.keys(result.records || {}).length > 0 && (
                <div className="mt-4">
                  <span className="font-medium">Text Records:</span>
                  <ul className="list-disc list-inside mt-2">
                    {Object.entries(result.records).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-medium">{key}</span>: {String(value || 'Not set')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

