import { Resend } from 'resend'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from './firebase'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailData {
  to: string
  subject: string
  html: string
}

// Helper function to send magic link email
export const sendMagicLinkEmail = async (email: string) => {
  const actionCodeSettings = {
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth-complete`,
    handleCodeInApp: true,
  }

  try {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings)
    return { success: true }
  } catch (error) {
    console.error('Error sending magic link:', error)
    throw error
  }
}

export const emailService = {
  async sendWelcomeEmail(email: string, displayName?: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Jim's Pick'em!</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #000; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .magic-link { background: #4CAF50; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Jim's Pick'em!</h1>
            </div>
            <div class="content">
              <h2>Hi ${displayName || 'there'}!</h2>
              <p>Welcome to Jim's Pick'em! You're now part of the community.</p>
              <p>Get ready to make your picks and compete with friends!</p>
              <p><strong>Quick Sign In:</strong> Click the button below to sign in and go straight to your dashboard!</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signin" class="button magic-link">Sign In & Start Making Picks</a></p>
              <p><small>Once you click the button, you can use the "Sign in with Magic Link" option for passwordless authentication!</small></p>
            </div>
            <div class="footer">
              <p>Thanks for joining us!</p>
            </div>
          </div>
        </body>
      </html>
    `

    return resend.emails.send({
      from: 'Jim\'s Pick\'em <noreply@jimsclipboard.com>',
      to: email,
      subject: 'Welcome to Jim\'s Pick\'em!',
      html
    })
  },

  async sendWeeklyReminder(email: string, displayName?: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Week - Make Your Picks!</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #000; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Week - Make Your Picks!</h1>
            </div>
            <div class="content">
              <h2>Hi ${displayName || 'there'}!</h2>
              <p>A new week has started in Jim's Pick'em!</p>
              <p>Don't forget to make your picks to stay in the competition.</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signin" class="button">Sign In & Make Your Picks</a></p>
              <p><small>Use the "Sign in with Magic Link" option for quick passwordless access!</small></p>
            </div>
            <div class="footer">
              <p>Good luck this week!</p>
            </div>
          </div>
        </body>
      </html>
    `

    return resend.emails.send({
      from: 'Jim\'s Pick\'em <noreply@jimsclipboard.com>',
      to: email,
      subject: 'New Week - Make Your Picks!',
      html
    })
  }
} 