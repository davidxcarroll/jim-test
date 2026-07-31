/** Super Bowl winner abbreviation per season. Add new seasons as they complete. */
export const SEASON_SUPER_BOWL_WINNER: Record<number, string> = { 2025: 'SEA' }

export function getSuperBowlWinnerForSeason(season: number): string {
  return SEASON_SUPER_BOWL_WINNER[season] ?? ''
}
