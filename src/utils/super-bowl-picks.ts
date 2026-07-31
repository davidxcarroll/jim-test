/** Per-season Super Bowl pick helpers. Prefer `superBowlPicks[year]`; migrate legacy `superBowlPick` as 2025. */

export type SuperBowlPicksMap = Record<string, string>

/** Season year users should edit for the upcoming/current cycle (ESPN season year when available). */
export function getActiveSuperBowlSeasonYear(weekInfoSeason?: number | null): number {
  if (weekInfoSeason != null && !Number.isNaN(weekInfoSeason)) return weekInfoSeason
  return new Date().getFullYear()
}

export function getSuperBowlPickForSeason(
  userData: { superBowlPicks?: SuperBowlPicksMap; superBowlPick?: string } | null | undefined,
  season: number
): string {
  if (!userData) return ''
  const fromMap = userData.superBowlPicks?.[String(season)]
  if (typeof fromMap === 'string' && fromMap) return fromMap
  // Legacy flat field only applies to the 2025 season
  if (season === 2025 && typeof userData.superBowlPick === 'string' && userData.superBowlPick) {
    return userData.superBowlPick
  }
  return ''
}

/** Build updated map + optional legacy migration for 2025. */
export function buildSuperBowlPicksUpdate(
  existing: SuperBowlPicksMap | undefined,
  season: number,
  teamAbbreviation: string,
  legacyPick?: string
): SuperBowlPicksMap {
  const next: SuperBowlPicksMap = { ...(existing || {}) }
  if (!next['2025'] && legacyPick) {
    next['2025'] = legacyPick
  }
  if (teamAbbreviation) {
    next[String(season)] = teamAbbreviation
  } else {
    delete next[String(season)]
  }
  return next
}
