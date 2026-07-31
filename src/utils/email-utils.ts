/**
 * Client helpers for email testing. Requires a signed-in Firebase user;
 * sends only to that user's email.
 */

async function getIdToken(): Promise<string> {
  const { auth } = await import('@/lib/firebase')
  const user = auth?.currentUser
  if (!user) {
    throw new Error('Sign in required to send test emails')
  }
  return user.getIdToken()
}

export async function sendTestReminder(email: string, displayName?: string) {
  const idToken = await getIdToken()
  const response = await fetch('/api/email/weekly-reminder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ email, displayName }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to send test reminder')
  }

  return response.json()
}
