import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { espnApi } from '@/lib/espn-api'
import { getSeasonAndWeek, dateHelpers, getWeekKey } from '@/utils/date-helpers'

export async function POST(request: NextRequest) {
  try {
    const { weekOffset, weekId: providedWeekId, force = false } = await request.json()
    
    let weekId: string
    let start!: Date
    let end!: Date
    let season: string
    let week: string

    // If weekId is provided, normalize to canonical form (week-1 not week-01) so we read/write the same doc id the dashboard uses.
    if (providedWeekId) {
      const [seasonStr, weekStr] = providedWeekId.split('_')
      season = seasonStr
      let canonicalWeek = weekStr
      if (weekStr?.startsWith('week-')) {
        const n = parseInt(weekStr.replace('week-', ''), 10)
        if (!Number.isNaN(n) && n >= 1 && n <= 18) canonicalWeek = `week-${n}`
      }
      weekId = `${seasonStr}_${canonicalWeek}`
      week = canonicalWeek

      if (weekStr.startsWith('pro-bowl-')) {
        return NextResponse.json({ success: false, error: 'Pro Bowl weeks are not included in recaps or stats' }, { status: 400 })
      }

      // Use the same week source as the dashboard: getAllAvailableWeeks(season) and match by weekKey.
      const allWeeks = await espnApi.getAllAvailableWeeks(parseInt(season))
      const matchingWeek = allWeeks.find(
        (w) => getWeekKey(w.weekType, w.week, w.label) === canonicalWeek
      )
      if (!matchingWeek) {
        return NextResponse.json({
          success: false,
          error: `Could not find week ${weekId} in ESPN API (season ${season}, weekKey "${canonicalWeek}")`
        }, { status: 404 })
      }
      start = matchingWeek.startDate
      end = matchingWeek.endDate
    } else {
      // Use ESPN API to get current week info
      const today = new Date()
      const weekInfoResult = await getSeasonAndWeek(today)
      season = weekInfoResult.season
      week = weekInfoResult.week
      if (week.startsWith('pro-bowl-')) {
        return NextResponse.json({ success: false, error: 'Pro Bowl weeks are not included in recaps or stats' }, { status: 400 })
      }
      const weekRange = dateHelpers.getWednesdayWeekRange(today)
      start = weekRange.start
      end = weekRange.end
      weekId = `${season}_${week}`
    }

    console.log(`🔄 Calculating recap for week ${weekId} (${start.toISOString()} to ${end.toISOString()})`)

    // Check if recap already exists (unless force is true)
    if (!force) {
      const existingRecapDoc = await getDoc(doc(db, 'weekRecaps', weekId))
      if (existingRecapDoc.exists()) {
        console.log(`💾 Week recap data already exists for ${weekId}`)
        return NextResponse.json({ 
          success: true, 
          message: 'Week recap data already exists (use force=true to recalculate)',
          weekId 
        })
      }
    } else {
      console.log(`🔄 Force recalculating week ${weekId}`)
    }

    // Fetch all users
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any)).filter((user: any) => user.displayName)

    // Fetch games for this week
    const weekGames = await espnApi.getGamesForDateRange(start, end)
    console.log(`🎮 Found ${weekGames.length} games for week ${weekId}`)
    
    // Debug: Check game scores and get sample user picks to compare IDs
    const finishedGames = weekGames.filter(g => g.status === 'final' || g.status === 'post')
    console.log(`🏁 Found ${finishedGames.length} finished games for week ${weekId}`)
    
    // Get sample user picks to compare game IDs
    let samplePicksGameIds: string[] = []
    if (users.length > 0) {
      try {
        const sampleUserPicksDoc = await getDoc(doc(db, 'users', users[0].id, 'picks', weekId))
        if (sampleUserPicksDoc.exists()) {
          const samplePicks = sampleUserPicksDoc.data()
          samplePicksGameIds = Object.keys(samplePicks).filter(key => key !== 'pickedTeam' && key !== 'pickedAt')
          console.log(`📋 Sample user has ${samplePicksGameIds.length} picks with game IDs:`, samplePicksGameIds.slice(0, 5))
        }
      } catch (error) {
        console.error('Error fetching sample picks:', error)
      }
    }
    
    const finishedGameIds = finishedGames.map(g => String(g.id))
    const matchingIds = finishedGameIds.filter(id => samplePicksGameIds.includes(id))
    console.log(`🔍 Game ID comparison: ${matchingIds.length}/${finishedGameIds.length} game IDs match between API and picks`)
    console.log(`📊 API game IDs (first 5):`, finishedGameIds.slice(0, 5))
    console.log(`📋 Pick game IDs (first 5):`, samplePicksGameIds.slice(0, 5))
    
    if (finishedGames.length > 0) {
      const sampleGame = finishedGames[0]
      console.log(`📊 Sample game: ${sampleGame.id} (type: ${typeof sampleGame.id}), status: ${sampleGame.status}, homeScore: ${sampleGame.homeScore} (${typeof sampleGame.homeScore}), awayScore: ${sampleGame.awayScore} (${typeof sampleGame.awayScore})`)
    }

    // Calculate stats for each user
    // ⚠️ CRITICAL: We ONLY READ user picks here - NEVER modify them
    // User picks are sacred and must never be changed by automated processes
    const userStats = []
    for (const user of users) {
      try {
        // READ ONLY - getDoc is read-only, never use setDoc/updateDoc/deleteDoc on picks
        const userPicksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekId))
        const userPicks = userPicksDoc.exists() ? userPicksDoc.data() : {}
        let correct = 0
        let totalChecked = 0
        let gamesWithPicks = 0
        let gamesWithValidScores = 0
        let underdogPicks = 0
        let underdogCorrect = 0
        const debugInfo: any[] = []
        
        // For each played game, check if user picked and if correct; track underdog picks (favorite from odds/records)
        for (const game of weekGames) {
          if (game.status === 'final' || game.status === 'post') {
            totalChecked++
            // Match pick by string or number key (Firestore and dashboard may use either)
            const gameIdStr = String(game.id)
            const pick = userPicks[gameIdStr]?.pickedTeam ?? (userPicks as any)[game.id]?.pickedTeam
            if (pick) gamesWithPicks++
            
            // Use nullish coalescing like dashboard does (only defaults null/undefined, not 0 or empty string)
            const homeScore = game.homeScore != null ? Number(game.homeScore) : null
            const awayScore = game.awayScore != null ? Number(game.awayScore) : null
            
            // Only check correctness if we have valid scores
            if (homeScore != null && awayScore != null && !isNaN(homeScore) && !isNaN(awayScore)) {
              gamesWithValidScores++
              const homeWon = homeScore > awayScore
              const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon)
              
              // Underdog = opposite of favorite (favorite from ESPN odds or team records)
              const favorite = game.favoriteTeam
              const underdog = favorite === 'home' ? 'away' : favorite === 'away' ? 'home' : null
              if (underdog !== null && pick === underdog) {
                underdogPicks++
                if (pickCorrect) underdogCorrect++
              }
              
              // Debug first few games
              if (debugInfo.length < 3) {
                debugInfo.push({
                  gameId: game.id,
                  pick,
                  homeScore,
                  awayScore,
                  homeWon,
                  pickCorrect,
                  correct: pickCorrect ? 1 : 0
                })
              }
              
              if (pick && pickCorrect) correct++
            } else {
              // Log if we have a game without valid scores
              console.warn(`⚠️ Game ${game.id} has invalid scores: home=${game.homeScore}, away=${game.awayScore}`)
            }
            // If no pick, counts as incorrect (do nothing)
          }
        }
        
        // Debug logging for first user
        if (userStats.length === 0 && debugInfo.length > 0) {
          const finishedGameIds = weekGames.filter(g => g.status === 'final' || g.status === 'post').map(g => String(g.id))
          const pickGameIds = Object.keys(userPicks).filter(key => key !== 'pickedTeam' && key !== 'pickedAt')
          const matchingIds = finishedGameIds.filter(id => pickGameIds.includes(id))
          
          console.log(`🔍 Debug for user ${user.id}:`, {
            totalPicks: pickGameIds.length,
            pickKeys: pickGameIds.slice(0, 10),
            finishedGameIds: finishedGameIds.slice(0, 10),
            matchingIds: matchingIds.slice(0, 10),
            gamesWithPicks,
            gamesWithValidScores,
            correct,
            sampleGames: debugInfo,
            matchRate: `${matchingIds.length}/${finishedGameIds.length} game IDs match`
          })
        }
        const total = weekGames.filter(g => {
          const isFinished = g.status === 'final' || g.status === 'post'
          if (isFinished) {
            const homeScore = g.homeScore != null ? Number(g.homeScore) : null
            const awayScore = g.awayScore != null ? Number(g.awayScore) : null
            // Only count games with valid scores
            return homeScore != null && awayScore != null && !isNaN(homeScore) && !isNaN(awayScore)
          }
          return false
        }).length
        
        // Only include user in this week's recap if they made at least one pick — otherwise they "missed" the week (asterisk / missing weeks on /stats).
        if (total > 0 && gamesWithPicks > 0) {
          const percentage = Math.round((correct / total) * 100)
          userStats.push({
            userId: user.id,
            correct,
            total,
            percentage,
            underdogPicks,
            underdogCorrect
          })
        } else if (totalChecked > 0) {
          // Log if we checked games but none had valid scores
          console.warn(`⚠️ User ${user.id} had ${totalChecked} finished games but none had valid scores`)
        }
      } catch (error) {
        console.error(`❌ Error calculating stats for user ${user.id}:`, error)
      }
    }

    // Find top score
    const maxCorrect = userStats.length > 0 
      ? Math.max(...userStats.map(s => s.correct))
      : 0
    const winnerIds = userStats.filter(s => s.correct === maxCorrect && maxCorrect > 0).map(s => s.userId)

    // Log summary for debugging
    const totalGames = weekGames.filter(g => {
      const isFinished = g.status === 'final' || g.status === 'post'
      if (isFinished) {
        const homeScore = g.homeScore != null ? Number(g.homeScore) : null
        const awayScore = g.awayScore != null ? Number(g.awayScore) : null
        return homeScore != null && awayScore != null && !isNaN(homeScore) && !isNaN(awayScore)
      }
      return false
    }).length
    
    // Debug: Check a sample user's picks
    if (userStats.length > 0) {
      const sampleUser = userStats[0]
      const sampleUserDoc = await getDoc(doc(db, 'users', sampleUser.userId, 'picks', weekId))
      const samplePicks = sampleUserDoc.exists() ? sampleUserDoc.data() : {}
      const pickCount = Object.keys(samplePicks).length
      console.log(`📊 Week ${weekId} summary: ${userStats.length} users, ${totalGames} finished games with valid scores, top score: ${maxCorrect}`)
      console.log(`📊 Sample user ${sampleUser.userId}: ${pickCount} picks, ${sampleUser.correct}/${sampleUser.total} correct`)
    } else {
      console.log(`📊 Week ${weekId} summary: ${userStats.length} users, ${totalGames} finished games with valid scores, top score: ${maxCorrect}`)
    }

    // Add isTopScore flag to each user's stats
    const userStatsWithTopScore = userStats.map(stat => ({
      ...stat,
      isTopScore: winnerIds.includes(stat.userId)
    }))

    // Save to Firestore - ONLY writing to weekRecaps collection, NEVER touching user picks
    const weekRecapData = {
      weekId,
      season,
      week,
      calculatedAt: serverTimestamp(),
      userStats: userStatsWithTopScore
    }

    await setDoc(doc(db, 'weekRecaps', weekId), weekRecapData)
    console.log(`💾 Saved week recap data for ${weekId}: ${userStatsWithTopScore.length} users`)

    // Debug: Check if we have any users with correct picks
    const usersWithCorrectPicks = userStats.filter(s => s.correct > 0).length
    
    // Diagnostic: how many users have picks for this week, and do API game IDs match pick keys?
    const finishedGameIdsList = weekGames.filter(g => g.status === 'final' || g.status === 'post').map(g => String(g.id))
    let gameIdMatchInfo: {
      usersWithPicksCount: number
      pickKeysSample: string[]
      apiIdsSample: string[]
      anyMatch: boolean
      note?: string
      samplePickIds: string[]
      sampleApiIds: string[]
      matchingIds: number
      finishedGameIds: number
    } | null = null
    if (users.length > 0 && finishedGames.length > 0) {
      let usersWithPicksCount = 0
      let firstUserWithPicks: { pickKeys: string[] } | null = null
      for (const user of users) {
        const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekId))
        const data = picksDoc.exists() ? picksDoc.data() : {}
        const pickKeys = Object.keys(data).filter(k => k !== 'pickedTeam' && k !== 'pickedAt')
        if (pickKeys.length > 0) {
          usersWithPicksCount++
          if (!firstUserWithPicks) firstUserWithPicks = { pickKeys }
        }
      }
      const apiIdsSample = finishedGameIdsList.slice(0, 8)
      const pickKeysSample = firstUserWithPicks ? firstUserWithPicks.pickKeys.slice(0, 8) : []
      const anyMatch = firstUserWithPicks ? finishedGameIdsList.some(id => firstUserWithPicks!.pickKeys.includes(id)) : false
      const matchingCount = firstUserWithPicks ? finishedGameIdsList.filter(id => firstUserWithPicks!.pickKeys.includes(id)).length : 0
      gameIdMatchInfo = {
        usersWithPicksCount,
        pickKeysSample,
        apiIdsSample,
        anyMatch,
        samplePickIds: pickKeysSample,
        sampleApiIds: apiIdsSample,
        matchingIds: matchingCount,
        finishedGameIds: finishedGameIdsList.length,
        note: usersWithPicksCount === 0
          ? `No users have picks for ${weekId}. Confirm season (e.g. 2024) and that picks were saved for this week.`
          : !anyMatch
            ? 'Picks exist but no API game ID matches a pick key — wrong week/season or ID format.'
            : undefined
      }
    }

    const debugMessage = usersWithCorrectPicks === 0 && userStats.length > 0 && totalGames > 0
      ? `⚠️ Warning: ${userStats.length} users processed but none have correct picks. Check game IDs and scores.`
      : 'Week recap data calculated and saved'

    return NextResponse.json({ 
      success: true, 
      message: debugMessage,
      weekId,
      userCount: userStatsWithTopScore.length,
      topScore: maxCorrect,
      totalGames: totalGames,
      usersWithCorrectPicks: usersWithCorrectPicks,
      gameIdMatchInfo: gameIdMatchInfo,
      debug: userStats.length > 0 ? {
        sampleUser: {
          userId: userStats[0].userId,
          correct: userStats[0].correct,
          total: userStats[0].total
        }
      } : null
    })

  } catch (error) {
    console.error('❌ Error calculating week recap:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to calculate week recap' 
    }, { status: 500 })
  }
} 