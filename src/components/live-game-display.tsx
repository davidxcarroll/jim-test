'use client'

import { useLiveGame } from '@/hooks/use-live-game'
import { format } from 'date-fns'
import { getTeamDisplayName } from '@/utils/team-names'
import { formatHexColor, getTeamLogo, getTeamBackgroundAndLogo, getTeamDisplayNameWithFavorite } from '@/utils/team-utils'
import React, { useEffect, useState } from 'react'
import { subscribeToTeamColorMappingChanges, loadTeamColorMappings } from '@/store/team-color-mapping-store'

interface LiveGameDisplayProps {
  gameId: string
}

export function LiveGameDisplay({ gameId }: LiveGameDisplayProps) {
  const { game, situation, loading, error } = useLiveGame({
    gameId,
    autoRefresh: true,
    refreshInterval: 5000
  })
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

  if (loading) {
    return <div className="h-24 bg-gray-100 animate-pulse" />
  }
  if (error || !game) {
    return <div className="h-24 bg-red-100 flex items-center justify-center text-red-600">Error loading game</div>
  }

  // For NFL, we don't need line score calculation
  // Just show teams and scores

  // Note: This component now uses intelligent background and logo selection
  // to avoid white logos on white backgrounds
  // Available logo variations from ESPN API:
  // - default: Standard team logo
  // - dark: Dark version for light backgrounds
  // - scoreboard: Optimized for scoreboard displays
  // - darkScoreboard: Dark version optimized for scoreboard displays

  // Simple center block for NFL - just teams and scores
  const renderCenterBlock = () => {
    const getQuarterText = () => {
      if (!situation) return 'VS'
      
      const quarter = situation.quarter
      if (quarter === 1) return '1ST'
      if (quarter === 2) return '2ND'
      if (quarter === 3) return '3RD'
      if (quarter === 4) return '4TH'
      if (quarter > 4) return 'OT'
      return 'VS'
    }

    return (
      <div className="flex flex-col items-center justify-center xl:px-4 p-2 bg-white text-black shadow-[inset_0_1px_0_0_#000000,inset_0_-1px_0_0_#000000]">
        <div className="text-center">
          <div className="text-sm font-bold text-gray-600">{getQuarterText()}</div>
        </div>
      </div>
    )
  };



  // Main layout
  return (
    <div className="flex flex-row w-full overflow-hidden">
      
      {/* Away Team Block */}
      <div className="flex md:flex-row flex-col justify-evenly items-center flex-1 xl:px-6 xl:py-4 p-2 text-white relative shadow-[inset_0_0_0_1px_#000000]" style={{ background: awayTeamStyle.background }}>
        {getTeamLogo(game.awayTeam, awayTeamStyle.logoType) ? (
          <img src={getTeamLogo(game.awayTeam, awayTeamStyle.logoType)} alt={game.awayTeam.abbreviation} className="aspect-square xl:w-12 w-8 z-20 relative" />
        ) : (
          <div className="aspect-square xl:w-12 w-8 z-20 relative" />
        )}
        <div className="flex flex-col justify-center items-center z-20 relative">
          <span className="xl:text-3xl text-sm font-bold text-center uppercase leading-none max-md:mt-2">{getTeamDisplayNameWithFavorite(game.awayTeam, game, false)}</span>
        </div>
        <span className="xl:text-5xl text-2xl font-bold z-20 relative">{game.awayScore}</span>
      </div>

      {/* Center Block: VS */}
      {renderCenterBlock()}

      {/* Home Team Block */}
      <div className="flex md:flex-row max-md:flex-col-reverse flex-col justify-evenly items-center flex-1 xl:px-6 xl:py-4 p-2 text-white relative shadow-[inset_0_0_0_1px_#000000]" style={{ background: homeTeamStyle.background }}>
        <span className="xl:text-5xl text-2xl font-bold z-20 relative">{game.homeScore}</span>
        <div className="flex flex-col justify-center items-center z-20 relative">
          <span className="xl:text-3xl text-sm font-bold text-center uppercase leading-none max-md:mt-2">{getTeamDisplayNameWithFavorite(game.homeTeam, game, true)}</span>
        </div>
        {getTeamLogo(game.homeTeam, homeTeamStyle.logoType) ? (
          <img src={getTeamLogo(game.homeTeam, homeTeamStyle.logoType)} alt={game.homeTeam.abbreviation} className="aspect-square xl:w-12 w-8 z-20 relative" />
        ) : (
          <div className="aspect-square xl:w-12 w-8 z-20 relative" />
        )}
      </div>

      {/* Line Score Block - Removed for NFL */}

    </div>
  );
} 