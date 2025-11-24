'use client'

import { useState } from 'react'
import { verifyBasenameRecords } from '@/lib/verify-basename-records'
import type { VerificationResult } from '@/lib/verify-basename-records'
import { VerificationSummary } from '@/components/VerificationSummary'

export function QueryBasename() {
  const [basename, setBasename] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
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
      const data = await verifyBasenameRecords(basename)
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
          <VerificationSummary 
            result={result} 
            showAllRecords={true}
          />
        )}
      </div>
    </div>
  )
}

