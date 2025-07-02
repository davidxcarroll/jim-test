import { Game, Team } from '@/types/mlb'
import { format as formatDate } from 'date-fns'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb'

export const espnApi = {
  // Get today's games
  async getTodaysGames(): Promise<Game[]> {
    const response = await fetch(`${ESPN_BASE_URL}/scoreboard`)
    const data = await response.json()
    
    return data.events?.map((event: any) => ({
      id: event.id,
      date: event.date,
      homeTeam: {
        id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.id,
        name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.name,
        abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.abbreviation,
        city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.location,
        division: '',
        league: '',
        logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos?.[0]?.href || '',
        color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.color || '',
        alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.alternateColor || ''
      },
      awayTeam: {
        id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.id,
        name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.name,
        abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.abbreviation,
        city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.location,
        division: '',
        league: '',
        logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos?.[0]?.href || '',
        color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.color || '',
        alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.alternateColor || ''
      },
      homeScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
      awayScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
                status: event.status.type.state === 'in' ? 'live' : event.status.type.state === 'pre' ? 'scheduled' : event.status.type.state,
      venue: event.competitions[0].venue?.fullName,
      startTime: event.date
    })) || []
  },

  // Get specific game details
  async getGameDetails(gameId: string): Promise<Game | null> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.header) return null
    
    return {
      id: data.header.id,
      date: data.header.date,
      homeTeam: {
        id: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.id,
        name: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.name,
        abbreviation: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.abbreviation,
        city: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.location,
        division: '',
        league: '',
        logo: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos?.[0]?.href || '',
        color: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.color || '',
        alternateColor: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.alternateColor || ''
      },
      awayTeam: {
        id: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.id,
        name: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.name,
        abbreviation: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.abbreviation,
        city: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.location,
        division: '',
        league: '',
        logo: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos?.[0]?.href || '',
        color: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.color || '',
        alternateColor: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.alternateColor || ''
      },
      homeScore: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
      awayScore: data.header.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
      status: data.header.status.type.state === 'in' ? 'live' : data.header.status.type.state === 'pre' ? 'scheduled' : data.header.status.type.state,
      inning: data.gameInfo?.inning,
      topInning: data.gameInfo?.topInning,
      venue: data.header.competitions[0].venue?.fullName,
      startTime: data.header.date
    }
  },

  // Get all teams
  async getTeams(): Promise<Team[]> {
    const response = await fetch(`${ESPN_BASE_URL}/teams`)
    const data = await response.json()
    
    return data.sports[0].leagues[0].teams.map((team: any) => ({
      id: team.team.id,
      name: team.team.name,
      abbreviation: team.team.abbreviation,
      city: team.team.location,
      division: team.team.division?.name || '',
      league: team.team.league?.name || '',
      logo: team.team.logos?.[0]?.href || '',
      color: team.team.color || '',
      alternateColor: team.team.alternateColor || ''
    }))
  },

  // Get games for a date range (week)
  async getGamesForDateRange(startDate: Date, endDate: Date): Promise<Game[]> {
    const games: Game[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = formatDate(current, 'yyyyMMdd'); // YYYYMMDD
      const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${dateStr}`);
      const data = await response.json();
      if (data.events) {
        games.push(...data.events.map((event: any) => ({
          id: event.id,
          date: event.date,
          homeTeam: {
            id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.id,
            name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.name,
            abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.abbreviation,
            city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.location,
            division: '',
            league: '',
            logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos?.[0]?.href || '',
            color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.color || '',
            alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.alternateColor || ''
          },
          awayTeam: {
            id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.id,
            name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.name,
            abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.abbreviation,
            city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.location,
            division: '',
            league: '',
            logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos?.[0]?.href || '',
            color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.color || '',
            alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.alternateColor || ''
          },
          homeScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
          awayScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
          status: event.status.type.state === 'in' ? 'live' : event.status.type.state === 'pre' ? 'scheduled' : event.status.type.state,
          venue: event.competitions[0].venue?.fullName,
          startTime: event.date
        })));
      }
      current.setDate(current.getDate() + 1);
    }
    return games;
  }
} 