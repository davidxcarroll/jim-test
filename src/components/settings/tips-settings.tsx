import type { ReactNode } from 'react'

import { notoEmoji } from '@/utils/noto-emoji'

const TIP_ARROW = '/images/tips/tip-arrow.svg'

type TipArrowProps = {
  /** Positioning + size of the arrow's bounding box (percent of parent). */
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
          Picks page
        </h2>

        {/* Your column */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Your column
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              People's names are lined up at the top. The column under your name is your picks column.
            </p>
          </div>

          {/* Make a pick */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Make a pick
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              When a new week starts, use a sharpie to write on your screen. Kidding. Just tap a cell in your column to make a pick.
            </p>
          </div>

          {/* Clear a pick */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Clear a pick
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              After making a pick, tap the check again to remove it.
            </p>
          </div>

          {/* Picks lock at kickoff */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Game picks lock at kickoff
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Once a game starts, that pick is locked.
            </p>
          </div>

          {/* Circled checks */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Circled winners
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              After a game finishes, the winning team and correct picks are circled.
            </p>
          </div>

          {/* Week selector */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              See previous weeks
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              On the Picks page, use the [WEEKS] dropdown to jump back to earlier weeks.
            </p>
            {/* reference */}
            {/* <div className="week-selector h-16 flex items-center justify-start relative">
              <div className="w-fit flex items-center justify-between gap-1 p-2 pl-4 bg-neutral-100 whitespace-nowrap font-bold uppercase xl:text-base border-4 border-black">
                Weeks
                <span className="material-symbols-sharp transition-transform">arrow_drop_down</span>
              </div>
            </div> */}
          </div>

          {/* Tap a name for stats */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Profiles
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Tap someone's name to open an overview of their picks, both football and movies.
            </p>
          </div>

        </section>

        <hr className="w-full border-0 border-t border-black" />

        <h2 className="text-4xl font-bold uppercase leading-[1.2]">
          Settings page
        </h2>

        {/* You tab */}
        <section className="w-full min-w-0 flex flex-col gap-5">

          <h3 className="sm:text-2xl text-xl font-bold leading-[1.2] uppercase underline">
            You tab
          </h3>

          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Your name
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Keep this short. It's what will appear atop the Picks page.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Super Bowl pick
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Pick which team you think will win the Super Bowl. Just like Jim used to do it.
            </p>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Note: Super Bowl pick locks at the start of the season.
            </p>
          </div>

          {/* Weekly Email Reminders */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Weekly email reminders
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Receive an email notification when a new week's picks are available.
            </p>
          </div>

          {/* <div className="relative w-full min-w-0 border-4 border-black bg-white">
            <img
              src="/images/tips/tip-reminder.png"
              alt="Checkbox to get weekly email reminders"
              className="block w-full h-auto"
            />
            <TipArrow className="left-[8.6%] top-[40%] w-[12.6%] aspect-[114/88]" />
          </div> */}

        </section>

        {/* People tab */}
        <section className="w-full min-w-0 flex flex-col gap-5">

          <h3 className="sm:text-2xl text-xl font-bold leading-[1.2] uppercase underline">
            People tab
          </h3>

          {/* People tab columns */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Show, hide, reorder
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Show or hide columns and drag to reorder them so the board matches how you like to compare everyone.
            </p>
          </div>
        </section>

        {/* Movies tab */}
        <section className="w-full min-w-0 flex flex-col gap-5">

          <h3 className="sm:text-2xl text-xl font-bold leading-[1.2] uppercase underline">
            Movies tab
          </h3>

          {/* Top 10 movie lists */}
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Top 10 movie lists
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Not football related but hey we can't properly invoke Jim without asking for everyone's top 10 movies. These will appear on people's profiles.
            </p>
          </div>
        </section>

        <hr className="w-full border-0 border-t border-black" />

        <h2 className="text-4xl font-bold uppercase leading-[1.2]">
          Fancy stuff
        </h2>

        {/* Game data */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Game data
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Two ways to see game data: (1) tap a matchup to toggle only those two teams, or (2) tap
              the little <span role="img">{notoEmoji('🏈')}</span> football icon at the top to toggle all matchups.
            </p>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Data depends on status. Before: Start time and teams' records. During: Score, quarter, time, and possession. After: Final score.
            </p>
          </div>

          {/* <div className="w-full min-w-0 flex flex-col md:flex-row gap-7 md:justify-between">
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
          </div> */}

        </section>

        {/* Manage multiple profiles */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Manage multiple profiles
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Kids? Spouses? Instead of everyone in a household needing separate accounts, one account can contain multiple profiles.
            </p>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              On the "YOU" Settings tab, tap the [ADD PROFILE] button to add a new profile.
            </p>
          </div>

          {/* <div className="w-full min-w-0 flex flex-col md:flex-row gap-7 md:justify-between md:items-start">
            <TipShot
              src="/images/tips/tip-add-profile.png"
              alt="Settings You tab with Add Profile button highlighted"
              className="md:w-[calc(50%-0.875rem)]"
            >
              <TipArrow className="left-[34%] top-[79.7%] w-[26%] aspect-[114/88]" />
            </TipShot>
            <TipShot
              src="/images/tips/tip-profile-added.png"
              alt="Settings You tab after adding a second profile"
              className="md:w-[calc(50%-0.875rem)]"
            />
          </div> */}

          <p className="text-lg font-mono leading-[1.2] text-black">
            Top 10 movie lists for these people can also be managed from within the same account.
          </p>

          {/* <TipShot
            src="/images/tips/tip-movie-users.png"
            alt="Movies tab with profile dropdown highlighted"
            className="md:w-[calc(50%-0.875rem)]"
          >
            <TipArrow
              className="left-[47.3%] top-[22.5%] w-[26%] aspect-[114/88]"
              variant="movies"
            />
          </TipShot> */}
        </section>

        <hr className="w-full border-0 border-t border-black" />

        {/* Housekeeping */}
        <section className="w-full min-w-0 flex flex-col gap-5">
          <h2 className="text-4xl font-bold uppercase leading-[1.2]">
            Housekeeping
          </h2>

          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Grace
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              In true Jim fashion, I'll do my best to bug you to get your picks in on time.
            </p>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              In true David fashion, if you miss three weeks in a row I'm going to boot you.
            </p>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Didn't make a pick in time? It might not be too late! Contact me!
            </p>
          </div>

          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Questions? Panic? Seething rage?
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              Someone you know knows my number. Don't hesitate to reach out!
            </p>
          </div>

          <div className="flex flex-col gap-2 text-black">
            <h3 className="text-xl font-bold leading-[1.2]">
              Happy picking!
            </h3>
            <p className="text-base font-mono leading-[1.2] text-pretty">
              <span role="img">{notoEmoji('❤️')}</span> David
            </p>
          </div>

        </section>

      </div>
    </div>
  )
}
