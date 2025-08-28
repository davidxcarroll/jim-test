# Resend Audience Management Guide

## Overview

This guide explains how to automatically add new users to your Resend "general" audience list when they sign up for Jim's Clipboard.

## What's Been Implemented

### Automatic Audience Addition
- **New users** are automatically added to the "general" audience list when they sign up
- Works for both email/password signup and magic link signup
- Includes user's display name if available
- Handles duplicate contacts gracefully

### API Endpoints Created
1. **`/api/email/add-to-audience`** - Add a single user to the audience
2. **`/api/email/add-all-users-to-audience`** - Backfill all existing users
3. **Updated `/api/email/welcome`** - Now automatically adds users to audience

### Admin Interface
- **`/admin/audience-management`** - Web interface to manage audience
- Add individual users manually
- Backfill all existing users
- Test audience functionality

## Setup Instructions

### 1. Create Audience in Resend Dashboard

1. Go to [Resend Dashboard](https://resend.com)
2. Navigate to **Audiences** section
3. Click **Create Audience**
4. Name it exactly: `general`
5. Note the Audience ID (should be `general`)

### 2. Verify Your Resend API Key

Ensure your `.env.local` file has:
```bash
RESEND_API_KEY=your_resend_api_key_here
```

### 3. Test the Feature

1. Visit `/admin/audience-management` in your app
2. Try adding a test email address
3. Check your Resend dashboard to confirm the contact was added

## How It Works

### For New Users
When a new user signs up (either method):

1. User completes signup process
2. Welcome email is sent via `/api/email/welcome`
3. `sendWelcomeEmail()` automatically calls `addToAudience()`
4. User is added to "general" audience in Resend
5. User receives welcome email

### For Existing Users
To add existing users who signed up before this feature:

1. Visit `/admin/audience-management`
2. Click "Add All Users to Audience"
3. This will process all users in your Firestore database
4. Results will show success/failure counts

## Code Changes Made

### 1. Updated `src/lib/emails.ts`
- Added `addToAudience()` function
- Modified `sendWelcomeEmail()` to automatically add users
- Handles duplicate contacts and errors gracefully

### 2. New API Endpoints
- `src/app/api/email/add-to-audience/route.ts`
- `src/app/api/email/add-all-users-to-audience/route.ts`

### 3. Admin Interface
- `src/app/admin/audience-management/page.tsx`

## Error Handling

The system handles several scenarios:

- **Duplicate contacts**: Updates existing contact instead of failing
- **Network errors**: Logs errors but doesn't break signup flow
- **Missing audience**: Logs error for debugging
- **Invalid emails**: Validates before sending to Resend

## Benefits

✅ **Automatic Management**: No manual work required for new users
✅ **Audience Building**: Grow your email list automatically
✅ **Compliance**: Users can unsubscribe through Resend's built-in links
✅ **Analytics**: Track email engagement through Resend dashboard
✅ **Segmentation**: Use audience for targeted email campaigns

## Usage Examples

### Send Email to All Users in Audience
```javascript
// In your email service
await resend.emails.send({
  from: 'Jim\'s Clipboard <noreply@jimsclipboard.com>',
  to: 'general', // Send to entire audience
  subject: 'Weekly Update',
  html: '<p>Your weekly update...</p>'
})
```

### Check Audience Size
```javascript
// Get audience details
const audience = await resend.audiences.get('general')
console.log(`Audience has ${audience.contacts} contacts`)
```

## Troubleshooting

### Users Not Being Added
1. Check Resend API key is correct
2. Verify "general" audience exists in Resend dashboard
3. Check browser console for error messages
4. Verify user has valid email address

### API Errors
1. Check Resend API key permissions
2. Verify audience ID matches exactly
3. Check network connectivity
4. Review error logs in browser console

### Duplicate Contacts
- This is handled automatically
- Existing contacts are updated, not duplicated
- Check Resend dashboard to confirm

## Future Enhancements

- Add audience segmentation (e.g., "active users", "inactive users")
- Implement email preferences in user settings
- Add analytics tracking for email engagement
- Create automated email campaigns based on user behavior

## Security Notes

- API endpoints are public but only add to audience
- No sensitive user data is exposed
- Users can unsubscribe at any time
- Follows email marketing best practices

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify your Resend configuration
3. Test with the admin interface first
4. Review Resend's API documentation for additional options
