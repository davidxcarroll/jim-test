export async function sendWeeklyReminders() {
  try {
    const response = await fetch('/api/email/weekly-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to send weekly reminders')
    }

    const result = await response.json()
    console.log(`Weekly reminders sent to ${result.sentTo} users`)
    return result
  } catch (error) {
    console.error('Error sending weekly reminders:', error)
    throw error
  }
}

export async function sendTestReminder(email: string) {
  try {
    const response = await fetch('/api/email/weekly-reminder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      throw new Error('Failed to send test reminder')
    }

    return await response.json()
  } catch (error) {
    console.error('Error sending test reminder:', error)
    throw error
  }
} 