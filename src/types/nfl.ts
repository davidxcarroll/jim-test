export interface Team {
  id: string
  name: string
  abbreviation: string
  city: string
  division: string
  conference: string // AFC or NFC
  logo?: string
  logos?: {
    default?: string
    dark?: string
    scoreboard?: string
    darkScoreboard?: string
  }
  color?: string
  alternateColor?: string
  wins?: number
  losses?: number
  ties?: number // NFL has ties
}

export interface Game {
  id: string
  date: string
  homeTeam: Team
  awayTeam: Team
  homeScore?: number
  awayScore?: number
  status: 'scheduled' | 'live' | 'final' | 'post'
  quarter?: number // Replace inning with quarter
  down?: number // 1st, 2nd, 3rd, 4th down
  distance?: number // Yards needed for first down
  fieldPosition?: string // e.g., "NE 45" for New England's 45-yard line
  venue?: string
  startTime?: string
  favoriteTeam?: 'home' | 'away' // Which team is favored to win
}

export interface GameStats {
  gameId: string
  homeTotalYards: number
  awayTotalYards: number
  homePassingYards: number
  awayPassingYards: number
  homeRushingYards: number
  awayRushingYards: number
  homeTurnovers: number
  awayTurnovers: number
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