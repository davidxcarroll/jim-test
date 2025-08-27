# New User Visibility Feature

## Overview

This feature ensures that new users are visible by default for all existing users, with an option to control this behavior in the settings.

## How It Works

### Default Behavior
- When a new user signs up (via email/password or magic link), they are automatically added to all existing users' visibility settings
- This means new users will appear on everyone's dashboard by default
- Each user can control whether they want new users to be visible by default

### User Control
- In the Settings → People tab, users can toggle "Show new users by default"
- When enabled: New users will automatically be visible on your dashboard
- When disabled: New users will be hidden by default, and you'll need to manually enable them in the people settings

## Implementation Details

### Files Modified

1. **`src/store/clipboard-visibility-store.ts`**
   - Added `showNewUsersByDefault` setting to the store
   - Added `updateShowNewUsersByDefault` function
   - Added `addNewUserToAllUsers` function to update all existing users' settings

2. **`src/components/settings/people-settings.tsx`**
   - Added toggle for "Show new users by default" setting
   - Added handler for the new setting

3. **`src/app/signup/page.tsx`**
   - Added call to update visibility settings when new user signs up

4. **`src/app/auth-complete/page.tsx`**
   - Added logic to detect new users signing up via magic link
   - Added call to update visibility settings for new magic link users

5. **`src/app/api/clipboard-visibility/add-new-user/route.ts`**
   - New API endpoint to handle adding new users to all existing users' visibility settings

### Database Schema

The clipboard visibility settings now include:
```typescript
interface ClipboardVisibilitySettings {
  visibleUsers: Set<string>
  lastUpdated: Date | null
  showNewUsersByDefault: boolean  // New field
}
```

### API Endpoints

- `POST /api/clipboard-visibility/add-new-user`
  - Adds a new user to all existing users' visibility settings
  - Respects each user's `showNewUsersByDefault` setting
  - Uses Firestore batch writes for efficiency

## User Experience

### For New Users
1. Sign up via email/password or magic link
2. Automatically visible to all existing users (unless they've disabled the setting)
3. Can immediately see other users' picks on their dashboard

### For Existing Users
1. New users automatically appear on their dashboard
2. Can control this behavior in Settings → People → "Show new users by default"
3. Can still manually hide/show individual users as before

## Error Handling

- If visibility settings update fails during signup, the signup process continues
- Users are notified via toast messages when settings are updated
- All operations are wrapped in try-catch blocks to prevent crashes

## Future Enhancements

- Could add a notification when new users join
- Could add bulk operations for managing multiple users
- Could add analytics to track how often users change the default setting

