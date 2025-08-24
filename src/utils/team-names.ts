// Map of official NFL team abbreviations to colloquial display names
// This is for display purposes only - backend logic uses official abbreviations
export const teamDisplayNames: Record<string, string> = {
  'ARI': 'Cards',          // Arizona Cardinals
  'ATL': 'Falcons',        // Atlanta Falcons
  'BAL': 'Ravens',         // Baltimore Ravens
  'BUF': 'Bills',          // Buffalo Bills
  'CAR': 'Panthers',       // Carolina Panthers
  'CHI': 'Bears',          // Chicago Bears
  'CIN': 'Bengals',        // Cincinnati Bengals
  'CLE': 'Browns',         // Cleveland Browns
  'DAL': 'Cowboys',        // Dallas Cowboys
  'DEN': 'Broncos',        // Denver Broncos
  'DET': 'Lions',          // Detroit Lions
  'GB': 'Packers',         // Green Bay Packers
  'HOU': 'Texans',         // Houston Texans
  'IND': 'Colts',          // Indianapolis Colts
  'JAX': 'Jags',           // Jacksonville Jaguars
  'KC': 'Chiefs',          // Kansas City Chiefs
  'LAC': 'Chargers',       // Los Angeles Chargers
  'LAR': 'Rams',           // Los Angeles Rams
  'LV': 'Raiders',         // Las Vegas Raiders
  'MIA': 'Dolphins',       // Miami Dolphins
  'MIN': 'Vikings',        // Minnesota Vikings
  'NE': 'Pats',            // New England Patriots
  'NO': 'Saints',          // New Orleans Saints
  'NYG': 'Giants',         // New York Giants
  'NYJ': 'Jets',           // New York Jets
  'PHI': 'Eagles',         // Philadelphia Eagles
  'PIT': 'Steelers',       // Pittsburgh Steelers
  'SEA': 'Seahawks',       // Seattle Seahawks
  'SF': '49ers',           // San Francisco 49ers
  'TB': 'Bucs',            // Tampa Bay Buccaneers
  'TEN': 'Titans',         // Tennessee Titans
  'WSH': 'Commanders',     // Washington Commanders
}

/**
 * Get the display name for a team abbreviation
 * @param abbreviation - The official team abbreviation
 * @returns The colloquial display name, or the original abbreviation if no mapping exists
 */
export function getTeamDisplayName(abbreviation: string): string {
  return teamDisplayNames[abbreviation] || abbreviation
}

/**
 * Get the display name for a team object
 * @param team - The team object with abbreviation property
 * @returns The colloquial display name, or the original abbreviation if no mapping exists
 */
export function getTeamDisplayNameFromTeam(team: { abbreviation: string }): string {
  return getTeamDisplayName(team.abbreviation)
} 