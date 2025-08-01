'use client'

import { useLiveGames } from '@/hooks/use-live-game'
import { LiveGameDisplay } from '@/components/live-game-display'
import { useTeams } from '@/hooks/use-nfl-data'
import { getTeamLogo, getTeamBackgroundAndLogo } from '@/utils/team-utils'

export default function LiveGamesPage() {
  const { games, loading, error } = useLiveGames()
  const { data: teams } = useTeams()

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Live Games</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Live Games</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  // Get Dodgers team for logo display
  const sampleTeam = teams?.find(team => team.abbreviation === 'LAD')

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Live Games</h1>
      
      {/* Logo Variations Display */}
      {sampleTeam && (
        <div className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Team Logo Variations - {sampleTeam.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <h3 className="font-medium text-sm text-gray-600 mb-2">Default</h3>
              <div className="bg-gray-100 p-4 rounded-lg">
                <img 
                  src={getTeamLogo(sampleTeam, 'default')} 
                  alt={`${sampleTeam.name} default logo`}
                  className="w-16 h-16 mx-auto"
                />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-medium text-sm text-gray-600 mb-2">Dark</h3>
              <div className="bg-gray-100 p-4 rounded-lg">
                <img 
                  src={getTeamLogo(sampleTeam, 'dark')} 
                  alt={`${sampleTeam.name} dark logo`}
                  className="w-16 h-16 mx-auto"
                />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-medium text-sm text-gray-600 mb-2">Scoreboard</h3>
              <div className="bg-gray-100 p-4 rounded-lg">
                <img 
                  src={getTeamLogo(sampleTeam, 'scoreboard')} 
                  alt={`${sampleTeam.name} scoreboard logo`}
                  className="w-16 h-16 mx-auto"
                />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-medium text-sm text-gray-600 mb-2">Dark Scoreboard</h3>
              <div className="bg-gray-100 p-4 rounded-lg">
                <img 
                  src={getTeamLogo(sampleTeam, 'darkScoreboard')} 
                  alt={`${sampleTeam.name} dark scoreboard logo`}
                  className="w-16 h-16 mx-auto"
                />
              </div>
            </div>
          </div>
          
          {/* Manual Color & Logo Mapping Demo */}
          <div className="mt-6">
            <h3 className="font-medium text-sm text-gray-600 mb-3">Manual Color & Logo Mapping</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <h4 className="font-medium text-xs text-gray-500 mb-2">Primary + Dark Logo</h4>
                <div 
                  className="p-4 rounded-lg text-white flex items-center justify-center"
                  style={{ background: `#${sampleTeam.color}` }}
                >
                  <img 
                    src={getTeamLogo(sampleTeam, 'dark')} 
                    alt={`${sampleTeam.name} logo`}
                    className="w-12 h-12 mr-3"
                  />
                  <span className="font-bold">{sampleTeam.abbreviation}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Default combination
                </p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-xs text-gray-500 mb-2">Primary + Default Logo</h4>
                <div 
                  className="p-4 rounded-lg text-white flex items-center justify-center"
                  style={{ background: `#${sampleTeam.color}` }}
                >
                  <img 
                    src={getTeamLogo(sampleTeam, 'default')} 
                    alt={`${sampleTeam.name} logo`}
                    className="w-12 h-12 mr-3"
                  />
                  <span className="font-bold">{sampleTeam.abbreviation}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Standard logo variant
                </p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-xs text-gray-500 mb-2">Secondary + Dark Logo</h4>
                <div 
                  className="p-4 rounded-lg text-white flex items-center justify-center"
                  style={{ background: `#${sampleTeam.alternateColor}` }}
                >
                  <img 
                    src={getTeamLogo(sampleTeam, 'dark')} 
                    alt={`${sampleTeam.name} logo`}
                    className="w-12 h-12 mr-3"
                  />
                  <span className="font-bold">{sampleTeam.abbreviation}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Alternate color option
                </p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-xs text-gray-500 mb-2">Custom + Scoreboard</h4>
                <div 
                  className="p-4 rounded-lg text-white flex items-center justify-center"
                  style={{ background: '#1a1a1a' }}
                >
                  <img 
                    src={getTeamLogo(sampleTeam, 'scoreboard')} 
                    alt={`${sampleTeam.name} logo`}
                    className="w-12 h-12 mr-3"
                  />
                  <span className="font-bold">{sampleTeam.abbreviation}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Custom color + scoreboard logo
                </p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <a 
                href="/team-colors" 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Configure Team Colors & Logos →
              </a>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            <p>Team: {sampleTeam.name} ({sampleTeam.abbreviation})</p>
            <p>Primary Color: {sampleTeam.color || 'N/A'}</p>
            <p>Alternate Color: {sampleTeam.alternateColor || 'N/A'}</p>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
              Show Logo URLs
            </summary>
            <div className="mt-2 text-xs text-gray-600 space-y-1">
              <p><strong>Default:</strong> {getTeamLogo(sampleTeam, 'default')}</p>
              <p><strong>Dark:</strong> {getTeamLogo(sampleTeam, 'dark')}</p>
              <p><strong>Scoreboard:</strong> {getTeamLogo(sampleTeam, 'scoreboard')}</p>
              <p><strong>Dark Scoreboard:</strong> {getTeamLogo(sampleTeam, 'darkScoreboard')}</p>
            </div>
          </details>
        </div>
      )}

      {games.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-600 text-lg">No live games at the moment</p>
          <p className="text-gray-500 mt-2">Check back later for live game updates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <div key={game.id}>
              <LiveGameDisplay gameId={game.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 