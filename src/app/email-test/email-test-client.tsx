'use client'

import { useState } from 'react'
import { sendMagicLinkEmail } from '@/lib/send-magic-link-email'
import { auth } from '@/lib/firebase'

export function EmailTestClient() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [message, setMessage] = useState('')
  const [emailType, setEmailType] = useState<string>('')

  const clearMessages = () => {
    setResult('')
    setMessage('')
    setEmailType('')
  }

  const getAuthHeader = async (): Promise<Record<string, string>> => {
    const user = auth?.currentUser
    if (!user) {
      throw new Error('Sign in first — email tests require a Firebase session')
    }
    const idToken = await user.getIdToken()
    return { Authorization: `Bearer ${idToken}` }
  }

  const testWelcomeEmail = async () => {
    if (!email) {
      setResult('Please enter an email address')
      return
    }

    setLoading(true)
    clearMessages()
    setEmailType('welcome')

    try {
      const authHeaders = await getAuthHeader()
      const response = await fetch('/api/email/welcome', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ email, displayName }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult('✅ Welcome email sent successfully!')
        setMessage(`Email sent to: ${email}\nFrom: noreply@jimsclipboard.com\nSubject: Welcome to Jim's Clipboard!`)
      } else {
        setResult(`❌ Error: ${data.error}`)
        setMessage('Must be signed in as the recipient email (or use CRON_SECRET via curl).')
      }
    } catch (error) {
      setResult(`❌ Network Error: ${error}`)
      setMessage('Unable to connect to the email service.')
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
    clearMessages()
    setEmailType('weekly')

    try {
      const authHeaders = await getAuthHeader()
      const response = await fetch('/api/email/weekly-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ email, displayName }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult('✅ Weekly reminder email sent successfully!')
        setMessage(`Email sent to: ${email}\nFrom: noreply@jimsclipboard.com\nSubject: New Week - Make Your Picks!`)
      } else {
        setResult(`❌ Error: ${data.error}`)
        setMessage('Must be signed in as the recipient email (or use CRON_SECRET via curl).')
      }
    } catch (error) {
      setResult(`❌ Network Error: ${error}`)
      setMessage('Unable to connect to the email service.')
    } finally {
      setLoading(false)
    }
  }

  const handleSendMagicLink = async () => {
    if (!email) {
      setMessage('Please enter an email address')
      return
    }

    setLoading(true)
    clearMessages()
    setEmailType('magic-link')

    try {
      await sendMagicLinkEmail(email)
      setResult('✅ Magic link email sent successfully!')
      setMessage(`Email sent to: ${email}\nFrom: Firebase Auth\nSubject: Sign in to Jim's Clipboard\nCheck your email for the sign-in link!`)
    } catch (error: any) {
      setResult(`❌ Error: ${error.message}`)
      setMessage('Unable to send magic link email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-chakra p-4">
      <div className="w-full max-w-lg mx-auto bg-neutral-100 space-y-6 p-8">
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
            {loading && emailType === 'welcome' ? 'Sending Welcome...' : 'Test Welcome Email'}
          </button>

          <button
            onClick={testWeeklyReminder}
            disabled={loading}
            className="w-full bg-black text-white py-3 px-4 font-bold uppercase text-xl focus:outline-none disabled:opacity-50"
          >
            {loading && emailType === 'weekly' ? 'Sending Weekly...' : 'Test Weekly Reminder'}
          </button>

          <button
            onClick={handleSendMagicLink}
            disabled={loading}
            className="w-full bg-black text-white py-3 px-4 font-bold uppercase text-xl focus:outline-none disabled:opacity-50"
          >
            {loading && emailType === 'magic-link' ? 'Sending Magic Link...' : 'Send Magic Link'}
          </button>
        </div>

        {result && (
          <div className={`p-4 text-center font-bold uppercase ${
            result.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {result}
          </div>
        )}

        {message && (
          <div className={`p-4 rounded text-sm ${
            message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            <pre className="whitespace-pre-wrap font-mono">{message}</pre>
          </div>
        )}

        <div className="text-xs text-center text-gray-600 space-y-2">
          <p>Sign in as the recipient email before testing welcome/weekly sends.</p>
          <p>This page is disabled in production unless ENABLE_EMAIL_TEST=true.</p>
          <p>Emails are sent from: <strong>noreply@jimsclipboard.com</strong></p>
        </div>
      </div>
    </div>
  )
}
