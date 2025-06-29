// Map of official MLB team abbreviations to colloquial display names
// This is for display purposes only - backend logic uses official abbreviations
export const teamDisplayNames: Record<string, string> = {
  'ARI': 'D Backs',         // Arizona Diamondbacks
  'ATL': 'Braves',          // Atlanta Braves
  'BAL': 'Orioles',         // Baltimore Orioles
  'BOS': 'Sox',             // Boston Red Sox
  'CHC': 'Cubs',            // Chicago Cubs
  'CHW': 'White Sox',       // Chicago White Sox
  'CIN': 'Reds',            // Cincinnati Reds
  'CLE': 'Commanders',      // Cleveland Guardians
  'COL': 'Rox',             // Colorado Rockies
  'DET': 'Tigers',          // Detroit Tigers
  'HOU': 'Stros',           // Houston Astros
  'KC': 'Royals',           // Kansas City Royals
  'LAA': 'Angels',          // Los Angeles Angels
  'LAD': 'Dodgers',         // Los Angeles Dodgers
  'MIA': 'Marlins',         // Miami Marlins
  'MIL': 'Brewers',         // Milwaukee Brewers
  'MIN': 'Twins',           // Minnesota Twins
  'NYM': 'Mets',            // New York Mets
  'NYY': 'Yanks',           // New York Yankees
  'OAK': 'Athletics',       // Oakland Athletics
  'PHI': 'Phils',           // Philadelphia Phillies
  'PIT': 'Bucs',            // Pittsburgh Pirates
  'SD': 'Pads',             // San Diego Padres
  'SEA': 'Mariners',        // Seattle Mariners
  'SF': 'Giants',           // San Francisco Giants
  'STL': 'Cards',           // St. Louis Cardinals
  'TB': 'Rays',             // Tampa Bay Rays
  'TEX': 'Rangers',         // Texas Rangers
  'TOR': 'Jays',            // Toronto Blue Jays
  'WSH': 'Nats',            // Washington Nationals
  'ATH': 'Athletics',       // Athletics (alternate abbreviation for OAK)
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