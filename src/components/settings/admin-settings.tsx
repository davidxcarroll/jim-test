'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteField } from 'firebase/firestore'
import { getRoundDisplayName, getWeekKey, getSelectableWeeks, getFirstRegularSeasonWeek, isPreseasonVisibleInApp } from '@/utils/date-helpers'
import { espnApi } from '@/lib/espn-api'
import { useCurrentWeek } from '@/hooks/use-current-week'
import { useGamesForWeek } from '@/hooks/use-nfl-data'
import { teamDisplayNames } from '@/utils/team-names'
import { getTeamLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'
import { loadTeamColorMappings, getTeamColorMapping } from '@/store/team-color-mapping-store'
import {
  getActiveSuperBowlSeasonYear,
  getSuperBowlPickForSeason,
  buildSuperBowlPicksUpdate,
  SuperBowlPicksMap
} from '@/utils/super-bowl-picks'
import { isAdminUser } from '@/utils/admin-user'
import React from 'react'

interface User {
  id: string
  displayName?: string
  email?: string
  superBowlPick?: string
  superBowlPicks?: SuperBowlPicksMap
}

interface Game {
  id: string
  homeTeam: {
    abbreviation: string
    name: string
  }
  awayTeam: {
    abbreviation: string
    name: string
  }
  status: string
}

interface Pick {
  pickedTeam: 'home' | 'away'
  pickedAt: any
  homeTeam?: any
  awayTeam?: any
}

interface UserPicks {
  [gameId: string]: Pick
}

function teamCircleStyle(team: Team, colorsReady: boolean): {
  background: string
  logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard'
} {
  const mapping = colorsReady ? getTeamColorMapping(team.abbreviation) : undefined
  let background = '#1a1a1a'
  let logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' = 'dark'

  if (mapping) {
    if (mapping.backgroundColorChoice === 'custom' && mapping.customColor) {
      background = mapping.customColor
    } else if (mapping.backgroundColorChoice === 'secondary' && team.alternateColor) {
      background = team.alternateColor.startsWith('#') ? team.alternateColor : `#${team.alternateColor}`
    } else if (team.color) {
      background = team.color.startsWith('#') ? team.color : `#${team.color}`
    }
    logoType = mapping.logoType || 'dark'
  } else if (team.color) {
    background = team.color.startsWith('#') ? team.color : `#${team.color}`
  }

  return { background, logoType }
}

export function AdminSettings() {
  const { user } = useAuthStore()
  const { currentWeek: apiCurrentWeek, weekInfo, loading: weekLoading, error: weekError } = useCurrentWeek()
  const [weekOffset, setWeekOffset] = useState(0)
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [userPicks, setUserPicks] = useState<Record<string, UserPicks>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [allAvailableWeeks, setAllAvailableWeeks] = useState<Array<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string }>>([])
  const [loadingWeeks, setLoadingWeeks] = useState(true)
  // When off-season (weekInfo null), which season to load weeks for (e.g. last completed season)
  const [offSeasonSelectedSeason, setOffSeasonSelectedSeason] = useState(() => new Date().getFullYear() - 1)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamColorsReady, setTeamColorsReady] = useState(false)
  const superBowlSeason = weekInfo?.season != null && !Number.isNaN(weekInfo.season)
    ? weekInfo.season
    : getActiveSuperBowlSeasonYear()

  // Fetch all available weeks from API: in-season use weekInfo.season, off-season use offSeasonSelectedSeason.
  // Wait until the current-week request settles so the off-season default season cannot race ahead and overwrite the in-season calendar.
  const seasonToFetch = weekInfo?.season ?? offSeasonSelectedSeason
  useEffect(() => {
    if (weekLoading) return
    let cancelled = false
    const fetchAllWeeks = async () => {
      try {
        setLoadingWeeks(true)
        const weeks = await espnApi.getAllAvailableWeeks(seasonToFetch)
        if (cancelled) return
        // Exclude Pro Bowl from week selector entirely (no option in dropdown)
        const weeksWithoutProBowl = weeks.filter(
          w => w.weekType !== 'pro-bowl' && !w.label?.toLowerCase().includes('pro bowl')
        )
        setAllAvailableWeeks(weeksWithoutProBowl)
      } catch (error) {
        console.error('Error fetching all available weeks:', error)
        if (!cancelled) setAllAvailableWeeks([])
      } finally {
        if (!cancelled) setLoadingWeeks(false)
      }
    }

    fetchAllWeeks()
    return () => {
      cancelled = true
    }
  }, [seasonToFetch, weekLoading])

  useEffect(() => {
    async function fetchTeams() {
      try {
        const apiTeams = await espnApi.getTeams()
        const uniqueTeams = Array.from(
          new Map(apiTeams.map(team => [team.abbreviation, team])).values()
        ).sort((a, b) => {
          const nameA = teamDisplayNames[a.abbreviation] || a.name
          const nameB = teamDisplayNames[b.abbreviation] || b.name
          return nameA.localeCompare(nameB)
        })
        setTeams(uniqueTeams)
      } catch (error) {
        console.error('Error fetching teams for Super Bowl picks:', error)
        setTeams([])
      }
    }
    fetchTeams()
    loadTeamColorMappings(true).then(() => setTeamColorsReady(true))
  }, [])

  // Get available weeks: in-season = weeks up to/including current; off-season = all started weeks for selected season
  const availableWeeks = React.useMemo(() => {
    const today = new Date()

    if (allAvailableWeeks.length === 0) return []

    // In-season: during preseason only Week 1; otherwise past + current/pickable
    if (weekInfo) {
      const firstRegular = getFirstRegularSeasonWeek(allAvailableWeeks)
      const selectable =
        isPreseasonVisibleInApp(weekInfo.weekType)
          ? firstRegular
            ? [firstRegular]
            : []
          : getSelectableWeeks(allAvailableWeeks, weekInfo)
      return selectable.map((week, i) => {
        const weekKey = getWeekKey(week.weekType, week.week, week.label)
        return {
          index: i,
          weekNumber: week.week,
          weekType: week.weekType,
          weekKey: `${week.season}_${weekKey}`,
          label: week.label,
          startDate: week.startDate
        }
      })
    }

    // Off-season: show all weeks that have started for the fetched season (so admin can view/manage any week)
    const started = allAvailableWeeks
      .filter(w => w.startDate <= today)
      .filter(w => w.weekType !== 'preseason')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    return started.map((week, i) => {
      const weekKey = getWeekKey(week.weekType, week.week, week.label)
      return {
        index: i,
        weekNumber: week.week,
        weekType: week.weekType,
        weekKey: `${week.season}_${weekKey}`,
        label: week.label,
        startDate: week.startDate
      }
    })
  }, [allAvailableWeeks, weekInfo])

  // Calculate week data based on the selected week offset (same as dashboard)
  const getWeekData = (offset: number) => {
    const seasonForMatch = weekInfo?.season ?? offSeasonSelectedSeason
    if (availableWeeks.length > 0 && offset < availableWeeks.length && allAvailableWeeks.length > 0) {
      const selectedWeekItem = availableWeeks[offset]
      const selectedWeek = allAvailableWeeks.find(w =>
        w.week === selectedWeekItem.weekNumber &&
        w.weekType === selectedWeekItem.weekType &&
        w.season === seasonForMatch
      )

      if (selectedWeek) {
        const weekKey = getWeekKey(selectedWeek.weekType, selectedWeek.week, selectedWeek.label)
        return {
          start: selectedWeek.startDate,
          end: selectedWeek.endDate,
          season: String(selectedWeek.season),
          week: weekKey,
          weekNumber: selectedWeek.week,
          weekInfo: selectedWeek
        }
      }
    }

    // Fallback to old calculation if weeks not loaded yet
    if (weekInfo) {
      const targetWeekNumber = weekInfo.week - offset
      const targetWeekStart = new Date(weekInfo.startDate.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      const targetWeekEnd = new Date(weekInfo.endDate.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      
      return {
        start: targetWeekStart,
        end: targetWeekEnd,
        season: String(weekInfo.season),
        week: weekInfo.weekType === 'preseason' ? `preseason-${targetWeekNumber}` : weekInfo.weekType === 'pro-bowl' ? `pro-bowl-${targetWeekNumber}` : `week-${targetWeekNumber}`,
        weekNumber: targetWeekNumber
      }
    }
    
    // Final fallback (e.g. while loading or API failed); weekInfo is falsy here so use off-season season
    const today = new Date()
    const fallbackWeekStart = new Date(today.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
    const fallbackWeekEnd = new Date(fallbackWeekStart.getTime() + (6 * 24 * 60 * 60 * 1000))
    const fallbackSeason = offSeasonSelectedSeason
    return {
      start: fallbackWeekStart,
      end: fallbackWeekEnd,
      season: String(fallbackSeason),
      week: `week-${Math.max(1, 18 - offset)}`,
      weekNumber: Math.max(1, 18 - offset)
    }
  }

  const currentWeekData = useMemo(() => {
    console.log('📅 Admin picks: Calculating week data for offset:', weekOffset, 'weekInfo:', weekInfo, 'availableWeeks:', availableWeeks.length)
    return getWeekData(weekOffset)
  }, [weekOffset, weekInfo, availableWeeks, allAvailableWeeks, offSeasonSelectedSeason])
  
  const { data: games, isLoading: gamesLoading } = useGamesForWeek(currentWeekData.start, currentWeekData.end)

  // Debug logging for games and week data
  useEffect(() => {
    console.log('🎮 Admin picks: Games data changed:', {
      games: games?.length || 0,
      gamesLoading,
      weekData: currentWeekData,
      weekOffset,
      weekKey: `${currentWeekData.season}_${currentWeekData.week}`
    })
  }, [games, gamesLoading, currentWeekData, weekOffset])

  // Set initial week when weeks are loaded: in-season = current week; off-season = last week (e.g. Super Bowl)
  useEffect(() => {
    if (availableWeeks.length === 0) return
    if (weekInfo) {
      if (isPreseasonVisibleInApp(weekInfo.weekType)) {
        const week1Index = availableWeeks.findIndex((w) => w.weekType === 'regular')
        if (week1Index >= 0) {
          setWeekOffset(week1Index)
        }
        return
      }
      const currentWeekIndex = availableWeeks.findIndex(w =>
        w.weekNumber === weekInfo.week &&
        w.weekType === weekInfo.weekType
      )
      if (currentWeekIndex >= 0 && weekOffset === 0) {
        setWeekOffset(currentWeekIndex)
      }
    } else {
      // Off-season: default to last week (most recent)
      if (weekOffset === 0) {
        setWeekOffset(availableWeeks.length - 1)
      }
    }
  }, [availableWeeks.length, weekInfo])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.week-selector')) {
        setIsWeekDropdownOpen(false)
      }
    }

    if (isWeekDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isWeekDropdownOpen])

  // Load data when week changes
  useEffect(() => {
    if (!isAdminUser(user?.uid)) return
    console.log('🔄 Admin picks: Loading data for week:', currentWeekData)
    loadData()
  }, [user, currentWeekData.season, currentWeekData.week, currentWeekData.start, currentWeekData.end])

  const loadData = async () => {
    console.log('🔄 Admin picks: Starting loadData for week:', currentWeekData)
    setLoading(true)
    setMessage(null)

    try {
      // Load users
      console.log('📊 Admin picks: Loading users...')
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[]
      console.log('👥 Admin picks: Loaded users:', usersList.length)
      setUsers(usersList)

      // Load picks for each user using the current week data
      console.log('🎯 Admin picks: Loading picks for week key:', `${currentWeekData.season}_${currentWeekData.week}`)
      const picksPromises = usersList.map(async (user) => {
        const weekKey = `${currentWeekData.season}_${currentWeekData.week}`
        const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekKey))
        return {
          userId: user.id,
          picks: picksDoc.exists() ? picksDoc.data() as UserPicks : {}
        }
      })

      const picksResults = await Promise.all(picksPromises)
      const picksMap: Record<string, UserPicks> = {}
      picksResults.forEach(result => {
        picksMap[result.userId] = result.picks
      })
      console.log('🎯 Admin picks: Loaded picks for users:', Object.keys(picksMap).length)
      setUserPicks(picksMap)

    } catch (error) {
      console.error('❌ Admin picks: Error loading data:', error)
      setMessage({ text: 'Failed to load data', type: 'error' })
    } finally {
      console.log('✅ Admin picks: Finished loadData')
      setLoading(false)
    }
  }


  const handlePickChange = async (userId: string, gameId: string, newPick: 'home' | 'away' | '') => {
    if (!isAdminUser(user?.uid)) return

    setSaving(true)
    setMessage(null)

    try {
      const currentPicks = userPicks[userId] || {}
      let updatedPicks = { ...currentPicks }

      if (newPick === '') {
        // Remove the pick
        delete updatedPicks[gameId]
      } else {
        // Update the pick
        updatedPicks[gameId] = {
          ...currentPicks[gameId],
          pickedTeam: newPick,
          pickedAt: new Date()
        }
      }

      // Update local state
      setUserPicks(prev => ({
        ...prev,
        [userId]: updatedPicks
      }))

      // Save to database
      const weekKey = `${currentWeekData.season}_${currentWeekData.week}`
      await setDoc(doc(db, 'users', userId, 'picks', weekKey), updatedPicks, { merge: true })

      setMessage({ text: 'Pick updated successfully', type: 'success' })

    } catch (error) {
      setMessage({ text: 'Failed to update pick', type: 'error' })
      console.error('Error updating pick:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSuperBowlPickChange = async (userId: string, teamAbbreviation: string) => {
    if (!isAdminUser(user?.uid) || !db) return

    setSaving(true)
    setMessage(null)

    try {
      const targetUser = users.find(u => u.id === userId)
      const nextMap = buildSuperBowlPicksUpdate(
        targetUser?.superBowlPicks,
        superBowlSeason,
        teamAbbreviation,
        targetUser?.superBowlPick
      )

      await updateDoc(doc(db, 'users', userId), {
        [`superBowlPicks.${superBowlSeason}`]: teamAbbreviation || deleteField(),
        updatedAt: new Date(),
        ...(superBowlSeason === 2025
          ? { superBowlPick: teamAbbreviation || deleteField() }
          : {})
      })

      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u
        return {
          ...u,
          superBowlPicks: nextMap,
          superBowlPick: superBowlSeason === 2025
            ? (teamAbbreviation || undefined)
            : u.superBowlPick
        }
      }))

      const teamLabel = teamAbbreviation
        ? (teamDisplayNames[teamAbbreviation] || teamAbbreviation)
        : 'cleared'
      const userLabel = targetUser?.displayName || targetUser?.email || userId
      setMessage({
        text: `${superBowlSeason} Super Bowl pick ${teamAbbreviation ? 'updated' : 'cleared'} for ${userLabel}${teamAbbreviation ? `: ${teamLabel}` : ''}`,
        type: 'success'
      })
    } catch (error) {
      setMessage({ text: 'Failed to update Super Bowl pick', type: 'error' })
      console.error('Error updating Super Bowl pick:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatGameDisplay = (game: Game) => {
    if (game.homeTeam && game.awayTeam) {
      return `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`
    }
    return `Game ${game.id}`
  }

  const getCurrentPick = (userId: string, gameId: string): 'home' | 'away' | '' => {
    const pick = userPicks[userId]?.[gameId]
    return pick?.pickedTeam || ''
  }

  if (!isAdminUser(user?.uid)) {
    return null
  }

  return (
    <div className="text-base">
        {/* Controls */}
        <div className="px-6">
          <div className="flex gap-4 items-center flex-wrap">
            {!weekInfo && (
              <div>
                <label className="block text-sm font-medium text-black mb-1 uppercase">Season</label>
                <select
                  value={offSeasonSelectedSeason}
                  onChange={(e) => {
                    setOffSeasonSelectedSeason(Number(e.target.value))
                    setWeekOffset(0)
                  }}
                  className="border-[1px] border-black px-3 py-2 min-w-[100px] font-bold uppercase bg-white"
                >
                  {[new Date().getFullYear() - 1, new Date().getFullYear() - 2, new Date().getFullYear() - 3].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="week-selector relative">
              {/* <label className="block text-sm font-medium text-black mb-1 uppercase">Week</label> */}
              <div
                className="border-[1px] border-black px-3 py-2 cursor-pointer bg-neutral-100 flex items-center justify-between min-w-[120px] font-bold uppercase"
                onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
              >
                <span className="font-medium">
                  {(() => {
                    const currentWeekInfo = availableWeeks.find(w => w.index === weekOffset)

                    if (currentWeekInfo) {
                      return getRoundDisplayName(
                        currentWeekInfo.label,
                        currentWeekInfo.weekType,
                        currentWeekInfo.weekNumber
                      )
                    }

                    // Fallback if week not found
                    return 'Loading...'
                  })()}
                </span>
                <span className={`material-symbols-sharp transition-transform ${isWeekDropdownOpen ? 'rotate-180' : ''}`}>
                  arrow_drop_down
                </span>
              </div>
              
              {/* Dropdown overlay */}
              {isWeekDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-[inset_0_0_0_1px_#000000] z-50 max-h-60 overflow-y-auto">
                  {[...availableWeeks].reverse().map((weekInfo) => (
                    <div
                      key={weekInfo.index}
                      className={`px-3 py-2 cursor-pointer hover:bg-black hover:text-white font-bold uppercase ${
                        weekInfo.index === weekOffset ? 'bg-black/30' : ''
                      }`}
                      onClick={() => {
                        setWeekOffset(weekInfo.index)
                        setIsWeekDropdownOpen(false)
                      }}
                    >
                      {getRoundDisplayName(
                        weekInfo.label,
                        weekInfo.weekType,
                        weekInfo.weekNumber
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="">
              <button
                onClick={loadData}
                disabled={loading || gamesLoading || loadingWeeks}
                className="bg-black text-white px-4 py-2 hover:bg-white hover:text-black border-[1px] border-black font-bold uppercase disabled:opacity-50"
              >
                {loading || gamesLoading || loadingWeeks ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 shadow-[inset_0_0_0_1px_#000000] font-bold uppercase ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Picks Table */}
        {loading || gamesLoading || loadingWeeks ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">Loading picks data...</div>
            <div className="text-sm text-black mt-2 font-bold uppercase">
              Loading: {loading ? 'Yes' : 'No'} | Games Loading: {gamesLoading ? 'Yes' : 'No'}
            </div>
            <div className="text-xs text-black mt-1 font-bold uppercase">
              Week: {currentWeekData.season} {currentWeekData.week} | Games: {games?.length || 0}
            </div>
          </div>
        ) : !games || games.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">No games found for {currentWeekData.season} {currentWeekData.week}</div>
            <div className="text-sm text-black mt-2 font-bold uppercase">
              This may be a preseason week or the week hasn't been scheduled yet
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-[inset_0_0_0_1px_#000000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Game
                    </th>
                    {users.map(user => (
                      <th key={user.id} className="px-4 py-3 text-center text-xs font-bold text-black uppercase tracking-wider">
                        {user.displayName || user.email || user.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-black">
                  {games.map(game => (
                    <tr key={game.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black uppercase">
                        {formatGameDisplay(game)}
                      </td>
                      {users.map(user => (
                        <td key={user.id} className="px-4 py-4 whitespace-nowrap text-center">
                          <select
                            value={getCurrentPick(user.id, game.id)}
                            onChange={(e) => handlePickChange(user.id, game.id, e.target.value as 'home' | 'away' | '')}
                            disabled={saving}
                            className="border-[1px] border-black px-2 py-1 text-sm font-bold uppercase disabled:opacity-50"
                          >
                            <option value="">--</option>
                            <option value="away">{game.awayTeam?.abbreviation || 'Away'}</option>
                            <option value="home">{game.homeTeam?.abbreviation || 'Home'}</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-black p-6 uppercase">Super Bowl Picks</h2>

        {users.length === 0 && loading ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">Loading users...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">No users found</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 p-6">
            {users.map(rowUser => {
              const currentPick = getSuperBowlPickForSeason(rowUser, superBowlSeason)
              const pickedTeam = currentPick
                ? teams.find(team => team.abbreviation === currentPick)
                : undefined
              const circle = pickedTeam ? teamCircleStyle(pickedTeam, teamColorsReady) : null
              const logoSrc = pickedTeam && circle ? getTeamLogo(pickedTeam, circle.logoType) : undefined
              const pickLabel = currentPick
                ? (teamDisplayNames[currentPick] || pickedTeam?.name || currentPick)
                : 'Select a Team'
              const hasCurrentTeamOption = !currentPick || teams.some(team => team.abbreviation === currentPick)
              const userLabel = rowUser.displayName || rowUser.email || rowUser.id
              return (
                <div
                  key={rowUser.id}
                  className="w-40 bg-white shadow-[0_0_0_1px_#000000] flex flex-col items-center gap-3 p-4"
                >
                  <div className="w-full text-center text-sm font-bold uppercase leading-tight">
                    {userLabel}
                  </div>
                  {pickedTeam && circle && logoSrc ? (
                    <div
                      className="w-16 h-16 flex items-center justify-center p-1 rounded-full shadow-[0_0_0_1px_#000000]"
                      style={{ backgroundColor: circle.background }}
                    >
                      <img
                        src={logoSrc}
                        alt=""
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full shadow-[0_0_0_1px_#000000]" />
                  )}
                  <div className="relative w-full">
                    <select
                      value={currentPick}
                      onChange={(e) => handleSuperBowlPickChange(rowUser.id, e.target.value)}
                      disabled={saving}
                      aria-label={`${userLabel} Super Bowl pick`}
                      className="absolute inset-0 opacity-0 z-20 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="">Clear</option>
                      {!hasCurrentTeamOption && (
                        <option value={currentPick}>
                          {teamDisplayNames[currentPick] || currentPick}
                        </option>
                      )}
                      {teams.map((team) => (
                        <option key={team.abbreviation} value={team.abbreviation}>
                          {teamDisplayNames[team.abbreviation] || team.name}
                        </option>
                      ))}
                    </select>
                    <div className="border border-black px-2 py-1 text-center text-sm font-bold uppercase">
                      {pickLabel}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
