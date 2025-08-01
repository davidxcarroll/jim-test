"use client"
import { useState } from "react"
import { useGamesForWeek } from "@/hooks/use-nfl-data"
import { dateHelpers } from "@/utils/date-helpers"
import { getTeamDisplayNameFromTeam } from "@/utils/team-names"
import { format, parseISO } from "date-fns"

const NUM_WEEKS = 5

function getStartOfWeekNDaysAgo(weeksAgo: number) {
  const today = new Date()
  const { start } = dateHelpers.getTuesdayWeekRange(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 * weeksAgo)
  )
  return start
}

export default function WeeklyMatchesPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const startOfWeek = getStartOfWeekNDaysAgo(weekOffset)
  const { start, end } = dateHelpers.getSundayWeekRange(startOfWeek)
  const { data: games, isLoading } = useGamesForWeek(start, end)

  // Group games by day
  const gamesByDay: Record<string, typeof games> = {}
  games?.forEach((game) => {
    const day = format(parseISO(game.date), "EEEE, MMM d")
    if (!gamesByDay[day]) gamesByDay[day] = []
    gamesByDay[day].push(game)
  })

  return (
    <div className="p-4 font-chakra text-2xl">
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          className="px-3 py-1 bg-white/10 text-white font-bold uppercase disabled:text-white/20"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={weekOffset >= NUM_WEEKS - 1}
        >
          Previous
        </button>
        <span className="font-bold">
          {format(start, "MMM d, yyyy")} - {format(end, "MMM d, yyyy")}
        </span>
        <button
          className="px-3 py-1 bg-white/10 text-white font-bold uppercase disabled:text-white/20"
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
        >
          Next
        </button>
      </div>
      {isLoading ? (
        <div>Loading games...</div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.keys(gamesByDay).length === 0 && <div>No games found for this week.</div>}
          {Object.entries(gamesByDay).map(([day, dayGames]) => (
            <div className="flex flex-col gap-4" key={day}>
              <div className=" text-center">{day}</div>
              <ul className="">
                {(dayGames ?? []).map((game) => {
                  const homeScore = game.homeScore !== undefined ? Number(game.homeScore) : null
                  const awayScore = game.awayScore !== undefined ? Number(game.awayScore) : null
                  const isFinal = game.status === "final" || game.status === "post"
                  // Consider multiple possible live statuses
                  const liveStatuses = ["live", "in_progress", "in"]
                  const isLive = liveStatuses.includes(game.status)
                  const validScores = homeScore !== null && awayScore !== null && Number.isFinite(homeScore) && Number.isFinite(awayScore)
                  let homeClass = ""
                  let awayClass = ""
                  let homeCheck = null
                  let awayCheck = null
                  if (isFinal && validScores) {
                    if (homeScore > awayScore) {
                      homeClass = " text-green-500"
                      awayClass = "text-neutral-400"
                      homeCheck = <span className="ml-1 text-green-500">✔</span>
                    } else if (awayScore > homeScore) {
                      awayClass = " text-green-500"
                      homeClass = "text-neutral-400"
                      awayCheck = <span className="ml-1 text-green-500">✔</span>
                    }
                  } else if (isLive) {
                    homeClass = "text-yellow-400 "
                    awayClass = "text-yellow-400 "
                  }
                  // Only show scores for live or completed games with valid scores
                  const showScores = (isFinal || isLive) && validScores
                  // Log all status values for debugging
                  console.log({
                    id: game.id,
                    home: game.homeTeam.abbreviation,
                    away: game.awayTeam.abbreviation,
                    homeScore: game.homeScore,
                    awayScore: game.awayScore,
                    status: game.status
                  })
                  return (
                    <li key={game.id} className="w-full flex flex-col items-center p-4 pt-2 odd:bg-white/10">
                      <div className="flex text-white/50">
                        {format(parseISO(game.date), "h:mm a")}
                      </div>
                      <div className="w-full flex flex-row justify-center items-center gap-2">

                        <div className={`flex flex-1 flex-row gap-2 justify-center items-center ${awayClass}`}>
                          <span className="font-jim text-7xl">{getTeamDisplayNameFromTeam(game.awayTeam)}</span>{showScores ? ` ${awayScore}` : ''}{awayCheck}
                        </div>

                        <div className="text-white/50">@</div>
                        
                        <div className={`flex flex-1 flex-row gap-2 justify-center items-center ${homeClass}`}>
                        <span className="font-jim text-7xl">{getTeamDisplayNameFromTeam(game.homeTeam)}</span>{showScores ? ` ${homeScore}` : ''}{homeCheck}
                        </div>

                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 