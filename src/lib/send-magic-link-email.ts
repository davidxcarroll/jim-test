import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from './firebase'

// Helper function to send email link
export const sendMagicLinkEmail = async (email: string) => {
  // Check if Firebase is initialized
  if (!auth) {
    throw new Error('Firebase not initialized')
  }

  const actionCodeSettings = {
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth-complete`,
    handleCodeInApp: true,
  }

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings)
    return { success: true }
  } catch (error) {
    console.error('Error sending email link:', error)
    throw error
  }
} 