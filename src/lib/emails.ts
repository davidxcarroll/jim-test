import { Resend } from 'resend'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from './firebase'

console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY);

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailData {
  to: string
  subject: string
  html: string
}

export const emailService = {
  async addToAudience(email: string, displayName?: string) {
    try {
      // Add contact to the "general" audience list
      await resend.contacts.create({
        email,
        first_name: displayName || undefined,
        unsubscribed: false,
        audience_id: 'general' // This should match your audience ID in Resend
      })
      console.log(`Successfully added ${email} to general audience`)
    } catch (error: any) {
      // If contact already exists (409), that's fine - they're already in the audience
      if (error.statusCode === 409) {
        console.log(`Contact ${email} already exists in general audience`)
      } else {
        console.error('Error adding contact to audience:', error)
      }
    }
  },

  async sendWelcomeEmail(email: string, displayName?: string) {
    // Add user to audience list first
    await this.addToAudience(email, displayName)

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Jim's Clipboard!</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #eee; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #000; color: white; padding: 20px; text-align: center; text-transform: uppercase; font-style: italic; }
            .content { padding: 20px; background: #fff; }
            .button { display: inline-block; background: #000; color: white; padding: 12px 24px; font-style: italic; text-transform: uppercase; margin: 10px 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .magic-link { background: #FABD05; color: #000000; border: 1px solid #000000; font-weight: bold; }
            .email-link { color: #000000; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h2>Hey ${displayName || 'there'}!</h2>
              <p>David Carroll here. If you're like me, football season isn't the same without Jim's Clipboard. This app is my attempt to scratch that itch.</p>
              <p>I tried to make it as true to the original as possible. The only remaining thing required for setup is to login and add your first name in settings.</p>
              <p>Every Tuesday starts a fresh week and you can make your picks. Note: When a game starts, picking is locked.</p>
              <p>Other steps you can take in settings: add your prediction for who will win the Super Bowl, and if you want to be reminded to make your picks each week.</p>
              <p>That's pretty much it! If you notice any bugs or have any feedback feel free to <a class="email-link" href="mailto:david@hazeltine.co">email me</a>.</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://jimsclipboard.com'}/signin" class="button magic-link">📋 TO THE CLIPBOARD!</a></p>
              <p>PS: Jim! I built this without you knowing so if I'm ruining your legacy just say the word and I'll pull the plug! ;)</p>
            </div>
            <div class="footer">
              <p style="font-style: italic;">I promise I won't bug you with a bunch of emails!</p>
            </div>
          </div>
        </body>
      </html>
    `

    return resend.emails.send({
      from: 'Jim\'s Clipboard <noreply@jimsclipboard.com>',
      to: email,
      subject: '📋🏈✅ Welcome to Jim\'s Clipboard!',
      html
    })
  },

  async sendWeeklyReminder(email: string, displayName?: string, weekNumber?: number) {
    console.log('sendWeeklyReminder called with:', { email, displayName, weekNumber })
    const weekText = weekNumber ? `Week ${weekNumber} is up!` : 'A new week is up!';
    const subject = weekNumber ? `Week ${weekNumber} 📋🏈✅ Make Your Picks!` : 'New Week 📋🏈✅ Make Your Picks!';
    console.log('Email template variables:', { displayName, weekText, finalHeading: displayName ? `${displayName}! ${weekText}` : `Hiya! ${weekText}` })
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${weekText}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #eee; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #000; color: white; padding: 20px; text-align: center; text-transform: uppercase; font-style: italic; }
            .content { padding: 20px; background: #fff; }
            .button { display: inline-block; background: #000; color: white; padding: 12px 24px; font-style: italic; text-transform: uppercase; margin: 10px 5px; text-decoration: none; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .magic-link { background: #FABD05; color: #000000; border: 1px solid #000000; font-weight: bold; }
            .email-link { color: #000000; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content" style="text-align: center;">
              <h2>${displayName ? `${displayName}! ${weekText}` : `Hiya! ${weekText}`}</h2>
              <p>Reminder, when a game starts, picking is locked, so get there while you can!</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://jimsclipboard.com'}/signin" class="button magic-link">📋 MAKE YOUR PICKS!</a></p>
            </div>
            <div class="footer">
              <p style="font-style: italic;">Good luck :)</p>
            </div>
          </div>
        </body>
      </html>
    `

    return resend.emails.send({
      from: 'Jim\'s Clipboard <noreply@jimsclipboard.com>',
      to: email,
      subject,
      html
    })
  }
} 