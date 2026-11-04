'use client'

/**
 * Matches Buy Me a Coffee's button.prod.min.js widget (no supporter count).
 * The img.buymeacoffee.com/button-api/ image always includes the count.
 */
export function BuyMeCoffeeButton() {
  return (
    <div className="flex justify-center">
      <a
        href="https://www.buymeacoffee.com/hazeltine"
        target="_blank"
        rel="noopener noreferrer"
        className="bmc-btn inline-flex items-center box-border no-underline hover:no-underline focus:no-underline active:no-underline cursor-pointer font-jim text-[1.75rem] leading-[2.5rem] xl:text-[2rem] xl:leading-[3rem] shadow-[inset_0_0_0_1px_#000000]"
        style={{
          height: '2rem',
          padding: '0 .5rem',
          border: '1px solid #999',
          borderWidth: '1px',
        }}
      >
        {/* <span className="inline-flex items-center gap-1 text-[32px] leading-none select-none" aria-hidden>
          <span
            title="System text emoji"
            style={{
              fontFamily: 'Apple Color Emoji, Segoe UI Emoji, system-ui, sans-serif',
              fontVariantEmoji: 'text',
            }}
          >
            ☕
          </span>
        </span> */}
        <span
          className="bmc-btn-text font-jim"
          style={{
            marginLeft: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Buy me a coffee?
        </span>
      </a>
    </div>
  )
}
