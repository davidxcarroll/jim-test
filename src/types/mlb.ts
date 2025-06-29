export interface Team {
  id: string
  name: string
  abbreviation: string
  city: string
  division: string
  league: string
  logo?: string
}

export interface Player {
  id: string
  name: string
  position: string
  teamId: string
  stats?: PlayerStats
}

export interface PlayerStats {
  battingAverage?: number
  homeRuns?: number
  rbi?: number
  era?: number
  wins?: number
  losses?: number
  saves?: number
}

export interface Game {
  id: string
  date: string
  homeTeam: Team
  awayTeam: Team
  homeScore?: number
  awayScore?: number
  status: 'scheduled' | 'live' | 'final' | 'post'
  inning?: number
  topInning?: boolean
  venue?: string
  startTime?: string
}

export interface GameStats {
  gameId: string
  homeHits: number
  awayHits: number
  homeErrors: number
  awayErrors: number
  homeRuns: number
  awayRuns: number
}

export interface UserPick {
  id: string
  userId: string
  gameId: string
  pickedTeamId: string
  confidence: number
  createdAt: Date
  result?: 'win' | 'loss' | 'pending'
} 