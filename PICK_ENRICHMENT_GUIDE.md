# Pick Enrichment Guide

This guide explains how to identify which teams are playing in each game in your picks database.

## The Problem

Currently, your picks database stores games as numerical IDs (like `401772715`, `401772724`) with only:
- `pickedTeam`: "home" or "away"
- `pickedAt`: timestamp

This makes it impossible to know which teams are actually playing in each game.

## The Solution

I've created several tools to help you identify the teams and enrich your database:

### 1. Quick Lookup Script

**File:** `scripts/lookup-game-teams.js`

This script quickly looks up team information for all games in a specific week without modifying your database.

```bash
# Look up teams for 2025 Week 1
node scripts/lookup-game-teams.js 2025 1
```

**Output:**
- Shows which teams are playing in each game
- Saves results to a JSON file for reference
- Does not modify your database

### 2. Database Enrichment Script

**File:** `scripts/enrich-picks-with-teams.js`

This script enriches your existing pick data by adding team information to each pick.

```bash
# Show current pick structure (for debugging)
node scripts/enrich-picks-with-teams.js 2025 1 show

# Enrich picks with team information
node scripts/enrich-picks-with-teams.js 2025 1 enrich
```

**What it does:**
- Adds `homeTeam` and `awayTeam` objects to each pick
- Includes team names, abbreviations, and cities
- Adds game date and status
- Preserves all existing pick data

### 3. Admin Interface

**File:** `src/app/admin/pick-analysis/page.tsx`

A web interface to view your enriched pick data.

**Access:** Navigate to `/admin/pick-analysis` in your app

**Features:**
- View all picks for any week
- See which games have team data vs. which are missing it
- Display team matchups (e.g., "KC @ BUF")
- Show who picked which team

### 4. Utility Functions

**File:** `src/utils/pick-enrichment.ts`

Helper functions for working with enriched pick data in your application.

**Key functions:**
- `getGameTeams(gameId)` - Look up teams for a game ID
- `createEnrichedPick()` - Create new picks with team data
- `formatTeamMatchup()` - Display team matchup nicely
- `getPickedTeamName()` - Get the name of the picked team

## How to Use

### Step 1: Quick Check
First, see what games you have and which teams are playing:

```bash
node scripts/lookup-game-teams.js 2025 1
```

### Step 2: Enrich Your Database
Add team information to your existing picks:

```bash
node scripts/enrich-picks-with-teams.js 2025 1 enrich
```

### Step 3: View Results
Open your app and go to `/admin/pick-analysis` to see the enriched data.

## Example Output

After enrichment, your pick data will look like this:

```json
{
  "401772715": {
    "pickedTeam": "home",
    "pickedAt": "September 10, 2025 at 3:18:04 PM UTC-7",
    "homeTeam": {
      "id": "2",
      "name": "Buffalo Bills",
      "abbreviation": "BUF",
      "city": "Buffalo"
    },
    "awayTeam": {
      "id": "12",
      "name": "Kansas City Chiefs", 
      "abbreviation": "KC",
      "city": "Kansas City"
    },
    "gameDate": "2025-09-10T20:00Z",
    "gameStatus": "final"
  }
}
```

## Benefits

✅ **Identify Teams**: Know which teams are playing in each game  
✅ **Better Analytics**: Analyze picks by team, matchup, etc.  
✅ **User Experience**: Show meaningful team names instead of just "home/away"  
✅ **Historical Data**: Preserve team information for past seasons  
✅ **No Data Loss**: All existing pick data is preserved  

## Notes

- The scripts use ESPN's API to look up team information
- API calls are rate-limited to be respectful
- Enrichment is idempotent - safe to run multiple times
- Team data is cached in your database after enrichment

## Troubleshooting

**"No data found for game ID"**
- The game might be from a different season
- ESPN might not have data for that specific game
- Check if the game ID is correct

**"Firebase not initialized"**
- Make sure your Firebase config is set up correctly
- Check that you're running the script from the project root

**"Rate limit exceeded"**
- The script includes delays between API calls
- If you still hit limits, increase the delay in the script
