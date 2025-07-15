'use client'

import { useState } from 'react'
import { Navigation } from '@/components/navigation'

export default function WeekRecapAdminPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])

  const calculateWeekRecap = async (weekOffset: number) => {
    setLoading(true)
    try {
      const response = await fetch('/api/week-recap/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weekOffset }),
      })
      
      const result = await response.json()
      setResults(prev => [...prev, { weekOffset, ...result, timestamp: new Date().toISOString() }])
    } catch (error) {
      console.error('Error calculating week recap:', error)
      setResults(prev => [...prev, { weekOffset, success: false, error: 'Request failed', timestamp: new Date().toISOString() }])
    } finally {
      setLoading(false)
    }
  }

  const calculateAllWeeks = async () => {
    setLoading(true)
    setResults([])
    
    // Calculate recaps for the last 5 weeks
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch('/api/week-recap/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ weekOffset: i }),
        })
        
        const result = await response.json()
        setResults(prev => [...prev, { weekOffset: i, ...result, timestamp: new Date().toISOString() }])
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error calculating week ${i} recap:`, error)
        setResults(prev => [...prev, { weekOffset: i, success: false, error: 'Request failed', timestamp: new Date().toISOString() }])
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-100 font-chakra">
      <Navigation />
      
      <div className="pt-20 px-8">
        <h1 className="text-4xl font-bold mb-8">Week Recap Admin</h1>
        
        <div className="space-y-4 mb-8">
          <div className="flex gap-4">
            <button
              onClick={() => calculateWeekRecap(0)}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Calculate Current Week
            </button>
            
            <button
              onClick={() => calculateWeekRecap(1)}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Calculate Last Week
            </button>
            
            <button
              onClick={calculateAllWeeks}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Calculate All Weeks (0-4)
            </button>
          </div>
          
          {loading && (
            <div className="text-lg font-bold text-blue-600">
              Calculating... Please wait.
            </div>
          )}
        </div>
        
        {results.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Results:</h2>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded border ${
                  result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="font-bold">
                  Week Offset {result.weekOffset}: {result.success ? '✅ Success' : '❌ Failed'}
                </div>
                <div className="text-sm text-gray-600">
                  {result.message || result.error}
                </div>
                {result.weekId && (
                  <div className="text-sm text-gray-600">
                    Week ID: {result.weekId}
                  </div>
                )}
                {result.userCount && (
                  <div className="text-sm text-gray-600">
                    Users: {result.userCount}, Top Score: {result.topScore}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 