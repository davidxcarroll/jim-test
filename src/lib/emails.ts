import { Resend } from 'resend'
import { escapeHtml } from '@/utils/html-escape'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailData {
  to: string
  subject: string
  html: string
}

export const emailService = {
  async addToAudience(email: string, displayName?: string) {
    const audienceId = process.env.RESEND_AUDIENCE_ID
    if (!audienceId) {
      return
    }

    try {
      await resend.contacts.create({
        email,
        first_name: displayName || undefined,
        unsubscribed: false,
        audience_id: audienceId,
      })
    } catch (error: any) {
      // If contact already exists (409), that's fine - they're already in the audience
      if (error.statusCode === 409) {
        return
      }
      console.error('Error adding contact to audience:', error)
    }
  },

  async sendWelcomeEmail(email: string, displayName?: string) {
    await this.addToAudience(email, displayName)

    const safeName = escapeHtml(displayName || 'there')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jimsclipboard.com'

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
              <h2>Hey ${safeName}!</h2>
              <p>David Carroll here. If you're like me, football season isn't the same without Jim's Clipboard. This app is my attempt to scratch that itch.</p>
              <p>Anyway, welcome! You're almost done with setup. Go sign in and add your first name in settings.</p>
              <p>Every Wednesday starts a fresh week. Note: When a game starts, picks (or lack thereof) are locked. So get there while you can!</p>
              <p>Other steps you can take in settings: Add your prediction for who will win the Super Bowl before regular season starts. Opt-in to weekly email reminders.</p>
              <p>That's pretty much it. <a class="email-link" href="mailto:david@hazeltine.co">Email me</a> with bugs or feedback.</p>
              <p><a href="${appUrl}/signin" class="button magic-link">TO THE CLIPBOARD!</a></p>
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

  async sendWeeklyReminder(email: string, displayName?: string, weekLabelOrNumber?: string | number) {
    const weekLabel =
      typeof weekLabelOrNumber === 'number'
        ? `Week ${weekLabelOrNumber}`
        : typeof weekLabelOrNumber === 'string' && weekLabelOrNumber.trim()
          ? weekLabelOrNumber.trim()
          : null
    const weekText = weekLabel ? `${escapeHtml(weekLabel)} is up!` : 'A new week is up!'
    const subject = weekLabel ? `${weekLabel} 📋🏈✅ Make Your Picks!` : 'New Week 📋🏈✅ Make Your Picks!'
    const heading = displayName
      ? `${escapeHtml(displayName)}! ${weekText}`
      : `Hiya! ${weekText}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://jimsclipboard.com'

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
              <h2>${heading}</h2>
              <p>Reminder, when a game starts, picking is locked, so get there while you can!</p>
              <p><a href="${appUrl}/signin" class="button magic-link">START PICKIN!</a></p>
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
  },

  /** Send reminders one-by-one so a single Resend failure doesn't abort the batch. */
  async sendWeeklyRemindersBatch(
    recipients: Array<{ email: string; displayName?: string }>,
    weekLabel: string
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0
    let failed = 0
    for (const recipient of recipients) {
      try {
        await this.sendWeeklyReminder(recipient.email, recipient.displayName, weekLabel)
        sent++
      } catch (error) {
        failed++
        console.error('Failed to send weekly reminder to a recipient:', error)
      }
    }
    return { sent, failed }
  }
}
