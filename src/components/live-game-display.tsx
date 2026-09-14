'use client'

import { useLiveGame } from '@/hooks/use-live-game'
import { format } from 'date-fns'
import { getTeamDisplayName } from '@/utils/team-names'
import { formatHexColor, getTeamLogo, getTeamBackgroundAndLogo, getTeamDisplayNameWithFavorite } from '@/utils/team-utils'
import React, { useEffect, useState } from 'react'
import { subscribeToTeamColorMappingChanges, loadTeamColorMappings } from '@/store/team-color-mapping-store'
import { Game } from '@/types/nfl'
import { dateHelpers } from '@/utils/date-helpers'

interface LiveGameDisplayProps {
  gameId: string
  game?: Game
}

export function LiveGameDisplay({ gameId, game: fallbackGame }: LiveGameDisplayProps) {
  const isLive = !fallbackGame || fallbackGame.status === 'live'
  const { game: liveGame, situation, loading, error } = useLiveGame({
    gameId,
    autoRefresh: isLive,
    refreshInterval: 5000,
    enabled: isLive
  })
  const game = (!isLive && fallbackGame) ? fallbackGame : (liveGame ?? fallbackGame ?? null)
  const [awayTeamStyle, setAwayTeamStyle] = useState<{ background: string; logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' }>({ background: '#1a1a1a', logoType: 'dark' })
  const [homeTeamStyle, setHomeTeamStyle] = useState<{ background: string; logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' }>({ background: '#1a1a1a', logoType: 'dark' })

  // Use mapping synchronously and subscribe to changes
  useEffect(() => {
    const loadMappingsAndUpdateStyles = async () => {
      // Ensure mappings are loaded
      await loadTeamColorMappings()

      if (game) {
        setAwayTeamStyle(getTeamBackgroundAndLogo(game.awayTeam))
        setHomeTeamStyle(getTeamBackgroundAndLogo(game.homeTeam))
      }
    }

    loadMappingsAndUpdateStyles()

    const unsubscribe = subscribeToTeamColorMappingChanges(() => {
      if (game) {
        setAwayTeamStyle(getTeamBackgroundAndLogo(game.awayTeam))
        setHomeTeamStyle(getTeamBackgroundAndLogo(game.homeTeam))
      }
    })
    return unsubscribe
  }, [game])

  // Debug logging to understand what data we're getting
  useEffect(() => {
    if (game) {
      console.log('🏈 LiveGameDisplay - Game data:', {
        gameId,
        awayTeam: game.awayTeam.abbreviation,
        homeTeam: game.homeTeam.abbreviation,
        awayScore: game.awayScore,
        homeScore: game.homeScore,
        status: game.status,
        quarter: game.quarter
      })
    }
    if (situation) {
      console.log('🏈 LiveGameDisplay - Situation data:', {
        quarter: situation.quarter,
        timeRemaining: situation.timeRemaining,
        down: situation.down,
        distance: situation.distance,
        fieldPosition: situation.fieldPosition
      })
    }
  }, [game, situation, gameId])

  if (!game) {
    if (loading && !error) {
      return <div className="hidden h-24 bg-gray-100 animate-pulse" />
    }
    return <div className="hidden h-24 bg-red-100 flex items-center justify-center text-red-600">Error loading game</div>
  }

  const isScheduled = game.status === 'scheduled'
  const isFinal = game.status === 'final' || game.status === 'post'

  // For NFL, we don't need line score calculation
  // Just show teams and scores

  // Note: This component now uses intelligent background and logo selection
  // to avoid white logos on white backgrounds
  // Available logo variations from ESPN API:
  // - default: Standard team logo
  // - dark: Dark version for light backgrounds
  // - scoreboard: Optimized for scoreboard displays
  // - darkScoreboard: Dark version optimized for scoreboard displays



  // Main layout
  return (
    <div className="flex flex-row overflow-hidden bg-gradient-to-b from-neutral-100 via-50 via-neutral-100 to-white">

      {/* Away Team Block */}
      <div
        className="w-full flex flex-row justify-end items-center gap-4 xl:px-6 xl:py-4 px-4 py-2 text-white"
        style={{ background: awayTeamStyle.background }}
      >
        {getTeamLogo(game.awayTeam, awayTeamStyle.logoType) ? (
          <img src={getTeamLogo(game.awayTeam, awayTeamStyle.logoType)} alt={game.awayTeam.abbreviation} className="aspect-square xl:w-12 w-8 z-20 relative" />
        ) : (
          <div className="aspect-square xl:w-12 w-8 z-20 relative" />
        )}
        {/* <div className="flex flex-col justify-center items-center z-20 relative">
          <span className="xl:text-3xl max-md:text-sm font-bold text-center uppercase leading-none max-md:mt-2">{getTeamDisplayNameWithFavorite(game.awayTeam, game, false)}</span>
        </div> */}
        {!isScheduled && (
          <span className="xl:text-4xl text-2xl font-bold z-20 relative">{game.awayScore}</span>
        )}
      </div>

      {/* Date and Time Block */}
      <div className="w-1/2 flex flex-row flex-wrap items-center justify-center lg:gap-8 gap-4 lg:px-8 px-4">

        {isScheduled && (
          <div className="uppercase xl:text-base text-sm font-bold text-center leading-none">
            {dateHelpers.formatTimeWithTimezone(game.date)}
          </div>
        )}

        {isFinal && (
          <div className="uppercase xl:text-base text-sm font-bold text-center leading-none">FINAL</div>
        )}

        {!isScheduled && !isFinal && (
          <>
            {/* Quarter Display */}
            {(situation?.quarter || game?.quarter) && (

              <div className="uppercase xl:text-base text-sm font-bold text-center leading-none">
                {(() => {
                  const quarter = situation?.quarter || game?.quarter
                  if (quarter === 1) return '1ST'
                  if (quarter === 2) return '2ND'
                  if (quarter === 3) return '3RD'
                  if (quarter === 4) return '4TH'
                  if (quarter && quarter > 4) return 'OT'
                  return quarter ? 'Q' + quarter : 'VS'
                })()}
              </div>
            )}

            {/* Time Remaining */}
            {situation?.timeRemaining && (
              <div className="uppercase xl:text-base text-sm font-bold text-center leading-none">{situation.timeRemaining}</div>
            )}
          </>
        )}

      </div>


      {/* Home Team Block */}
      <div
        className="w-full flex flex-row justify-start items-center gap-4 xl:px-6 xl:py-4 px-4 py-2 text-white"
        style={{ background: homeTeamStyle.background }}
      >
        {!isScheduled && (
          <span className="xl:text-4xl text-2xl font-bold z-20 relative">{game.homeScore}</span>
        )}
        {/* <div className="flex flex-col justify-center items-center z-20 relative">
          <span className="xl:text-3xl max-md:text-sm font-bold text-center uppercase leading-none max-md:mt-2">{getTeamDisplayNameWithFavorite(game.homeTeam, game, true)}</span>
        </div> */}
        {getTeamLogo(game.homeTeam, homeTeamStyle.logoType) ? (
          <img src={getTeamLogo(game.homeTeam, homeTeamStyle.logoType)} alt={game.homeTeam.abbreviation} className="aspect-square xl:w-12 w-8 z-20 relative" />
        ) : (
          <div className="aspect-square xl:w-12 w-8 z-20 relative" />
        )}
      </div>

    </div>
  );
}
