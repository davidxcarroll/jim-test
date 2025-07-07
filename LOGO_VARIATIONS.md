# Team Logo Variations

The ESPN API provides multiple logo variations for each MLB team. This document explains the available options and how they're used in the application.

## Available Logo Types

### 1. Default Logo
- **Path**: `https://a.espncdn.com/i/teamlogos/mlb/500/{team}.png`
- **Use case**: Standard team logo for general use
- **Example**: `https://a.espncdn.com/i/teamlogos/mlb/500/ari.png`

### 2. Dark Logo
- **Path**: `https://a.espncdn.com/i/teamlogos/mlb/500-dark/{team}.png`
- **Use case**: Dark version for better contrast on light backgrounds
- **Example**: `https://a.espncdn.com/i/teamlogos/mlb/500-dark/ari.png`

### 3. Scoreboard Logo
- **Path**: `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/{team}.png`
- **Use case**: Optimized for scoreboard displays
- **Example**: `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/ari.png`

### 4. Dark Scoreboard Logo
- **Path**: `https://a.espncdn.com/i/teamlogos/mlb/500-dark/scoreboard/{team}.png`
- **Use case**: Dark version optimized for scoreboard displays
- **Example**: `https://a.espncdn.com/i/teamlogos/mlb/500-dark/scoreboard/ari.png`

## Implementation

### Manual Team Color Mapping

The application uses a manual team color mapping system for precise control over background colors:

#### Problem
Some teams (like the Dodgers) have white as one of their brand colors, which creates visibility problems when using dark logos on white backgrounds.

#### Solution
A manual mapping system allows you to specify exactly which color and logo to use for each team:

1. **Background Color Options**:
   - **Primary Color** (default): Uses the team's primary brand color
   - **Secondary Color**: Uses the team's secondary/alternate brand color  
   - **Custom Color**: Allows you to specify any custom color

2. **Logo Type Options**:
   - **Default Logo**: Standard team logo
   - **Dark Logo** (default): Dark version for better contrast
   - **Scoreboard Logo**: Optimized for scoreboard displays
   - **Dark Scoreboard Logo**: Dark version optimized for scoreboards

#### Configuration
- Navigate to `/team-colors` to configure team background colors and logo types
- All teams default to Primary Color + Dark Logo unless specified otherwise
- Changes are applied immediately to live game displays
- Full control over both background and logo selection

### TypeScript Interface
```typescript
interface Team {
  logos?: {
    default?: string
    dark?: string
    scoreboard?: string
    darkScoreboard?: string
  }
  // ... other fields
}
```

### Utility Function
The `getTeamLogo()` function in `src/utils/team-utils.ts` provides easy access to logo variations:

```typescript
getTeamLogo(team, 'default')     // Returns default logo
getTeamLogo(team, 'dark')        // Returns dark logo
getTeamLogo(team, 'scoreboard')  // Returns scoreboard logo
getTeamLogo(team, 'darkScoreboard') // Returns dark scoreboard logo
```

### Usage in Components

#### Live Game Display
- Uses manual color mapping via `getTeamBackgroundAndLogo()`
- Always uses dark logos for optimal contrast
- Example: `getTeamBackgroundAndLogo(game.awayTeam)`

#### Settings Page
- Uses `default` logos for standard display
- Example: `getTeamLogo(selectedTeam, 'default')`

#### Team Colors Page
- Manual configuration interface at `/team-colors`
- Allows selection of Primary, Secondary, or Custom colors for each team
- Allows selection of Default, Dark, Scoreboard, or Dark Scoreboard logos for each team
- Live preview of color and logo combinations

## Fallback Strategy

The logo selection follows this fallback order:
1. Requested logo variation
2. Default logo
3. Legacy `logo` field (for backward compatibility)

## API Integration

The ESPN API response includes a `logos` array with `rel` properties that indicate the logo type:
- `["full", "default"]` → Default logo
- `["full", "dark"]` → Dark logo  
- `["full", "scoreboard"]` → Scoreboard logo
- `["full", "scoreboard", "dark"]` → Dark scoreboard logo

The `extractLogoVariations()` function in `src/lib/espn-api.ts` parses these variations and maps them to the appropriate fields. 