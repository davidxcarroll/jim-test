# Team Color Mapping - Admin Level Configuration

## Overview

The team color mapping system has been upgraded to store configurations centrally in Firebase Firestore, making them permanent across all users. This is an admin-level feature that affects the entire application.

## How It Works

### Storage
- **Location**: Firebase Firestore collection `teamColorMappings` with document `mappings`
- **Structure**: Array of `TeamColorMapping` objects with team abbreviation, background color choice, custom color, and logo type
- **Persistence**: Changes are immediately saved to Firestore and affect all users

### Configuration Options

Each team can be configured with:

1. **Background Color Choice**:
   - `primary`: Uses team's primary color
   - `secondary`: Uses team's secondary/alternate color  
   - `custom`: Uses a manually specified hex color

2. **Logo Type**:
   - `default`: Standard team logo
   - `dark`: Dark version for light backgrounds
   - `scoreboard`: Optimized for scoreboard displays
   - `darkScoreboard`: Dark version optimized for scoreboards

### Access Points

1. **Admin Configuration Page**: `/team-colors`
   - Full interface for configuring all teams
   - Live preview of color/logo combinations
   - Grid overview of all team settings
   - Reset functionality to clear all mappings

2. **API Endpoint**: `/api/team-colors/init`
   - POST request to initialize mappings from Firestore
   - Used during app startup to load configurations

### Usage in Components

The system is used in:
- **Live Game Display**: Shows team colors and logos based on admin mappings
- **Settings Page**: World Series pick selector uses mapped team colors
- **Dashboard**: Any team displays use the admin-configured colors

### Technical Implementation

```typescript
// Load mappings from Firestore
const mappings = await loadMappingsFromFirestore()

// Get background color for a team
const background = getTeamBackgroundColor(team, mappings)

// Get logo type for a team  
const logoType = getTeamLogoType(team, mappings)

// Update a team's configuration
await updateTeamMapping(abbreviation, choice, customColor, logoType)

// Reset all mappings
await resetAllMappings()
```

### Benefits

1. **Consistency**: All users see the same team colors and logos
2. **Admin Control**: Centralized configuration management
3. **Persistence**: Changes survive app restarts and affect all users
4. **Flexibility**: Full control over color and logo combinations
5. **Performance**: Cached in memory after initial load from Firestore

### Migration from localStorage

The system has been migrated from localStorage (per-user) to Firestore (global):
- Old: Each user had their own team color preferences
- New: Single admin configuration affects all users
- Admin can now set optimal color/logo combinations for all teams

### Security Considerations

- Only authenticated users can access the `/team-colors` page
- Firestore security rules should restrict write access to admin users
- Read access is needed for all users to display team colors correctly 