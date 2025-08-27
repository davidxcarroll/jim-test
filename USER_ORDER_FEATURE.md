# User Order Management Feature

## Overview

The user order management feature allows users to control the order in which people appear on their dashboard. This feature is similar to the movie ranking system but for managing the visibility order of other users' picks.

## Key Features

### 1. User Order Settings
- Users can reorder the people they see on their dashboard using up/down arrows
- The authenticated user is always locked to the first position
- Order changes are saved automatically and reflected immediately on the dashboard

### 2. Visual Indicators
- Up/down arrows appear next to each user in the people settings page
- Arrows are disabled (invisible) when they can't be used:
  - Up arrow is disabled for the first user (after the current user)
  - Down arrow is disabled for the last user
  - Current user's arrows are always disabled

### 3. Data Structure
The user order is stored in the clipboard visibility settings with the following structure:
```typescript
interface ClipboardVisibilitySettings {
  visibleUsers: Set<string>
  userOrder: string[] // Array of user IDs in display order
  lastUpdated: Date | null
  showNewUsersByDefault: boolean
}
```

## Implementation Details

### Store Updates (`src/store/clipboard-visibility-store.ts`)
- Added `userOrder` array to track user display order
- Added `updateUserOrder()` method to save order changes
- Added `moveUserInOrder()` method to handle up/down movements
- Ensured current user is always first in the order

### People Settings Page (`src/components/settings/people-settings.tsx`)
- Added up/down arrow buttons similar to movies settings
- Implemented `handleMoveUserUp()` and `handleMoveUserDown()` functions
- Added sorting logic to display users in the correct order
- Prevented current user from being moved

### Dashboard Page (`src/app/dashboard/page.tsx`)
- Updated user filtering and sorting to use the user order from settings
- Removed hardcoded sorting logic
- Users now appear in the order set in the people settings

## User Experience

1. **Settings Page**: Users can click the up/down arrows next to each person to reorder them
2. **Dashboard**: The order set in settings is immediately reflected on the dashboard
3. **Persistence**: Order changes are saved to Firebase and persist across sessions
4. **Constraints**: The current user cannot be moved and always appears first

## Technical Constraints

- Current user is always locked to the first position
- New users are automatically added to the end of the order
- Order changes are validated to prevent invalid states
- The feature integrates with existing clipboard visibility settings

## Future Enhancements

- Drag and drop reordering
- Bulk reordering options
- Order presets or templates
- Export/import of user order preferences
