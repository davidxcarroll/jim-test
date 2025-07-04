'use client'

import { useState } from 'react'
import { emailService } from '@/lib/email'

export default function EmailTestPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  const testWelcomeEmail = async () => {
    if (!email) {
      setResult('Please enter an email address')
      return
    }

    setLoading(true)
    setResult('')

    try {
      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, displayName }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setResult('✅ Welcome email sent successfully!')
      } else {
        setResult(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setResult(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const testWeeklyReminder = async () => {
    if (!email) {
      setResult('Please enter an email address')
      return
    }

    setLoading(true)
    setResult('')

    try {
      const response = await fetch('/api/email/weekly-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setResult('✅ Weekly reminder email sent successfully!')
      } else {
        setResult(`❌ Error: ${data.error}`)
      }
    } catch (error) {
      setResult(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-chakra p-4">
      <div className="w-full max-w-md mx-auto bg-neutral-100 space-y-6 p-8">
        <h1 className="text-4xl font-jim text-center">Email Test</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-black uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
              placeholder="test@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-black uppercase mb-1">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
              placeholder="Test User"
            />
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={testWelcomeEmail}
            disabled={loading}
            className="w-full bg-black text-white py-3 px-4 font-bold uppercase text-xl focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Test Welcome Email'}
          </button>

          <button
            onClick={testWeeklyReminder}
            disabled={loading}
            className="w-full bg-black text-white py-3 px-4 font-bold uppercase text-xl focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Test Weekly Reminder'}
          </button>
        </div>

        {result && (
          <div className={`p-4 text-center font-bold uppercase ${
            result.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {result}
          </div>
        )}

        <div className="text-xs text-center text-gray-600">
          <p>This page is for testing email functionality.</p>
          <p>Check your email inbox after sending a test.</p>
        </div>
      </div>
    </div>
  )
} 