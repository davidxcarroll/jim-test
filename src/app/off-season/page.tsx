'use client'

export default function OffSeasonPage() {
  return (
    <div className="font-chakra pb-16 select-none">
      {/* Static navigation elements without links */}
      <div className="relative z-[60] w-[98dvw] flex flex-row items-center justify-center max-md:gap-8 leading-none xl:text-xl text-base text-white">
        <img
          src="/images/clip-305.png"
          className="
            relative z-100 -mb-8 pointer-events-none
            2xl:-mt-28 xl:-mt-14 md:-mt-10 mt-0
            2xl:w-[800px] xl:w-[700px] lg:w-[600px] md:w-[500px] sm:w-[400px] w-[300px]
          "
        />
      </div>

      <div className="flex flex-col lg:px-8 md:px-4 sm:px-2">
        <div className="flex flex-col pt-10 bg-neutral-100">
          <div className="flex flex-col gap-8 items-center justify-center flex-1 pt-8 pb-24">

            <div className="flex flex-col">
            <div className="w-full uppercase md:text-5xl text-3xl text-center font-bold text-balance">
              2025 🏆 Winner
            </div>
            <div className="w-full max-w-6xl font-jim text-center text-6xl md:text-7xl lg:text-8xl xl:text-9xl leading-none text-balance">
              Jimbo!
            </div>
            </div>
            <hr className="w-full my-8 border-t-2 border-black/10" />
            <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
              More stats 👉 <a href="/stats" className="underline">📊here</a>
            </div>
            <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
              Thanks for playing, see y'all next season!
            </div>
            <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
              📋 🏈 ✅
            </div>

          </div>
        </div>
      </div>

      <div className="w-[98dvw] mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>
    </div>
  )
}
