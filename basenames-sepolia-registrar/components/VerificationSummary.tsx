'use client'

import { useState } from 'react'
import type { VerificationResult } from '@/lib/verify-basename-records'
import { getRecordLabel, getRecordCategory, getRecordsByCategory } from '@/lib/validate-records'

interface VerificationSummaryProps {
  result: VerificationResult
  showAllRecords?: boolean // Show all 17 records even if empty (default: true)
}

export function VerificationSummary({ result, showAllRecords = true }: VerificationSummaryProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['set', 'available'])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  // Separate records by status
  const setRecords: Array<{ key: string; value: string }> = []
  const availableRecords: Array<{ key: string }> = []
  const errorRecords: Array<{ key: string; error?: string }> = []

  for (const [key, record] of Object.entries(result.records)) {
    if (record.status === 'set' && record.value && record.value.trim() !== '') {
      setRecords.push({ key, value: record.value })
    } else if (record.status === 'empty' && showAllRecords) {
      availableRecords.push({ key })
    } else if (record.status === 'error') {
      errorRecords.push({ key, error: record.error })
    }
  }
  
  // Also check addressRecord directly if it exists (for backward compatibility)
  if (result.addressRecord && !setRecords.find(r => r.key === 'addr')) {
    setRecords.push({ key: 'addr', value: result.addressRecord })
  }

  // Group records by category
  const recordsByCategory = getRecordsByCategory()

  const getRecordsInCategory = (
    category: 'profile' | 'contact' | 'social' | 'other',
    records: Array<{ key: string; value?: string }>
  ) => {
    const categoryKeys = recordsByCategory[category]
    // Include 'addr' in 'other' category for display purposes
    const keysToInclude = category === 'other' ? [...categoryKeys, 'addr'] : categoryKeys
    return records.filter(r => keysToInclude.includes(r.key))
  }

  const formatValue = (key: string, value: string): string => {
    // Truncate long values for display
    if (value.length > 60) {
      return `${value.substring(0, 60)}...`
    }
    return value
  }

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      profile: 'Profile',
      contact: 'Contact',
      social: 'Social',
      other: 'Other',
    }
    return labels[category] || category
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Verification Summary</h3>
          <div className="text-sm text-gray-600">
            {result.summary.set}/{result.summary.total} records set ({result.summary.percentage}%)
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{result.summary.set}</div>
            <div className="text-sm text-gray-600">Set</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded">
            <div className="text-2xl font-bold text-yellow-600">{result.summary.empty}</div>
            <div className="text-sm text-gray-600">Available</div>
          </div>
          {result.summary.error > 0 && (
            <div className="text-center p-3 bg-red-50 rounded">
              <div className="text-2xl font-bold text-red-600">{result.summary.error}</div>
              <div className="text-sm text-gray-600">Errors</div>
            </div>
          )}
        </div>

        {/* ✅ Verified Records Section */}
        {setRecords.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('set')}
              className="flex items-center justify-between w-full text-left font-semibold mb-2"
            >
              <span>
                ✅ Verified Records ({setRecords.length})
              </span>
              <span>{expandedCategories.includes('set') ? '▼' : '▶'}</span>
            </button>
            
            {expandedCategories.includes('set') && (
              <div className="space-y-2 pl-4">
                {/* Show address record separately if set */}
                {(() => {
                  const addrRecord = setRecords.find(r => r.key === 'addr')
                  if (!addrRecord) return null
                  
                  return (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        Address
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">{getRecordLabel('addr')}:</span>{' '}
                          <code className="bg-gray-200 px-1 rounded">
                            {formatValue('addr', addrRecord.value || '')}
                          </code>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                
                {/* Show other records grouped by category */}
                {(['profile', 'contact', 'social', 'other'] as const).map(category => {
                  // Filter out 'addr' from category records since we show it separately
                  const categoryRecords = getRecordsInCategory(category, setRecords.filter(r => r.key !== 'addr'))
                  if (categoryRecords.length === 0) return null

                  return (
                    <div key={category} className="mb-3">
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        {getCategoryLabel(category)}
                      </div>
                      <div className="space-y-1">
                        {categoryRecords.map(({ key, value }) => (
                          <div key={key} className="text-sm">
                            <span className="font-medium">{getRecordLabel(key)}:</span>{' '}
                            <span className="text-gray-700">
                              {formatValue(key, value || '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ⚠️ Available to Set Section */}
        {availableRecords.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('available')}
              className="flex items-center justify-between w-full text-left font-semibold mb-2"
            >
              <span>
                ⚠️ Available to Set ({availableRecords.length})
              </span>
              <span>{expandedCategories.includes('available') ? '▼' : '▶'}</span>
            </button>
            
            {expandedCategories.includes('available') && (
              <div className="space-y-2 pl-4">
                {(['profile', 'contact', 'social', 'other'] as const).map(category => {
                  const categoryRecords = getRecordsInCategory(category, availableRecords)
                  if (categoryRecords.length === 0) return null

                  return (
                    <div key={category} className="mb-3">
                      <div className="text-sm font-medium text-gray-600 mb-1">
                        {getCategoryLabel(category)}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categoryRecords.map(({ key }) => (
                          <span
                            key={key}
                            className="text-sm bg-gray-200 text-gray-700 px-2 py-1 rounded"
                          >
                            {getRecordLabel(key)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ❌ Error Records Section */}
        {errorRecords.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => toggleCategory('error')}
              className="flex items-center justify-between w-full text-left font-semibold mb-2 text-red-600"
            >
              <span>
                ❌ Errors ({errorRecords.length})
              </span>
              <span>{expandedCategories.includes('error') ? '▼' : '▶'}</span>
            </button>
            
            {expandedCategories.includes('error') && (
              <div className="space-y-1 pl-4">
                {errorRecords.map(({ key, error }) => (
                  <div key={key} className="text-sm text-red-600">
                    <span className="font-medium">{getRecordLabel(key)}:</span>{' '}
                    {error || 'Unknown error'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Additional Info */}
        {result.owner && (
          <div className="mt-4 pt-4 border-t text-sm text-gray-600">
            <div>
              <span className="font-medium">Owner:</span>{' '}
              <code className="bg-gray-200 px-1 rounded">{result.owner}</code>
            </div>
            {result.resolver && (
              <div className="mt-1">
                <span className="font-medium">Resolver:</span>{' '}
                <code className="bg-gray-200 px-1 rounded">{result.resolver}</code>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

