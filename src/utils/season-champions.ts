/** Aggregate clipboard season standings from weekRecaps (regular + postseason only). */

export type SeasonChampionRecap = {
  weekId: string
  userStats?: Array<{
    userId: string
    correct: number
    total: number
    isTopScore?: boolean
  }>
}

export type SeasonChampionUser = {
  id: string
  displayName: string
}

const isPostseasonWeek = (weekStr: string) =>
  ['wild-card', 'divisional', 'conference', 'super-bowl'].some(
    (k) => weekStr === k || weekStr?.startsWith(k + '-')
  )

function isCountableWeekForCompletedSeason(weekId: string, seasonYear: number): boolean {
  const [seasonStr, weekStr] = (weekId || '_').split('_')
  if (!/^\d+$/.test(seasonStr || '') || !weekStr) return false
  if (parseInt(seasonStr, 10) !== seasonYear) return false
  const isRegular = weekStr.startsWith('week-') && !weekStr.includes('pro-bowl')
  const isPostseason = isPostseasonWeek(weekStr)
  if (!isRegular && !isPostseason) return false
  if (isRegular) {
    const weekNumber = parseInt(weekStr.replace('week-', ''), 10)
    if (Number.isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) return false
  }
  return true
}

/** Display names of users tied for most correct picks in the season (highest totalCorrect). */
export function computeSeasonChampionNames(
  weekRecaps: SeasonChampionRecap[],
  users: SeasonChampionUser[],
  seasonYear: number
): string[] {
  const usersById = new Map(users.map((u) => [u.id, u.displayName]))
  const totals = new Map<string, number>()

  for (const recap of weekRecaps) {
    if (!isCountableWeekForCompletedSeason(recap.weekId, seasonYear)) continue
    for (const stat of recap.userStats ?? []) {
      if (!stat.userId || !usersById.has(stat.userId)) continue
      if (!(stat.total > 0)) continue
      totals.set(stat.userId, (totals.get(stat.userId) ?? 0) + (stat.correct || 0))
    }
  }

  const totalsList = Array.from(totals.entries())
  if (totalsList.length === 0) return []

  const maxCorrect = Math.max(...totalsList.map(([, correct]) => correct))
  if (maxCorrect <= 0) return []

  return totalsList
    .filter(([, correct]) => correct === maxCorrect)
    .map(([userId]) => usersById.get(userId)!)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
}

/** NFL season year to finalize when ESPN reports off-season (Sep–Feb season year). */
export function getLikelyCompletedSeasonYear(now: Date = new Date()): number {
  // Jan–July: previous calendar year's NFL season just finished / is finishing.
  // Aug–Dec: current calendar year is the active (or upcoming) season year.
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()
  return month < 7 ? year - 1 : year
}
