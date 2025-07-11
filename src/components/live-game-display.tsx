'use client'

import { useLiveGame } from '@/hooks/use-live-game'
import { format } from 'date-fns'
import { getTeamDisplayName } from '@/utils/team-names'
import { formatHexColor, getTeamLogo, getTeamBackgroundAndLogo } from '@/utils/team-utils'
import React, { useEffect, useState } from 'react'
import { subscribeToTeamColorMappingChanges } from '@/store/team-color-mapping-store'

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
    if (game) {
      setAwayTeamStyle(getTeamBackgroundAndLogo(game.awayTeam))
      setHomeTeamStyle(getTeamBackgroundAndLogo(game.homeTeam))
    }
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

  // Helper: Compute innings-by-innings line score from plays
  const getLineScore = () => {
    if (!game.plays) return { innings: [], awayTotals: [], homeTotals: [] };
    const inningsMap = new Map<number, { away: number; home: number }>();
    game.plays.forEach((play) => {
      const inning = play.period?.number;
      if (!inning) return;
      inningsMap.set(inning, { away: play.awayScore, home: play.homeScore });
    });
    const innings = Array.from(inningsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([inning, scores]) => ({ inning, ...scores }));
    return {
      innings,
      awayTotals: innings.map((inn) => inn.away),
      homeTotals: innings.map((inn) => inn.home),
    };
  };
  const lineScore = getLineScore();
  const currentInning = game.inning || 1;

  // Note: This component now uses intelligent background and logo selection
  // to avoid white logos on white backgrounds
  // Available logo variations from ESPN API:
  // - default: Standard team logo
  // - dark: Dark version for light backgrounds
  // - scoreboard: Optimized for scoreboard displays
  // - darkScoreboard: Dark version optimized for scoreboard displays

  // SVG for base diamond
  const renderBaseDiamond = () => (
    <svg width="40" height="30" viewBox="0 0 40 30">
      {/* 1B */}
      <rect x="24" y="14" width="12" height="12" rx="0" transform="rotate(45 30 20)" fill={situation?.onFirst ? '#111' : 'rgba(0,0,0,0.2)'} />
      {/* 2B */}
      <rect x="14" y="4" width="12" height="12" rx="0" transform="rotate(45 20 10)" fill={situation?.onSecond ? '#111' : 'rgba(0,0,0,0.2)'} />
      {/* 3B */}
      <rect x="4" y="14" width="12" height="12" rx="0" transform="rotate(45 10 20)" fill={situation?.onThird ? '#111' : 'rgba(0,0,0,0.2)'} />
    </svg>
  );

  // SVG for outs dots only
  const renderOutsDots = () => (
    <div className="flex items-center gap-1 mt-1">
      {[...Array(3)].map((_, i) => (
        <span key={i} className={`w-2 h-2 rounded-full ${i < (situation?.outs ?? 0) ? 'bg-black' : ''}`} style={{ background: i < (situation?.outs ?? 0) ? '#111' : 'rgba(0,0,0,0.2)' }}></span>
      ))}
    </div>
  );



  // Main layout
  return (
    <div className="flex flex-row w-full overflow-hidden">
      
      {/* Away Team Block */}
      <div className="flex md:flex-row flex-col justify-evenly items-center flex-1 xl:px-6 xl:py-4 p-2 text-white relative shadow-[inset_0_0_0_1px_#000000]" style={{ background: awayTeamStyle.background }}>
        {getTeamLogo(game.awayTeam, awayTeamStyle.logoType) ? (
          <img src={getTeamLogo(game.awayTeam, awayTeamStyle.logoType)} alt={game.awayTeam.abbreviation} className="aspect-square max:w-12 w-8 z-20 relative" />
        ) : (
          <div className="aspect-square max:w-12 w-8 z-20 relative" />
        )}
        <div className="flex flex-col justify-center items-center z-20 relative">
          <span className="xl:text-3xl text-sm font-bold text-center uppercase leading-none max-md:mt-2">{getTeamDisplayName(game.awayTeam.abbreviation)}</span>
        </div>
        <span className="xl:text-5xl text-2xl font-bold z-20 relative">{game.awayScore}</span>
      </div>

      {/* Center Block: Diamond, Inning, Count */}
      <div className="flex flex-col items-center justify-between xl:px-4 p-2 bg-white text-black shadow-[inset_0_1px_0_0_#000000,inset_0_-1px_0_0_#000000]">
        {renderBaseDiamond()}
        <div className="flex items-center">
          <span
            className="material-symbols-sharp text-2xl font-black !text-4xl"
            style={{ display: 'inline-block', transform: game.topInning === false ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            arrow_drop_up
          </span>
          <span className="text-xl font-bold">{game.inning || 1}</span>
        </div>
        {renderOutsDots()}
      </div>

      {/* Home Team Block */}
      <div className="flex md:flex-row max-md:flex-col-reverse flex-col justify-evenly items-center flex-1 xl:px-6 xl:py-4 p-2 text-white relative shadow-[inset_0_0_0_1px_#000000]" style={{ background: homeTeamStyle.background }}>
        <span className="xl:text-5xl text-2xl font-bold z-20 relative">{game.homeScore}</span>
        <div className="flex flex-col justify-center items-center z-20 relative">
          <span className="xl:text-3xl text-sm font-bold text-center uppercase leading-none max-md:mt-2">{getTeamDisplayName(game.homeTeam.abbreviation)}</span>
        </div>
        {getTeamLogo(game.homeTeam, homeTeamStyle.logoType) ? (
          <img src={getTeamLogo(game.homeTeam, homeTeamStyle.logoType)} alt={game.homeTeam.abbreviation} className="aspect-square max:w-12 w-8 z-20 relative" />
        ) : (
          <div className="aspect-square max:w-12 w-8 z-20 relative" />
        )}
      </div>

      {/* Line Score Block */}
      {/* <div className="flex flex-1 flex-col justify-evenly items-center bg-white text-black" style={{ minWidth: 220 }}>
        <div className="w-full flex flex-row items-center justify-evenly">
          {[...Array(9)].map((_, i) => (
            <span key={i} className="w-6 text-center font-mono text-lg font-bold">{i + 1}</span>
          ))}
        </div>
        <div className="w-full flex flex-row items-center justify-evenly">
          {[...Array(9)].map((_, i) => {
            const val = lineScore.awayTotals[i] ?? 0;
            return <span key={i} className={`w-6 text-center font-mono text-lg ${i + 1 === currentInning ? 'font-black text-black' : 'text-gray-400'}`}>{val}</span>;
          })}
        </div>
        <div className="w-full flex flex-row items-center justify-evenly">
          {[...Array(9)].map((_, i) => {
            const val = lineScore.homeTotals[i] ?? 0;
            return <span key={i} className={`w-6 text-center font-mono text-lg ${i + 1 === currentInning ? 'font-black text-black' : 'text-gray-400'}`}>{val}</span>;
          })}
        </div>
      </div> */}

    </div>
  );
} 