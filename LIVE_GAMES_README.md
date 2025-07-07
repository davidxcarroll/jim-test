# Live Game Data Features

This document explains the live game data functionality that has been added to your MLB application.

## Overview

The ESPN API provides rich live data for games in progress, including:
- Real-time scores and game status
- Current game situation (balls, strikes, outs)
- Batter and pitcher information
- Base runner status
- Play-by-play data
- Live updates every few seconds

## New API Methods

### Enhanced ESPN API (`src/lib/espn-api.ts`)

#### `getLiveGameDetails(gameId: string)`
Returns comprehensive live game data including current situation and recent plays.

```typescript
const game = await espnApi.getLiveGameDetails('401696254')
```

#### `getGameSituation(gameId: string)`
Returns only the current game situation (for frequent updates).

```typescript
const situation = await espnApi.getGameSituation('401696254')
```

#### `getGamePlays(gameId: string, limit?: number)`
Returns recent plays for a game.

```typescript
const plays = await espnApi.getGamePlays('401696254', 20)
```

#### `getLiveGames()`
Returns all games currently in progress.

```typescript
const liveGames = await espnApi.getLiveGames()
```

## React Hooks

### `useLiveGame` Hook (`src/hooks/use-live-game.ts`)

Provides real-time updates for a single game with automatic refresh.

```typescript
const { game, situation, loading, error, isLive } = useLiveGame({
  gameId: '401696254',
  autoRefresh: true,
  refreshInterval: 5000 // 5 seconds
})
```

**Options:**
- `gameId`: The ESPN game ID
- `autoRefresh`: Enable automatic updates (default: true)
- `refreshInterval`: How often to refresh situation data (default: 10000ms)
- `enabled`: Enable/disable the hook (default: true)

**Returns:**
- `game`: Full game details with plays
- `situation`: Current game situation
- `loading`: Loading state
- `error`: Error message if any
- `refresh`: Manual refresh function
- `isLive`: Whether the game is currently live

### `useLiveGames` Hook

Provides real-time updates for all live games.

```typescript
const { games, loading, error, refresh } = useLiveGames()
```

## Components

### `LiveGameDisplay` Component (`src/components/live-game-display.tsx`)

A complete component that displays live game data with real-time updates.

```typescript
<LiveGameDisplay gameId="401696254" />
```

**Features:**
- Live score display
- Current game situation (balls, strikes, outs)
- Batter and pitcher information
- Base runner visualization
- Recent plays list
- Auto-refresh every 5 seconds

## Data Types

### `LiveGameSituation`
```typescript
interface LiveGameSituation {
  balls: number
  strikes: number
  outs: number
  pitcher?: {
    playerId: string
    name?: string
    summary?: string
  }
  batter?: {
    playerId: string
    name?: string
    summary?: string
  }
  onFirst?: boolean
  onSecond?: boolean
  onThird?: boolean
  lastPlay?: {
    id: string
    text?: string
  }
}
```

### `Play`
```typescript
interface Play {
  id: string
  sequenceNumber: string
  type: {
    id: string
    text: string
    type: string
  }
  text: string
  awayScore: number
  homeScore: number
  period: {
    type: string
    number: number
    displayValue: string
  }
  scoringPlay: boolean
  wallclock: string
  atBatId?: string
  pitchCount?: {
    balls: number
    strikes: number
  }
  resultCount?: {
    balls: number
    strikes: number
  }
  outs: number
}
```

### `LiveGameDetails`
```typescript
interface LiveGameDetails extends Game {
  situation?: LiveGameSituation
  plays?: Play[]
  lastUpdated?: string
}
```

## Usage Examples

### Display a Live Game
```typescript
import { LiveGameDisplay } from '@/components/live-game-display'

function MyComponent() {
  return <LiveGameDisplay gameId="401696254" />
}
```

### Custom Live Game Hook Usage
```typescript
import { useLiveGame } from '@/hooks/use-live-game'

function MyComponent() {
  const { game, situation, loading, isLive } = useLiveGame({
    gameId: '401696254',
    refreshInterval: 3000 // 3 seconds
  })

  if (loading) return <div>Loading...</div>
  if (!game) return <div>Game not found</div>

  return (
    <div>
      <h2>{game.awayTeam.name} @ {game.homeTeam.name}</h2>
      <div>{game.awayScore} - {game.homeScore}</div>
      
      {isLive && situation && (
        <div>
          <p>Count: {situation.balls}-{situation.strikes}</p>
          <p>Outs: {situation.outs}</p>
          {situation.batter && <p>Batter: {situation.batter.name}</p>}
        </div>
      )}
    </div>
  )
}
```

### List All Live Games
```typescript
import { useLiveGames } from '@/hooks/use-live-game'

function LiveGamesList() {
  const { games, loading } = useLiveGames()

  if (loading) return <div>Loading live games...</div>

  return (
    <div>
      {games.map(game => (
        <div key={game.id}>
          {game.awayTeam.name} {game.awayScore} - {game.homeScore} {game.homeTeam.name}
          {game.situation && (
            <span> • {game.situation.balls}-{game.situation.strikes}, {game.situation.outs} out</span>
          )}
        </div>
      ))}
    </div>
  )
}
```

## API Endpoints

### GET `/api/live-games`
Returns all currently live games.

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 3,
  "timestamp": "2025-07-06T18:30:00.000Z"
}
```

## Performance Considerations

1. **Refresh Intervals**: The hooks use different refresh intervals:
   - Situation data: Every 5-10 seconds (frequent updates)
   - Full game data: Every 30 seconds (less frequent)

2. **Error Handling**: All API calls include error handling and fallbacks

3. **Loading States**: Components show loading states while fetching data

4. **Auto-cleanup**: Hooks automatically clean up intervals when components unmount

## Testing

Visit `/live-games` to see the live games demo page, or use the API endpoint `/api/live-games` to test the server-side functionality.

## Notes

- Live data is only available for games currently in progress
- The ESPN API provides data with a slight delay (usually 10-30 seconds)
- Some games may not have full play-by-play data available
- The API is rate-limited, so avoid making too many requests too quickly 