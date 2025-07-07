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
  async sendWelcomeEmail(email: string, displayName?: string) {
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
            <div class="header">
              <h1>Welcome (back) to<br/>Jim's Clipboard!</h1>
            </div>
            <div class="content">
              <h2>Hey ${displayName || 'there'}!</h2>
              <p>David Carroll here. If you're like me, football season isn't the same without Jim's Clipboard. This app is my attempt to scratch that itch.</p>
              <p>I tried to make it as true to the original as possible. The only thing you <i>need</i> to do to get going (besides creating an account, which you've already done) is add your first name. Each week, during the regular season, you can make picks. Caution! When a game starts, picking is locked, so get there while you can.</p>
              <p>In settings, add your prediction for who will win the Super Bowl, and if you want to be reminded to make your picks each week. Or maybe save the app to your browser bookmarks for easy access.</p>
              <p>That's pretty much it! If you notice any bugs or have any feedback feel free to <a class="email-link" href="mailto:david@hazeltine.co">email me</a>.</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://jimsclipboard.com'}" class="button magic-link">👉 To the App!</a></p>
              <p>Oh PS: Jim! I built this without you knowing so if I'm ruining your legacy just say the word and I'll pull the plug! ;)</p>
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
    const weekText = weekNumber ? `Week ${weekNumber} is up!` : 'A new week is up';
    const subject = weekNumber ? `Week ${weekNumber} 📋🏈✅ Make Your Picks!` : 'New Week 📋🏈✅ Make Your Picks!';
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
            <div class="header">
              <h1>${weekText}</h1>
            </div>
            <div class="content">
              <h2>Hey ${displayName || 'there'}!</h2>
              <p>A new week us up on Jim's Clipboard!</p>
              <p>Reminder, when a game starts, picking is locked, so get there while you can!</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://jimsclipboard.com'}/signin" class="button magic-link">🏈 Sign In & Make Your Picks</a></p>
              <p><small>Use the "Sign in with Email Link" option for quick passwordless access.</small></p>
            </div>
            <div class="footer">
              <p style="font-style: italic;">Good luck this week :)</p>
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