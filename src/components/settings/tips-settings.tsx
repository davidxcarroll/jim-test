import type { ReactNode } from 'react'

import { notoEmoji } from '@/utils/noto-emoji'

const TIP_ARROW = '/images/tips/tip-arrow.svg'

type TipArrowProps = {
  /** Positioning + size of the arrow’s bounding box (percent of parent). */
  className: string
  variant?: 'default' | 'movies'
}

function TipArrow({ className, variant = 'default' }: TipArrowProps) {
  return (
    <div
      className={`absolute z-10 flex items-center justify-center pointer-events-none ${className}`}
      aria-hidden
    >
      <div
        className={
          variant === 'movies'
            ? 'flex-none w-[89%] -scale-y-100 rotate-[157.5deg]'
            : 'flex-none w-[89%] rotate-[22.5deg]'
        }
      >
        <img
          src={TIP_ARROW}
          alt=""
          width={121}
          height={72}
          className="block w-full h-auto max-w-none motion-safe:animate-tip-arrow-nudge"
        />
      </div>
    </div>
  )
}

type TipShotProps = {
  src: string
  alt: string
  children?: ReactNode
  className?: string
}

function TipShot({ src, alt, children, className = '' }: TipShotProps) {
  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <div className="overflow-hidden rounded-[48px] border-[3px] border-black bg-white">
        <img src={src} alt={alt} className="block w-full h-auto" />
      </div>
      {children}
    </div>
  )
}

export function TipsSettings() {
  return (
    <div className="w-full max-w-[1000px] min-w-0 mx-auto bg-neutral-100 px-4 pb-8 text-left">
      <div className="w-full min-w-0 max-w-[900px] mx-auto flex flex-col gap-12 pt-10">

        <h2 className="text-4xl font-bold uppercase leading-[1.2]">
          How it works
        </h2>

        {/* Picks lock at kickoff */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Picks lock at kickoff
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Once a game starts, that pick is locked. You can’t change it after kickoff.
            </p>
          </div>
        </section>

        {/* Clear a pick */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Clear a pick
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              If you regret a pick and want to save it for later, tap the same cell again to remove a pick.
            </p>
          </div>
        </section>

        {/* Week selector */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Week selector for past weeks
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Use the week selector next to the names to jump back to earlier weeks.
            </p>
          </div>
        </section>

        {/* Super Bowl pick locks */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Super Bowl pick locks when the season starts
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Your Super Bowl pick locks when the season starts.
            </p>
          </div>
        </section>

        {/* Circled checks */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Circled checks for correct picks
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              After a game finishes, a circled check marks a correct pick.
            </p>
          </div>
        </section>

        <hr className="w-full border-0 border-t-4 border-black" />

        <h2 className="text-4xl font-bold uppercase leading-[1.2]">
          Settings
        </h2>

        {/* People tab columns */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              People tab: show, hide, reorder
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              On the People tab you can show or hide columns and drag to reorder them so the board
              matches how you like to compare everyone.
            </p>
          </div>
        </section>

        <hr className="w-full border-0 border-t-4 border-black" />

        <h2 className="text-4xl font-bold uppercase leading-[1.2]">
          Fancy stuff
        </h2>

        {/* Weekly Email Reminders */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Weekly Email Reminders
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Would you like to receive an email notification when a new week’s picks are available?
              Look under the Super Bowl pick on the “Main” Settings tab.
            </p>
          </div>

          <div className="relative w-full min-w-0 border-4 border-black bg-white">
            <img
              src="/images/tips/tip-reminder.png"
              alt="Checkbox to get weekly email reminders"
              className="block w-full h-auto"
            />
            <TipArrow className="left-[8.6%] top-[40%] w-[12.6%] aspect-[114/88]" />
          </div>
        </section>

        {/* Tap a name for stats */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Tap a name for stats
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Tap someone’s name to open that person’s stats — a quick way to see how they’re
              doing without leaving the board.
            </p>
          </div>
        </section>

        {/* Game data */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Game data
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Two ways to see game data ① tap a matchup to toggle only those two teams or ② tap
              the football icon to toggle all matchups.</p>
            <p className="text-lg font-semibold leading-[1.2]">
              Game data is different depending on the
              game’s status of before, during, or after. Before will show a team’s record and the
              game’s start time. During will show the score, time, and possession. After will show
              the final score. A green dot indicates when a game is live.
            </p>
          </div>

          <div className="w-full min-w-0 flex flex-col md:flex-row gap-7 md:justify-between">
            <TipShot
              src="/images/tips/tip-football.png"
              alt="Picks board with football icon and live green dot highlighted"
              className="md:w-[calc(50%-0.875rem)]"
            >
              <TipArrow className="left-[50.2%] top-[5.5%] w-[26%] aspect-[114/88]" />
              <TipArrow className="left-[28%] top-[43%] w-[26%] aspect-[114/88]" />
            </TipShot>
            <TipShot
              src="/images/tips/tip-games.png"
              alt="Picks board showing a live game with green status dot"
              className="md:w-[calc(50%-0.875rem)]"
            />
          </div>
        </section>

        {/* Manage multiple profiles */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-5 text-black">
            <h3 className="text-2xl font-bold uppercase leading-[1.2]">
              Manage multiple profiles
            </h3>
            <p className="text-lg font-semibold leading-[1.2]">
              Kids? Spouses? Instead of everyone in a household needing separate accounts, just add
              profiles.
            </p>
          </div>

          <div className="w-full min-w-0 flex flex-col md:flex-row gap-7 md:justify-between md:items-start">
            <TipShot
              src="/images/tips/tip-add-profile.png"
              alt="Settings Main tab with Add Profile button highlighted"
              className="md:w-[calc(50%-0.875rem)]"
            >
              <TipArrow className="left-[34%] top-[79.7%] w-[26%] aspect-[114/88]" />
            </TipShot>
            <TipShot
              src="/images/tips/tip-profile-added.png"
              alt="Settings Main tab after adding a second profile"
              className="md:w-[calc(50%-0.875rem)]"
            />
          </div>

          <p className="text-lg font-semibold leading-[1.2] text-black">
            Top 10 movie lists for these people can also be managed from within the same account.
          </p>

          <TipShot
            src="/images/tips/tip-movie-users.png"
            alt="Movies tab with profile dropdown highlighted"
            className="md:w-[calc(50%-0.875rem)]"
          >
            <TipArrow
              className="left-[47.3%] top-[22.5%] w-[26%] aspect-[114/88]"
              variant="movies"
            />
          </TipShot>
        </section>

        <hr className="w-full border-0 border-t-4 border-black" />

        {/* Questions */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <h2 className="text-4xl font-bold uppercase leading-[1.2]">
            Questions? Seething rage?
          </h2>
          <p className="text-lg font-semibold leading-[1.2]">
            Don't hesitate to reach out!
          </p>
          <p className="text-lg font-semibold leading-[1.2]">
            <span role="img">{notoEmoji('❤️')}</span> David
          </p>
        </section>

      </div>
    </div>
  )
}
